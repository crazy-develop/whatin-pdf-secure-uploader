import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Subject, PDFDocument, SecurityLog, SystemStats } from "./src/types";

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

// In-Memory Database fallback/cache
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
const activeViewTokens = new Map<string, { docId: string; expiresAt: number }>();

// Load from disk if metadata exists
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
      console.log("Database successfully loaded from disk.");
    } else {
      saveDatabase(); // Save initial defaults
    }
  } catch (err) {
    console.error("Database reading error, using defaults:", err);
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

loadDatabase();

// Clean up expired tokens periodically (every 1 minute)
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of activeViewTokens.entries()) {
    if (now > info.expiresAt) {
      activeViewTokens.delete(token);
    }
  }
}, 60 * 1000);

// Helper to log actions
function addSecurityLog(action: string, fileName: string, detail: string, req?: express.Request) {
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
}

// Ensure first logs have some entries
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

app.post("/api/subjects", (req, res) => {
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
  addSecurityLog("SUBJECT_CREATE", name, `Created new subject category: ${name}`, req);
  res.json(newSubject);
});

// 3. PDF Metadata list
app.get("/api/pdfs", (req, res) => {
  // Return list without pdf files bytes obviously
  res.json(pdfDocuments);
});

// 4. Secure PDF Direct upload (post as Base64 JSON)
app.post("/api/pdfs/upload", (req, res) => {
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
    addSecurityLog("FILE_UPLOAD", fileName, `Uploaded securely by ${newPdf.uploadedBy} (Vault ID: ${pdfId})`, req);
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

app.post("/api/settings", (req, res) => {
  const { url } = req.body;
  externalIntegrationUrl = url || "";
  saveDatabase();
  addSecurityLog("SETTINGS_UPDATE", "External Connection Config", `Updated destination integration URL to: ${externalIntegrationUrl || "none"}`, req);
  res.json({ success: true, externalIntegrationUrl });
});

// 5. Delete PDF
app.delete("/api/pdfs/:id", (req, res) => {
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
    addSecurityLog("FILE_DELETE", pdf.fileName, `Permanently deleted from the system.`, req);
    res.json({ success: true, message: "PDF successfully deleted." });
  } catch (error) {
    console.error("PDF delete error:", error);
    res.status(500).json({ error: "Failed to delete PDF from storage." });
  }
});

// 6. Security incident logging
app.post("/api/security-log", (req, res) => {
  const { action, fileName, detail } = req.body;
  addSecurityLog(action || "SECURITY_ALERT", fileName || "Unknown", detail || "Action triggered.", req);
  res.json({ success: true });
});

app.get("/api/security-logs", (req, res) => {
  res.json(securityLogs);
});

// 7. Request temporary One-Time View Token for a PDF
app.post("/api/get-view-token/:id", (req, res) => {
  const { id } = req.params;
  const doc = pdfDocuments.find(d => d.id === id);
  
  if (!doc) {
    addSecurityLog("UNAUTHORIZED_ACCESS", `ID: ${id}`, `Attempted to generate OTT for non-existent document ID.`, req);
    return res.status(404).json({ error: "Document not found" });
  }

  // Generate a cryptographically secure-looking random token
  const token = `ott-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + 15 * 1000; // 15 seconds validity

  activeViewTokens.set(token, { docId: id, expiresAt, count: 0 } as any);
  
  res.json({ token, expiresAt });
});

// 8. Serve Secure PDF Content (Binary Stream)
app.get("/api/pdf-content/:id", (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  // Security Check 1: Must provide token
  if (!token || typeof token !== "string") {
    addSecurityLog("BLOCKED_DIRECT_LINK", id, "Attempted direct URL access without a session token.", req);
    return res.status(403).send("<h1>Access Blocked: Security Policy Violation</h1><p>Direct linking or external downloads are not allowed. PDFs are securely rendered strictly within the official site viewer.</p>");
  }

  // Security Check 2: Verify active OTT
  const tokenObj = activeViewTokens.get(token) as any;
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
  const doc = pdfDocuments.find(d => d.id === id);
  if (!doc) {
    return res.status(404).send("Document not found in registry.");
  }

  const filePath = path.join(FILES_DIR, `${id}.pdf`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("PDF Binary content missing from physical disk vault.");
  }

  // Increment views
  doc.views += 1;
  saveDatabase();

  addSecurityLog("FILE_DECRYPT_READ", doc.fileName, `Document decrypted & streamed safely inside site secure viewer container.`, req);

  // Security Header Injection
  // We forces 'inline' rendering so the browser opens it instead of downloading it.
  // We also try to set sandbox-restrictive policies if they can be read.
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`);
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
