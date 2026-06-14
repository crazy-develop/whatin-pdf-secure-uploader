import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Subject, PDFDocument, SecurityLog, SystemStats } from "./src/types";

// Firebase imports
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from "firebase/firestore";
import { firebaseConfig } from "./src/firebase-config";

const app = express();
const PORT = 3000;

// Set up server body parser for JSON content - raise limit for larger Base64 PDF uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Storage folders
const STORAGE_DIR = path.join(process.cwd(), "pdf_storage");
const FILES_DIR = path.join(STORAGE_DIR, "files");
const METADATA_FILE = path.join(STORAGE_DIR, "metadata.json");

// Create storage directories if they do not exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Cache lists
let subjects: Subject[] = [
  { id: "sub-1", name: "Computer Science", description: "B.Tech Computer Science, IT, and programming notes.", color: "emerald", iconName: "Laptop" },
  { id: "sub-2", name: "Mathematics", description: "Calculus, Linear Algebra, and Discrete Math study material.", color: "blue", iconName: "Binary" },
  { id: "sub-3", name: "Physics", description: "Electromagnetism, Quantum Mechanics, and Thermodynamics.", color: "purple", iconName: "Atom" },
  { id: "sub-4", name: "Chemistry", description: "Organic synthesis, inorganic elements, and physical chemistry.", color: "amber", iconName: "FlaskConical" },
];

let pdfDocuments: PDFDocument[] = [];
let securityLogs: SecurityLog[] = [];
let externalIntegrationUrl: string = ""; // Destination link for external system connections

// One-time-use viewing tokens (token -> { docId, expiresAt })
const activeViewTokens = new Map<string, { docId: string; expiresAt: number; count: number }>();

// Clean up expired tokens periodically (every 1 minute)
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of activeViewTokens.entries()) {
    if (now > info.expiresAt) {
      activeViewTokens.delete(token);
    }
  }
}, 60 * 1000);

// Load from disk fallback
function loadDatabase() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
      if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
        subjects = data.subjects;
      }
      if (data.pdfDocuments && Array.isArray(data.pdfDocuments)) {
        pdfDocuments = data.pdfDocuments;
      }
      if (data.securityLogs && Array.isArray(data.securityLogs)) {
        securityLogs = data.securityLogs;
      }
      if (data.externalIntegrationUrl !== undefined) {
        externalIntegrationUrl = data.externalIntegrationUrl;
      }
      console.log("Fallback Database successfully loaded from local disk.");
    } else {
      saveDatabase(); // Save initial defaults
    }
  } catch (err) {
    console.error("Local Database reading error:", err);
  }
}

function saveDatabase() {
  try {
    const data = {
      subjects,
      pdfDocuments,
      securityLogs: securityLogs.slice(0, 1000), // Keep last 1000 logs
      externalIntegrationUrl
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Database saving error:", err);
  }
}

// Sync all collections from Firebase Cloud Firestore at boot time
async function syncFromFirestoreAndBoost() {
  try {
    // Authenticate the server session using administrator credentials
    await signInWithEmailAndPassword(auth, "dushyantsaini@whatin.in", "admin123SuperAdminSecurityCode!");
    console.log("Firebase Admin session authenticated successfully on back-end server.");

    // 1. Sync Subjects
    const subjectsSnap = await getDocs(collection(db, "subjects"));
    if (!subjectsSnap.empty) {
      const b: Subject[] = [];
      subjectsSnap.forEach(d => {
        b.push(d.data() as Subject);
      });
      subjects = b;
    } else {
      // Seed Firestore with default categories if empty
      for (const s of subjects) {
        await setDoc(doc(db, "subjects", s.id), s);
      }
      console.log("Seeded basic subject categories onto Firestore Cloud Database.");
    }

    // 2. Sync PDF Documents and Restore files if missing
    const pdfSnap = await getDocs(collection(db, "pdfs"));
    const fetchedPdfs: PDFDocument[] = [];
    
    pdfSnap.forEach(docSnap => {
      const data = docSnap.data() as any;
      const pdfId = data.id;
      const filePath = path.join(FILES_DIR, `${pdfId}.pdf`);

      // If physical file got deleted or container restarted, recreate PDF binary locally from Firestore Base64 backup
      if (!fs.existsSync(filePath) && data.base64Backup) {
        try {
          const buffer = Buffer.from(data.base64Backup, 'base64');
          fs.writeFileSync(filePath, buffer);
          console.log(`Cloud Auto-Restoration: Restored file [${data.fileName}] from cloud base64 backup metadata.`);
        } catch (err: any) {
          console.error(`Physical write fail on auto-restoration for PDF: ${data.fileName}`, err.message);
        }
      }

      // We omit the heavy base64Backup field from state cache RAM list
      const { base64Backup, ...cleanPdf } = data;
      fetchedPdfs.push(cleanPdf as PDFDocument);
    });

    fetchedPdfs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    pdfDocuments = fetchedPdfs;

    // 3. Sync Security Logs
    const logsSnap = await getDocs(collection(db, "security_logs"));
    const fetchedLogs: SecurityLog[] = [];
    logsSnap.forEach(d => {
      fetchedLogs.push(d.data() as SecurityLog);
    });
    fetchedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    securityLogs = fetchedLogs;

    // 4. Sync Settings
    const settingsSnap = await getDocs(collection(db, "settings"));
    settingsSnap.forEach(d => {
      if (d.id === "global_config") {
        externalIntegrationUrl = d.data().externalIntegrationUrl || "";
      }
    });

    console.log("Durable Database successfully synchronized with active Firebase Collections!");
  } catch (err: any) {
    console.error("Firebase connections not established on server, falling back to disk layers:", err.message);
    loadDatabase();
  }
}

// Helper to log actions
async function addSecurityLog(action: string, fileName: string, detail: string, req?: express.Request) {
  const ipAddress = req ? (req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '127.0.0.1') : 'System';
  const log: SecurityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    action,
    fileName,
    timestamp: new Date().toISOString(),
    ipAddress,
    detail
  };
  securityLogs.unshift(log);
  saveDatabase();

  // Push log to Firestore
  try {
    await setDoc(doc(db, "security_logs", log.id), log);
  } catch (e: any) {
    console.error("Firestore security log write failed:", e.message);
  }
}

// Seeding first log if absolutely empty
if (securityLogs.length === 0) {
  addSecurityLog("SYSTEM_INIT", "Database", "Secure PDF Vault system initialized.");
}

// API Routes
// 1. System stats
app.get("/api/stats", (req, res) => {
  const totalViews = pdfDocuments.reduce((qty, doc) => qty + doc.views, 0);
  const blockedAttempts = securityLogs.filter(l => l.action.startsWith("BLOCK_") || l.action === "UNAUTHORIZED_ACCESS").length;
  
  const stats: SystemStats = {
    totalPDFs: pdfDocuments.length,
    totalSubjects: subjects.length,
    totalViews,
    blockedAttempts
  };
  res.json(stats);
});

// 2. Subject Endpoints
app.get("/api/subjects", (req, res) => {
  res.json(subjects);
});

app.post("/api/subjects", async (req, res) => {
  const { name, description, color, iconName } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Subject name is required" });
  }

  const newSubject: Subject = {
    id: `sub-${Date.now()}`,
    name,
    description: description || "",
    color: color || "indigo",
    iconName: iconName || "BookOpen"
  };

  subjects.push(newSubject);
  saveDatabase();
  await addSecurityLog("SUBJECT_CREATE", name, `Created new subject category: ${name}`, req);

  // Write subject to Firestore
  try {
    await setDoc(doc(db, "subjects", newSubject.id), newSubject);
  } catch (err: any) {
    console.error("Firestore subject list sync failed:", err.message);
  }

  res.json(newSubject);
});

// 3. PDF Metadata list
app.get("/api/pdfs", (req, res) => {
  res.json(pdfDocuments);
});

// 4. Secure PDF Direct upload (post as Base64 JSON)
app.post("/api/pdfs/upload", async (req, res) => {
  const { title, subjectId, base64Data, fileName, fileSize, options, uploadedBy } = req.body;

  if (!title || !subjectId || !base64Data || !fileName) {
    return res.status(400).json({ error: "Missing required fields (title, subjectId, base64Data, or fileName)." });
  }

  const selectedSubject = subjects.find(s => s.id === subjectId);
  if (!selectedSubject) {
    return res.status(404).json({ error: "Subject category not found." });
  }

  // Extract raw base64 data without data-uri prefix if present
  let cleanBase64 = base64Data;
  if (base64Data.includes(";base64,")) {
    cleanBase64 = base64Data.split(";base64,")[1];
  }

  const pdfId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const filePath = path.join(FILES_DIR, `${pdfId}.pdf`);

  try {
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const newPdf: PDFDocument = {
      id: pdfId,
      title,
      subjectId,
      subjectName: selectedSubject.name,
      fileName,
      fileSize: fileSize || buffer.length,
      uploadedAt: new Date().toISOString(),
      views: 0,
      downloadRestricted: options?.downloadRestricted !== false, // default true
      printRestricted: options?.printRestricted !== false, // default true
      watermarkEnabled: options?.watermarkEnabled !== false, // default true
      isLocked: options?.isLocked === true, // default false
      uploadedBy: uploadedBy || "Admin"
    };

    pdfDocuments.unshift(newPdf);
    saveDatabase();
    await addSecurityLog("FILE_UPLOAD", fileName, `Uploaded securely by ${newPdf.uploadedBy} (Vault ID: ${pdfId})`, req);

    // Sync metadata and backup data to cloud Firestore database
    const cloudPayload: any = { ...newPdf };
    // Only save base64 block directly inside firestore document if size < 900KB
    if (buffer.length < 900 * 1024) {
      cloudPayload.base64Backup = cleanBase64;
    }

    try {
      await setDoc(doc(db, "pdfs", pdfId), cloudPayload);
    } catch (e: any) {
      console.error("Firestore cloud upload link failed:", e.message);
    }

    res.json(newPdf);
  } catch (error: any) {
    console.error("PDF upload save error:", error);
    res.status(500).json({ error: "Failed to write PDF file to secure vault." });
  }
});

// 4b. Get & update External Integration URL settings
app.get("/api/settings", (req, res) => {
  res.json({ externalIntegrationUrl });
});

app.post("/api/settings", async (req, res) => {
  const { url } = req.body;
  externalIntegrationUrl = url || "";
  saveDatabase();
  await addSecurityLog("SETTINGS_UPDATE", "External Connection Config", `Updated destination integration URL to: ${externalIntegrationUrl || "none"}`, req);

  try {
    await setDoc(doc(db, "settings", "global_config"), { id: "global_config", externalIntegrationUrl });
  } catch (e: any) {
    console.error("Firestore settings saving failed:", e.message);
  }

  res.json({ success: true, externalIntegrationUrl });
});

// 5. Delete PDF
app.delete("/api/pdfs/:id", async (req, res) => {
  const { id } = req.params;
  const index = pdfDocuments.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "PDF document not found." });
  }

  const pdf = pdfDocuments[index];
  const filePath = path.join(FILES_DIR, `${id}.pdf`);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    pdfDocuments.splice(index, 1);
    saveDatabase();
    await addSecurityLog("FILE_DELETE", pdf.fileName, `Permanently deleted from the system.`, req);

    try {
      await deleteDoc(doc(db, "pdfs", id));
    } catch (e: any) {
      console.error("Firestore document delete failed:", e.message);
    }

    res.json({ success: true, message: "PDF successfully deleted." });
  } catch (error) {
    console.error("PDF delete error:", error);
    res.status(500).json({ error: "Failed to delete PDF from storage." });
  }
});

// 6. Security incident logging
app.post("/api/security-log", async (req, res) => {
  const { action, fileName, detail } = req.body;
  await addSecurityLog(action || "SECURITY_ALERT", fileName || "Unknown", detail || "Action triggered.", req);
  res.json({ success: true });
});

app.get("/api/security-logs", (req, res) => {
  res.json(securityLogs);
});

// 7. Request temporary One-Time View Token for a PDF
app.post("/api/get-view-token/:id", (req, res) => {
  const { id } = req.params;
  const foundDoc = pdfDocuments.find(d => d.id === id);
  
  if (!foundDoc) {
    addSecurityLog("UNAUTHORIZED_ACCESS", `ID: ${id}`, `Attempted to generate OTT for non-existent document ID.`, req);
    return res.status(404).json({ error: "Document not found" });
  }

  // Generate a cryptographically secure-looking random token
  const token = `ott-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + 15 * 1000; // 15 seconds validity

  activeViewTokens.set(token, { docId: id, expiresAt, count: 0 });
  
  res.json({ token, expiresAt });
});

// 8. Serve Secure PDF Content (Binary Stream)
app.get("/api/pdf-content/:id", async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  // Security Check 1: Must provide token
  if (!token || typeof token !== "string") {
    addSecurityLog("BLOCKED_DIRECT_LINK", id, "Attempted direct URL access without a session token.", req);
    return res.status(403).send("<h1>Access Blocked: Security Policy Violation</h1><p>Direct linking or external downloads are not allowed. PDFs are securely rendered strictly within the official site viewer.</p>");
  }

  // Security Check 2: Verify active OTT
  const tokenObj = activeViewTokens.get(token);
  if (!tokenObj || tokenObj.docId !== id) {
    addSecurityLog("BLOCKED_EXPIRED_TOKEN", id, "Access blocked due to expired, processed, or modified One-Time-Ticket.", req);
    return res.status(403).send("<h1>Access Link Expired</h1><p>PDF security session ticket has expired. Please re-open the document from within your subject dashboard.</p>");
  }

  // Security Check 3: Is token expired?
  if (Date.now() > tokenObj.expiresAt) {
    activeViewTokens.delete(token); // clean up
    addSecurityLog("BLOCKED_EXPIRED_TOKEN", id, "Secure viewer token timeout (>15s) triggered.", req);
    return res.status(403).send("<h1>Access Session Timeout</h1><p>Your viewer session initialization timed out. Please click View again.</p>");
  }

  // Increment read count to allow browser range requests and pre-fetching, then burn after 6 uses
  tokenObj.count += 1;
  if (tokenObj.count >= 6) {
    activeViewTokens.delete(token);
  }

  // Load document metadata to increment views and check configuration
  const pdfDoc = pdfDocuments.find(d => d.id === id);
  if (!pdfDoc) {
    return res.status(404).send("Document not found in registry.");
  }

  const filePath = path.join(FILES_DIR, `${id}.pdf`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("PDF Binary content missing from physical disk vault.");
  }

  // Increment views
  pdfDoc.views += 1;
  saveDatabase();

  try {
    await updateDoc(doc(db, "pdfs", id), { views: pdfDoc.views });
  } catch (e: any) {
    console.error("Firestore views increment tracking failed:", e.message);
  }

  await addSecurityLog("FILE_DECRYPT_READ", pdfDoc.fileName, `Document decrypted & streamed safely inside site secure viewer container.`, req);

  // Security Header Injection
  // We forces 'inline' rendering so the browser opens it instead of downloading it.
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(pdfDoc.fileName)}"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Security-Policy", "default-src 'self'; frame-ancestors 'self'");

  // Stream PDF file
  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    console.error("Stream pipe error:", err);
    res.status(500).send("Streaming service failed.");
  });
  stream.pipe(res);
});

// Configure Vite integration
async function startServer() {
  await syncFromFirestoreAndBoost();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SECURE PDF PORTAL] Application listening on http://localhost:${PORT}`);
  });
}

startServer();
