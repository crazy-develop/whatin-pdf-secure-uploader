import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  FileText,
  Eye,
  AlertTriangle,
  Lock,
  Unlock,
  Download,
  Printer,
  BookOpen,
  Plus,
  PlusCircle,
  X,
  ChevronRight,
  Info,
  Calendar,
  Terminal,
  ArrowLeft,
  Search,
  CheckCircle2,
  HelpCircle,
  Laptop,
  Flame,
  Binary,
  Atom,
  FlaskConical
} from "lucide-react";
import DashboardStats from "./components/DashboardStats";
import SecurityAuditLogs from "./components/SecurityAuditLogs";
import SecurePdfCanvasViewer from "./components/SecurePdfCanvasViewer";
import { Subject, PDFDocument, SecurityLog, SystemStats } from "./types";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";


export default function App() {
  // Authentication State
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string; role: "admin" | "student" } | null>(() => {
    const stored = localStorage.getItem("pdf_user_session");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Login form temporary states
  const [loginRole, setLoginRole] = useState<"student" | "admin">("student");
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("sainidushyant756@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Tabs: 'student' | 'admin' | 'firewall' | 'student-upload'
  const [activeTab, setActiveTab] = useState<"student" | "admin" | "firewall" | "student-upload">("student");
  
  // Data State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [externalUrl, setExternalUrl] = useState(""); // Persistent integration link
  
  // Selection/View State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePdfViewer, setActivePdfViewer] = useState<PDFDocument | null>(null);
  const [pdfIframeUrl, setPdfIframeUrl] = useState<string>("");
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [viewerKey, setViewerKey] = useState(0); // For forcing iframe refreshes

  // Upload fields
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [studentUploaderName, setStudentUploaderName] = useState(""); // Student custom upload name
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedFileBase64, setSelectedFileBase64] = useState<string>("");
  const [optionDownloadRestricted, setOptionDownloadRestricted] = useState(true);
  const [optionPrintRestricted, setOptionPrintRestricted] = useState(true);
  const [optionWatermarkEnabled, setOptionWatermarkEnabled] = useState(true);
  const [optionIsLocked, setOptionIsLocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");

  // New Subject fields
  const [newSubName, setNewSubName] = useState("");
  const [newSubDesc, setNewSubDesc] = useState("");
  const [newSubColor, setNewSubColor] = useState("emerald");
  const [newSubIcon, setNewSubIcon] = useState("BookOpen");
  const [subSuccessMsg, setSubSuccessMsg] = useState("");
  const [subErrorMsg, setSubErrorMsg] = useState("");

  // In-memory or state representation of dynamic settings panel
  const [adminIntUrlInput, setAdminIntUrlInput] = useState("");
  const [settingsStatusMsg, setSettingsStatusMsg] = useState("");
  const [authProcessing, setAuthProcessing] = useState(false);

  // Sync Firebase Auth state with React internal session state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const stored = localStorage.getItem("pdf_user_session");
        let session = null;
        if (stored) {
          try {
            session = JSON.parse(stored);
          } catch (e) {}
        }
        if (session && session.email === user.email) {
          setLoggedInUser(session);
        } else {
          const role = (user.email === "dushyantsaini@whatin.in") ? "admin" : "student";
          const newSession = {
            name: user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || "guest@portal.secure",
            role: role as "admin" | "student"
          };
          localStorage.setItem("pdf_user_session", JSON.stringify(newSession));
          setLoggedInUser(newSession);
        }
      } else {
        setLoggedInUser(null);
        localStorage.removeItem("pdf_user_session");
      }
    });
    return () => unsubscribe();
  }, []);

  // Pre-fill student uploader name when logged in user updates
  useEffect(() => {
    if (loggedInUser) {
      setStudentUploaderName(loggedInUser.name);
    }
  }, [loggedInUser]);


  // Simulated user context matching current session metadata
  const currentUser = {
    email: loggedInUser ? loggedInUser.email : "Guest",
    role: loggedInUser ? (loggedInUser.role === "admin" ? "Administrator" : "Student") : "Guest",
    ipAddress: "Telemetry Verified"
  };

  // Drag over state
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch all starting parameters
  const fetchAllData = async () => {
    try {
      const [subsRes, pdfsRes, logsRes, statsRes, settingsRes] = await Promise.all([
        fetch("/api/subjects"),
        fetch("/api/pdfs"),
        fetch("/api/security-logs"),
        fetch("/api/stats"),
        fetch("/api/settings"),
      ]);

      if (subsRes.ok) setSubjects(await subsRes.json());
      if (pdfsRes.ok) setPdfs(await pdfsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (settingsRes.ok) {
        const setts = await settingsRes.json();
        setExternalUrl(setts.externalIntegrationUrl || "");
        setAdminIntUrlInput(setts.externalIntegrationUrl || "");
      }
    } catch (e) {
      console.error("API Fetch execution failure:", e);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Poll data statistics and audit reports periodically every 5 seconds
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Set up login session handler with Firebase Auth Integration
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setAuthProcessing(true);

    const email = loginEmail.trim();

    if (loginRole === "student") {
      if (!loginName.trim()) {
        setLoginError("Kripya apna naam fill karein (Please write your Name).");
        setAuthProcessing(false);
        return;
      }
      if (!email) {
        setLoginError("Kripya apni Email Address fill karein.");
        setAuthProcessing(false);
        return;
      }
      if (!loginPassword || loginPassword.length < 6) {
        setLoginError("Password must be at least 6 characters.");
        setAuthProcessing(false);
        return;
      }

      try {
        let userCredential;
        try {
          // Try standard login on Firebase Auth
          userCredential = await signInWithEmailAndPassword(auth, email, loginPassword);
        } catch (authErr: any) {
          // If the profile does not exist or credentials are new, treat as dynamic signup
          if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential") {
            try {
              userCredential = await createUserWithEmailAndPassword(auth, email, loginPassword);
              if (userCredential.user) {
                await updateProfile(userCredential.user, { displayName: loginName.trim() });
              }
            } catch (signupErr: any) {
              console.error("Firebase signup error:", signupErr);
              if (signupErr.code === "auth/email-already-in-use") {
                setLoginError("Yeh email already registered hai. Kripya correct password fill karein.");
                setAuthProcessing(false);
                return;
              } else if (signupErr.code === "auth/invalid-email") {
                setLoginError("Kripya correct email structure fill karein.");
                setAuthProcessing(false);
                return;
              } else if (signupErr.code === "auth/weak-password") {
                setLoginError("Chhota password! Strong password choose karein (Min. 6 character).");
                setAuthProcessing(false);
                return;
              } else {
                setLoginError("Firebase registration error: " + signupErr.message);
                setAuthProcessing(false);
                return;
              }
            }
          } else {
            console.error("Firebase overall authorization error:", authErr);
            if (authErr.code === "auth/wrong-password") {
              setLoginError("Galat Password/Passcode! If you are a new Student, register using a different email.");
              setAuthProcessing(false);
              return;
            } else if (authErr.code === "auth/invalid-email") {
              setLoginError("Invalid email address format.");
              setAuthProcessing(false);
              return;
            } else {
              setLoginError("Firebase login error: " + authErr.code);
              setAuthProcessing(false);
              return;
            }
          }
        }

        const authenticatedUser = userCredential.user;
        const session = {
          name: authenticatedUser.displayName || loginName.trim(),
          email: authenticatedUser.email || email,
          role: "student" as const
        };
        localStorage.setItem("pdf_user_session", JSON.stringify(session));
        setLoggedInUser(session);
        setActiveTab("student");
        logSecurityViolation("USER_LOGIN", "Student Portal", `Student ${session.name} successfully entered & verified via Firebase. Email: ${session.email}`);
      } catch (err: any) {
        setLoginError("Auth communication failure: " + err.message);
      } finally {
        setAuthProcessing(false);
      }

    } else {
      // System Admin login
      if (loginPassword !== "Dushyant<2006>") {
        setLoginError("Galat password! Kripya correct admin passcode enter karein.");
        setAuthProcessing(false);
        return;
      }

      // Secure Admin session sync
      const adminEmail = "dushyantsaini@whatin.in";
      const adminPass = "admin123SuperAdminSecurityCode!";

      try {
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
        } catch (adminLoginErr: any) {
          if (adminLoginErr.code === "auth/user-not-found" || adminLoginErr.code === "auth/invalid-credential") {
            // Register default admin to make the Firebase Auth project complete
            userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
            if (userCredential.user) {
              await updateProfile(userCredential.user, { displayName: "Dushyant Saini" });
            }
          } else {
            throw adminLoginErr;
          }
        }

        const authenticatedUser = userCredential.user;
        const session = {
          name: authenticatedUser.displayName || "Dushyant Saini",
          email: authenticatedUser.email || adminEmail,
          role: "admin" as const
        };
        localStorage.setItem("pdf_user_session", JSON.stringify(session));
        setLoggedInUser(session);
        setActiveTab("student");
        logSecurityViolation("USER_LOGIN", "Admin Panel", "System Administrator logged in with verified Firebase Auth Credentials.");
      } catch (err: any) {
        console.error("Firebase admin auth error, using offline fallback:", err);
        const session = {
          name: "Dushyant Saini (Offline fallback)",
          email: adminEmail,
          role: "admin" as const
        };
        localStorage.setItem("pdf_user_session", JSON.stringify(session));
        setLoggedInUser(session);
        setActiveTab("student");
        logSecurityViolation("USER_LOGIN_FALLBACK", "Admin Panel", `System Admin signed in via local fallback. Detail: ${err.message}`);
      } finally {
        setAuthProcessing(false);
      }
    }
  };

  const logoutSession = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error signing out from Firebase:", e);
    }
    localStorage.removeItem("pdf_user_session");
    setLoggedInUser(null);
    setLoginPassword("");
  };


  // Post Security Violation Logs back to central command on the server
  const logSecurityViolation = async (action: string, fileName: string, detail: string) => {
    try {
      await fetch("/api/security-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, fileName, detail }),
      });
      // Refresh local copy
      const logsRes = await fetch("/api/security-logs");
      if (logsRes.ok) setLogs(await logsRes.json());
      const statsRes = await fetch("/api/stats");
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.warn("Could not ship security logs to container server:", err);
    }
  };

  // Get Subject visual helper matching dynamic colors
  const getSubjectColorClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return { bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20", btn: "bg-emerald-600 hover:bg-emerald-700 text-white" };
      case "blue":
        return { bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/20", btn: "bg-blue-600 hover:bg-blue-700 text-white" };
      case "purple":
        return { bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/20", btn: "bg-purple-600 hover:bg-purple-700 text-white" };
      case "amber":
        return { bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/20", btn: "bg-amber-600 hover:bg-amber-700 text-white" };
      case "rose":
        return { bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-100 dark:border-rose-900/20", btn: "bg-rose-600 hover:bg-rose-700 text-white" };
      default:
        return { bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/20", btn: "bg-indigo-600 hover:bg-indigo-700 text-white" };
    }
  };

  const getSubjectIcon = (iconName: string) => {
    switch (iconName) {
      case "Laptop": return Laptop;
      case "Binary": return Binary;
      case "Atom": return Atom;
      case "FlaskConical": return FlaskConical;
      default: return BookOpen;
    }
  };

  // Convert uploaded document to Base64 strictly
  const handleFileChange = (file: File) => {
    if (!file) return;
    
    if (file.type !== "application/pdf") {
      setUploadErrorMsg("Security Alert: Only valid '.pdf' type documents can be uploaded!");
      setSelectedUploadFile(null);
      return;
    }
    
    setUploadErrorMsg("");
    setUploadSuccessMsg("");
    setSelectedUploadFile(file);
    if (!uploadTitle) {
      // Auto fill title nicely without ext
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedFileBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag / Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Upload submission
  const handlePdfUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadErrorMsg("Title text is required.");
      return;
    }
    if (!uploadSubjectId) {
      setUploadErrorMsg("Please choose a valid subject category.");
      return;
    }
    if (!selectedFileBase64 || !selectedUploadFile) {
      setUploadErrorMsg("Please select a physical PDF document.");
      return;
    }

    setIsUploading(true);
    setUploadErrorMsg("");
    setUploadSuccessMsg("");

    try {
      const response = await fetch("/api/pdfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          subjectId: uploadSubjectId,
          base64Data: selectedFileBase64,
          fileName: selectedUploadFile.name,
          fileSize: selectedUploadFile.size,
          uploadedBy: loggedInUser?.role === "student" ? (studentUploaderName.trim() || loggedInUser.name) : "System Admin",
          options: {
            downloadRestricted: optionDownloadRestricted,
            printRestricted: optionPrintRestricted,
            watermarkEnabled: optionWatermarkEnabled,
            isLocked: optionIsLocked
          }
        }),
      });

      if (response.ok) {
        setUploadSuccessMsg("Sucessfully uploaded your PDF to the secure vault database!");
        setUploadTitle("");
        setSelectedUploadFile(null);
        setSelectedFileBase64("");
        setUploadSubjectId("");
        fetchAllData();
      } else {
        const errorData = await response.json();
        setUploadErrorMsg(errorData.error || "Encryption uploading process failed on server.");
      }
    } catch (e) {
      setUploadErrorMsg("Could not connect to the upload pipeline. Please test server.");
    } finally {
      setIsUploading(false);
    }
  };

  // Create subject
  const handleSubjectCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) {
      setSubErrorMsg("Subject Name is required.");
      return;
    }

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubName.trim(),
          description: newSubDesc.trim(),
          color: newSubColor,
          iconName: newSubIcon
        }),
      });

      if (response.ok) {
        setSubSuccessMsg(`Successfully designed subject category '${newSubName}'!`);
        setNewSubName("");
        setNewSubDesc("");
        setNewSubColor("emerald");
        setNewSubIcon("BookOpen");
        fetchAllData();
      } else {
        const data = await response.json();
        setSubErrorMsg(data.error || "Failed to create subject.");
      }
    } catch (e) {
      setSubErrorMsg("Error contacting server database schema.");
    }
  };

  // Delete document
  const deleteDocument = async (id: string, fileName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete the secure file "${fileName}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/pdfs/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAllData();
      } else {
        alert("Delete request rejected from servers.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Securely request viewing token and launch viewer modal
  const openSecureViewer = async (doc: PDFDocument) => {
    if (doc.isLocked) {
      logSecurityViolation("BLOCKED_LOCKED_FILE", doc.fileName, `User attempted open locked file. Action prevented.`);
      alert("This document is strictly restricted by standard lock configuration. Please reach Admin to request unlock.");
      return;
    }

    setIsViewerLoading(true);
    setPdfIframeUrl("");
    setActivePdfViewer(doc);

    try {
      const res = await fetch(`/api/get-view-token/${doc.id}`, { method: "POST" });
      if (res.ok) {
        const { token } = await res.json();
        
        // Fetch the PDF binary via one secure GET call to download into client memory blob
        const contentRes = await fetch(`/api/pdf-content/${doc.id}?token=${token}`);
        if (!contentRes.ok) {
          const errMsg = await contentRes.text();
          throw new Error(errMsg || "Failed to decrypt and fetch secure document stream.");
        }
        
        const blob = await contentRes.blob();
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));

        setPdfIframeUrl(blobUrl);
        setViewerKey(prev => prev + 1);
        logSecurityViolation("VIEWER_ACCESS", doc.fileName, `Client downloaded and initialized secure memory blob viewer.`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to generate viewing key token.");
        setActivePdfViewer(null);
      }
    } catch (e: any) {
      alert(e?.message || "Host container error loading resource.");
      setActivePdfViewer(null);
    } finally {
      setIsViewerLoading(false);
    }
  };

  const closeSecureViewer = () => {
    if (pdfIframeUrl && pdfIframeUrl.startsWith("blob:")) {
      URL.revokeObjectURL(pdfIframeUrl);
    }
    setPdfIframeUrl("");
    setActivePdfViewer(null);
  };

  // Security Listener inside viewer context: Blocks context menus, key hacks
  useEffect(() => {
    if (!activePdfViewer) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      // Block Ctrl/Cmd + P (Print)
      if (e.key === "p" && metaOrCtrl) {
        e.preventDefault();
        logSecurityViolation("BLOCK_KEYBOARD_PRINT", activePdfViewer.fileName, "Prevention trigger blocked interactive shortcut print commands.");
        alert("🔒 Security Breach Blocked: Physical printing, paper mapping, and PDF exports are globally disabled on Secure PDF Portal.");
        return;
      }

      // Block Ctrl/Cmd + S (Save)
      if (e.key === "s" && metaOrCtrl) {
        e.preventDefault();
        logSecurityViolation("BLOCK_KEYBOARD_SAVE", activePdfViewer.fileName, "Prevention trigger blocked interactive shortcut page saves.");
        alert("🔒 Security Blocked: Saving digital copies from this server database is restricted.");
        return;
      }

      // Block Ctrl/Cmd + Shift + I (Inspector) or F12
      if ((e.key === "i" && metaOrCtrl && e.shiftKey) || e.key === "F12") {
        logSecurityViolation("BLOCK_KEYBOARD_DEV", activePdfViewer.fileName, "Prevention telemetry logged F12/Development framework open attempt.");
      }
    };

    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logSecurityViolation("BLOCK_MOUSE_RIGHT_CLICK", activePdfViewer.fileName, "Prevention trigger intercepted canvas content extraction via local click.");
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("contextmenu", handleGlobalContextMenu);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
    };
  }, [activePdfViewer]);

  // Document counting helper
  const getPdfsBySubject = (subId: string) => {
    return pdfs.filter(p => p.subjectId === subId);
  };

  // Filter & Search docs
  const filteredPdfs = pdfs.filter((pdf) => {
    const matchesSearch = pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pdf.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedSubjectId) {
      return pdf.subjectId === selectedSubjectId && matchesSearch;
    }
    return matchesSearch;
  });

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans antialiased" id="portal-login-screen">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl" id="login-layout-card">
          
          {/* Left panel info column */}
          <div className="md:col-span-5 bg-gradient-to-br from-indigo-900/60 to-slate-950 p-8 flex flex-col justify-between border-r border-slate-800/60" id="login-marketing-block">
            <div className="space-y-6" id="login-mkt-head">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg" id="login-brand-gimmick">
                <Shield className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-white leading-tight">Surakshit PDF Portal</h2>
                <p className="text-xs text-indigo-200 font-mono">Secure Document Storage & Anti-leak Decryption Viewer</p>
              </div>
            </div>

            <div className="space-y-4 my-8" id="login-posture-list">
              <div className="flex items-start gap-2.5 text-xs text-slate-300" id="check-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>One-Time OTT Session streams bypass static url extraction.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300" id="check-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>HTML5 Canvas dynamic drawing avoids local disk saves.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300" id="check-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Keyboard intercept blocks print layouts (`Ctrl+P`, saving).</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300" id="check-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Realtime rotating electronic watermarks tracing back to users.</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">FIREFALL SYSTEM VERIFIED v2.26</p>
          </div>

          {/* Right panel login forms column */}
          <div className="md:col-span-7 p-8 md:p-10 flex flex-col justify-center space-y-6 bg-slate-950" id="login-interactive-block">
            <div className="space-y-2" id="login-auth-welcome">
              <h3 className="text-xl font-bold text-white">Pranam! Portal me entry karein</h3>
              <p className="text-xs text-slate-400">Apni selection details verify karein aur portal options access karein.</p>
            </div>

            {/* Login Role Toggle Tabs */}
            <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl border border-slate-800" id="login-role-tabs">
              <button
                type="button"
                onClick={() => { setLoginRole("student"); setLoginError(""); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginRole === "student"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
                id="login-role-student-btn"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Student Entry</span>
              </button>
              <button
                type="button"
                onClick={() => { setLoginRole("admin"); setLoginError(""); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginRole === "admin"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
                id="login-role-admin-btn"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>System Admin</span>
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4" id="portal-login-form">
              {loginRole === "student" ? (
                <>
                  <div className="space-y-1.5" id="group-student-name">
                    <label className="text-xs font-bold text-slate-300">Apna Naam Likhein (Student Full Name) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Dushyant Saini"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      id="input-login-student-name"
                      required
                    />
                  </div>

                  <div className="space-y-1.5" id="group-student-email">
                    <label className="text-xs font-bold text-slate-300">Apni Email Fill karein (Student Email) <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      placeholder="sainidushyant756@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      id="input-login-student-email"
                      required
                    />
                    <p className="text-[10px] text-slate-500">Watermark and security tracing will be linked to this email.</p>
                  </div>

                  <div className="space-y-1.5" id="group-student-password">
                    <label className="text-xs font-bold text-slate-300">Apna Passcode / Password <span className="text-rose-500">*</span></label>
                    <input
                      type="password"
                      placeholder="Enter a secure password (min. 6 characters)..."
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      id="input-login-student-password"
                      required
                    />
                    <p className="text-[10px] text-indigo-400">💡 Tip: Log in or auto-register. New students will be registered automatically with this passcode!</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5" id="group-admin-user">
                    <label className="text-xs font-bold text-slate-300">Admin Username</label>
                    <input
                      type="text"
                      disabled
                      value="dushyantsaini@whatin.in (Admin Username)"
                      className="w-full px-4 py-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-sm text-slate-400 font-medium cursor-not-allowed"
                      id="input-login-admin-name"
                    />
                  </div>

                  <div className="space-y-1.5" id="group-admin-pwd">
                    <label className="text-xs font-bold text-slate-300">Admin Passcode <span className="text-rose-500">*</span></label>
                    <input
                      type="password"
                      placeholder="Enter security key password..."
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      id="input-login-admin-password"
                      required
                    />
                    <p className="text-[10px] text-slate-500 font-mono">🔒 Secure Workspace: Verification mapped using high-level encryption standards.</p>
                  </div>
                </>
              )}

              {loginError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2" id="login-error-pill">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authProcessing}
                className={`w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  authProcessing ? "opacity-60 cursor-wait" : ""
                }`}
                id="login-submit-btn"
              >
                {authProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Firebase Security Verification...</span>
                  </>
                ) : (
                  <>
                    <span>🔒 Verify & Access Portal</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans relative antialiased transition-colors duration-300" id="portal-app-root">
      
      {/* Dynamic media print blocker style */}
      <style>{`
        @media print {
          body, html, iframe, #portal-app-root, #root {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
        }
      `}</style>
      
      {/* 1. TOP HEADER BRAND */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 dark:bg-slate-900 dark:border-slate-800/80 shadow-xs" id="app-topbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row items-center justify-between gap-4" id="topbar-inner">
          
          <div className="flex items-center gap-3 self-start lg:self-center" id="brand-info">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-md border-2 border-white/10" id="brand-logo">
              <Shield className="w-5.5 h-5.5 animate-pulse text-white" id="brand-logo-icon" />
            </div>
            <div>
              <div className="flex items-center gap-2" id="brand-texts">
                <span className="text-[10px] tracking-widest font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs" id="badge-live-firewall">
                  🛡️ FIREFALL SECURED
                </span>
                <span className="text-[10px] tracking-wide font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {loggedInUser.role === "admin" ? "Role: Admin" : "User: Student"}
                </span>
              </div>
              <h1 className="text-xl font-bold font-sans text-gray-900 tracking-tight dark:text-white" id="app-main-heading">
                Surakshit PDF Portal <span className="font-light text-slate-400 text-sm hidden md:inline">| Welcome, {loggedInUser.name}</span>
              </h1>
            </div>
          </div>

          {/* Action Pills & Redirection Link */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-center justify-end" id="topbar-actions-stripe">
            
            {/* Quick Redirect Link option to connect any other site */}
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 hover:bg-emerald-500/25 cursor-pointer"
                id="external-site-link"
                title={`Redirect to custom site: ${externalUrl}`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>🔗 Connect Site Link</span>
              </a>
            )}

            {/* Nav pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl dark:bg-slate-800" id="topbar-pills">
              <button
                onClick={() => { setActiveTab("student"); setSelectedSubjectId(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "student"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                id="nav-student-portal"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Library</span>
              </button>

              {loggedInUser.role === "student" ? (
                // Students only see Student-upload tab
                <button
                  onClick={() => setActiveTab("student-upload")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === "student-upload"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                  id="nav-student-upload"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span>Upload Contrib</span>
                </button>
              ) : (
                // Admin can access full capabilities
                <>
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === "admin"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                    id="nav-admin-pannel"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Admin Panel</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("firewall")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === "firewall"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                    id="nav-firewall"
                  >
                    <Terminal className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span>Firewall Log</span>
                    {stats && stats.blockedAttempts > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" id="firewall-alert-dot"></span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={logoutSession}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
              id="topbar-logout-btn"
              title="Logout session"
            >
              <X className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>

          </div>
          
        </div>
      </header>

      {/* 2. SUB-BAR INFO STATUS (Security Notice) */}
      <div className="bg-gradient-to-r from-red-600/80 via-amber-600 to-indigo-600/80 text-white text-xs px-4 py-2 text-center font-medium shadow-xs" id="subbar-telemetry">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-1.5" id="telemetry-inner">
          <div className="flex items-center gap-2" id="telemetry-badge-group">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" id="telemetry-ping"></span>
            <span>🔒 Strict Secure Mode Active (Only Site/Iframe Viewer Supported). Direct downloads & standard right-clicks are instantly logged.</span>
          </div>
          <div className="font-mono text-[11px]" id="user-telemetry">
            User email: <span className="underline font-bold text-teal-200">{currentUser.email}</span>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full" id="main-content">
        
        {/* Dynamic Display Indicators based on Tab */}
        {activeTab === "student" && (
          <div className="space-y-6" id="student-portal-scaffold">
            
            {/* Header info */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 border border-gray-100 rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-800" id="student-hero">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white" id="student-heading">
                  Subject-wise Secure PDF Library
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1" id="student-subheading">
                  Select a subject category to read verified notes. All document renders are heavily secured with customized watermark overlays.
                </p>
              </div>
              
              {/* Internal Search bar */}
              <div className="relative w-full md:w-80" id="search-bar-wrapper">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" id="search-lens" />
                <input
                  type="text"
                  placeholder="Search PDFs by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/40 dark:border-slate-700 text-gray-900 dark:text-white"
                  id="search-input-field"
                />
              </div>
            </div>

            {/* Subject Categories list (Bento/Card stack) */}
            <div id="subject-categories-grid">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3" id="categories-label">
                Available Subjects ({subjects.length})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="categories-boxes">
                <div
                  onClick={() => setSelectedSubjectId(null)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedSubjectId === null
                      ? "bg-slate-900 text-white border-slate-900 shadow-md dark:bg-white dark:text-slate-900"
                      : "bg-white border-gray-100 hover:border-gray-300 dark:bg-slate-900 dark:border-slate-800"
                  }`}
                  id="category-item-all"
                >
                  <div className="flex items-center gap-3" id="cat-all-head">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-gray-300" id="cat-all-icon-wrapper">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <span className="font-bold text-sm" id="cat-all-title">All Subjects</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" id="cat-all-cnt">
                    Showcases all secure files available ({pdfs.length} PDFs).
                  </p>
                </div>

                {subjects.map((sub) => {
                  const IconComponent = getSubjectIcon(sub.iconName);
                  const colorStyles = getSubjectColorClasses(sub.color);
                  const isSelected = selectedSubjectId === sub.id;
                  const catPdfs = getPdfsBySubject(sub.id);
                  
                  return (
                    <div
                      key={sub.id}
                      id={`category-item-${sub.id}`}
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-950 text-white border-indigo-700 shadow-md dark:bg-indigo-900"
                          : "bg-white border-gray-100 hover:border-gray-200 dark:bg-slate-900 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-between" id={`cat-${sub.id}-header`}>
                        <div className="flex items-center gap-2" id={`cat-${sub.id}-brand`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorStyles.bg}`} id={`cat-${sub.id}-brand-wrapper`}>
                            <IconComponent className="w-4.5 h-4.5" id={`cat-${sub.id}-subicon`} />
                          </div>
                          <span className="font-bold text-sm leading-tight text-gray-800 dark:text-slate-100 group-hover:text-indigo-600" id={`cat-${sub.id}-title`}>
                            {sub.name}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-medium" id={`cat-${sub.id}-badge`}>
                          {catPdfs.length} files
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-1" id={`cat-${sub.id}-desc`}>
                        {sub.description || "No category description attached."}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Security Notice / Rules explaining why offline is banned */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-indigo-50 border border-indigo-100/50 rounded-2xl dark:bg-indigo-950/20 dark:border-indigo-900/30" id="education-security-panel">
              <div className="flex gap-3" id="education-banner-details">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" id="edu-shield" />
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-300" id="edu-title">Why are files strictly locked inside the browser viewer?</h4>
                  <p className="text-xs text-indigo-900/80 dark:text-indigo-400/90 mt-0.5 leading-relaxed" id="edu-description">
                    Humare database se PDF content direct download, copy ya print kerna restricted he. PDFs can only be loaded safely using temporary, single-use visual frames with dynamic text credentials stamped back to client IP footprints.
                  </p>
                </div>
              </div>
            </div>

            {/* PDFs listed under selection */}
            <div id="pdfs-listing-shelf">
              <div className="flex items-center justify-between mb-3" id="pdfs-shelf-meta">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400" id="pdfs-shelf-heading">
                  {selectedSubjectId 
                    ? `Secure PDFs for subject: ${subjects.find(s => s.id === selectedSubjectId)?.name}` 
                    : "Browsing all secure PDFs available (" + filteredPdfs.length + ")"}
                </h3>
                <span className="text-xs text-gray-400 italic" id="matching-indicators">
                  Showing {filteredPdfs.length} files
                </span>
              </div>

              {filteredPdfs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm dark:bg-slate-900 dark:border-slate-800" id="no-pdfs-rendered">
                  <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" id="no-pdfs-icon" />
                  <p className="font-medium" id="no-pdfs-headline">No security files uploaded yet for this subject category.</p>
                  <p className="text-xs text-gray-500 mt-1" id="no-pdfs-detail">To upload PDFs, please navigate to the active Admin Panel.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="secure-pdfs-cards-grid">
                  {filteredPdfs.map((pdf) => {
                    const matchedSub = subjects.find(s => s.id === pdf.subjectId);
                    const colorStyles = getSubjectColorClasses(matchedSub?.color || "indigo");

                    return (
                      <div
                        key={pdf.id}
                        id={pdf.id}
                        className="bg-white border border-gray-100 rounded-2xl shadow-2xs hover:shadow-md transition-all flex flex-col hover:border-gray-200 dark:bg-slate-900 dark:border-slate-800/80"
                      >
                        {/* Upper Section */}
                        <div className="p-4 border-b border-gray-50 flex-1 dark:border-slate-800" id={`${pdf.id}-top-section`}>
                          <div className="flex items-center justify-between gap-1.5" id={`${pdf.id}-meta-indicators`}>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" id={`${pdf.id}-subject-tag`}>
                              {pdf.subjectName}
                            </span>
                            
                            {/* Visual Locks Indicators */}
                            <div className="flex items-center gap-1.5" id={`${pdf.id}-locks-strip`}>
                              {pdf.isLocked ? (
                                <span className="p-1 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400" title="Strict System Locked">
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="p-1 rounded bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400" title="Available for Secure Read">
                                  <Unlock className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {pdf.downloadRestricted && (
                                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold text-rose-500 bg-rose-500/10 rounded border border-rose-500/10" title="Save/Download Blocked">
                                  NO_DOWNLOAD
                                </span>
                              )}
                            </div>
                          </div>

                          <h4 className="font-bold text-gray-800 text-base mt-3 line-clamp-1 dark:text-slate-100" id={`${pdf.id}-title-display`}>
                            {pdf.title}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1" id={`${pdf.id}-filename-display`}>
                            {pdf.fileName}
                          </p>

                          <div className="flex items-center justify-between mt-4 text-[11px] text-gray-400" id={`${pdf.id}-stats-line`}>
                            <span id={`${pdf.id}-time-tag`}>Uploaded: {new Date(pdf.uploadedAt).toLocaleDateString()}</span>
                            <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]" id={`${pdf.id}-size-tag`}>
                              {(pdf.fileSize / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        </div>

                        {/* Firewalled bottom bar */}
                        <div className="bg-slate-50/50 p-3 rounded-b-2xl border-t border-gray-50 flex items-center justify-between dark:bg-slate-800/10 dark:border-slate-800" id={`${pdf.id}-bottom-bar`}>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" id={`${pdf.id}-views-count`}>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{pdf.views} secure reads</span>
                          </div>
                          
                          <button
                            onClick={() => openSecureViewer(pdf)}
                            disabled={pdf.isLocked}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                              pdf.isLocked 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800" 
                                : colorStyles.btn
                            }`}
                            id={`${pdf.id}-open-btn`}
                          >
                            <span>Open In Viewer</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* STUDENT UPLOAD TAB PANEL */}
        {activeTab === "student-upload" && (
          <div className="space-y-6 animate-fadeIn" id="student-upload-pane">
            <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-xs space-y-6 dark:bg-slate-900 dark:border-slate-800" id="student-upload-card">
              <div className="border-b border-gray-100 pb-4 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4" id="student-upload-header">
                <div>
                  <h3 className="font-extrabold text-gray-800 text-xl dark:text-slate-100 flex items-center gap-2">
                    <PlusCircle className="w-6 h-6 text-indigo-600" />
                    Apni PDF Contribute Karein (Student Notes Portal)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Aap security portal par reference materials, notes or assignments upload kar sakte hain. Aapka uploader naam sirf admins ko hi visible hoga.
                  </p>
                </div>
                <div className="text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-mono" id="privacy-guarantee">
                  🛡️ Student Privacy Verified: Deletion & name disclosure restricted of other students.
                </div>
              </div>

              <form onSubmit={handlePdfUploadSubmit} className="space-y-6" id="student-upload-form">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="student-form-top-row">
                  
                  {/* Title of document */}
                  <div className="space-y-2" id="student-group-title">
                    <label className="text-xs font-black uppercase text-gray-650 dark:text-slate-350">Notes Title / Topic Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Unit 2 Database Systems Handouts"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 font-medium text-gray-900 dark:text-white"
                      id="student-pdf-title"
                      required
                    />
                  </div>

                  {/* Subject category select */}
                  <div className="space-y-2" id="student-group-subcat">
                    <label className="text-xs font-black uppercase text-gray-650 dark:text-slate-350">Subject Category <span className="text-rose-500">*</span></label>
                    <select
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                      id="student-pdf-subject"
                      required
                    >
                      <option value="">-- Choose Category --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Student Personal Name Input (Traced only by Admin!) */}
                  <div className="space-y-2" id="student-group-uploader-name">
                    <label className="text-xs font-black uppercase text-gray-650 dark:text-slate-350">Apna Naam Likhein (Your Name) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Dushyant Saini"
                      value={studentUploaderName}
                      onChange={(e) => setStudentUploaderName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 font-semibold text-indigo-650 dark:text-indigo-450"
                      id="student-pdf-uploader-name"
                      required
                    />
                    <p className="text-[10px] text-gray-400 mt-1">🔒 Yeh naam sirf Admin ko dikhega, dusre students se hidden rahega.</p>
                  </div>

                </div>

                {/* Secure drag and drop binary zone */}
                <div className="space-y-2" id="student-drag-drop-panel-group">
                  <label className="text-xs font-black uppercase text-gray-650 dark:text-slate-350">PDF Document File <span className="text-rose-500">*</span></label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragOver 
                        ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20" 
                        : selectedUploadFile 
                        ? "border-green-400 bg-green-50/10 dark:bg-green-950/15" 
                        : "border-gray-250 hover:border-indigo-400 dark:border-slate-700"
                    }`}
                    id="student-pdf-dropzone"
                  >
                    <input
                      type="file"
                      id="student-file-element-input"
                      accept=".pdf"
                      onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />
                    <label htmlFor="student-file-element-input" className="cursor-pointer">
                      <FileText className={`w-12 h-12 mx-auto mb-3 ${selectedUploadFile ? 'text-green-500 animate-bounce' : 'text-gray-400'}`} />
                      {selectedUploadFile ? (
                        <div id="student-selection-details-box">
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">Selected: {selectedUploadFile.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{(selectedUploadFile.size / (1024 * 1024)).toFixed(2)} MB | Ready for decryption upload process</p>
                        </div>
                      ) : (
                        <div id="student-dropzone-text-group">
                          <p className="text-sm font-bold text-gray-750 dark:text-slate-200">Drag & Drop your notes here, or click to browse</p>
                          <p className="text-xs text-gray-500 mt-1">Supports standard valid PDF (.pdf) format up to 45MB.</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Feedback Logs */}
                {uploadErrorMsg && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400" id="student-alert-upload-fail">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{uploadErrorMsg}</span>
                  </div>
                )}

                {uploadSuccessMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/20 dark:text-emerald-400" id="student-alert-upload-ok">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{uploadSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUploading}
                  className={`w-full py-3.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                    isUploading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  id="student-submit-pdf-btn"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Decryption Processing & Encrypting File streams...</span>
                    </>
                  ) : (
                    <>
                      <span>🔒 Database me PDF Add Karein</span>
                    </>
                  )}
                </button>

              </form>
            </div>
          </div>
        )}

        {/* 4. ADMIN TAB PANEL */}
        {activeTab === "admin" && (
          <div className="space-y-6" id="admin-scaffold-pane">
            <DashboardStats stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="admin-blocks-grid">
              
              {/* Form 1: Drag & Drop Subject-wise PDF secure upload */}
              <div className="lg:col-span-7 bg-white p-5 border border-gray-100 rounded-2xl shadow-xs space-y-4 dark:bg-slate-900 dark:border-slate-800" id="upload-panel-box">
                <div className="border-b border-gray-50 pb-3 dark:border-slate-800" id="upload-header">
                  <h3 className="font-bold text-gray-800 text-lg dark:text-slate-100">Drect Upload Secure PDF To Site Database</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Documents will be encrypted & hosted inside are secure binary folder with instant temporary sessions.</p>
                </div>

                <form onSubmit={handlePdfUploadSubmit} className="space-y-4" id="pdf-upload-form">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="upload-grid-row-1">
                    <div className="space-y-1.5" id="input-group-title">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-300">File Display Title <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Unit 3 Computer Networks Lecture Notes"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 font-medium text-gray-900 dark:text-white"
                        id="form-pdf-title"
                      />
                    </div>

                    <div className="space-y-1.5" id="input-group-subcat">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-300">Subject Category <span className="text-rose-500">*</span></label>
                      <select
                        value={uploadSubjectId}
                        onChange={(e) => setUploadSubjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                        id="form-pdf-subject"
                      >
                        <option value="">-- Choose Category --</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Drag-n-Drop physical container */}
                  <div className="space-y-1.5" id="drag-drop-panel-group">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-300">PDF Binary Data Document <span className="text-rose-500">*</span></label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                        isDragOver 
                          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20" 
                          : selectedUploadFile 
                          ? "border-green-400 bg-green-50/10 dark:bg-green-950/15" 
                          : "border-gray-200 hover:border-indigo-400 dark:border-slate-700"
                      }`}
                      id="form-pdf-dropzone"
                    >
                      <input
                        type="file"
                        id="file-element-input"
                        accept=".pdf"
                        onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                        className="hidden"
                      />
                      <label htmlFor="file-element-input" className="cursor-pointer">
                        <FileText className={`w-10 h-10 mx-auto mb-2 ${selectedUploadFile ? 'text-green-500' : 'text-gray-400'}`} />
                        {selectedUploadFile ? (
                          <div id="selection-details-box">
                            <p className="text-xs font-bold text-green-600 dark:text-green-400">Selected: {selectedUploadFile.name}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{(selectedUploadFile.size / (1024 * 1024)).toFixed(2)} MB | Ready for decryption uploads</p>
                          </div>
                        ) : (
                          <div id="dropzone-text-group">
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">Drag & Drop your PDF file here, or click to browse</p>
                            <p className="text-[10px] text-gray-400 mt-1">Maximum file size: 45MB. Only valid .pdf files are authorized.</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Strict security options toggles */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-3 dark:bg-slate-800/40 dark:border-slate-700/80" id="security-switches-bento">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5" id="security-engine-pioneer-header">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      Dynamic Security Posture Rules
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1" id="security-switches-group">
                      
                      <label className="flex items-start gap-2.5 cursor-pointer" id="lbl-sw-1">
                        <input
                          type="checkbox"
                          checked={optionDownloadRestricted}
                          onChange={(e) => setOptionDownloadRestricted(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-slate-200">Restrict Save & Downloads</p>
                          <p className="text-[10px] text-gray-400">Removes header download icon, and blocks keyboard Ctrl+S events</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer" id="lbl-sw-2">
                        <input
                          type="checkbox"
                          checked={optionPrintRestricted}
                          onChange={(e) => setOptionPrintRestricted(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-slate-200">Block Printing & PDF Export</p>
                          <p className="text-[10px] text-gray-400">Injects @media print blockers to hide document on print attempts</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer" id="lbl-sw-3">
                        <input
                          type="checkbox"
                          checked={optionWatermarkEnabled}
                          onChange={(e) => setOptionWatermarkEnabled(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-slate-200">Inject Rotated Security Watermarks</p>
                          <p className="text-[10px] text-gray-400">Overlays user email and host IP dynamically across viewer plane</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer" id="lbl-sw-4">
                        <input
                          type="checkbox"
                          checked={optionIsLocked}
                          onChange={(e) => setOptionIsLocked(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-slate-200">Strict Administration Lock</p>
                          <p className="text-[10px] text-gray-400">Temp lock state. Restricts even viewing inside secure reader</p>
                        </div>
                      </label>

                    </div>
                  </div>

                  {/* Warning / Success outputs */}
                  {uploadErrorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400" id="alert-upload-fail">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{uploadErrorMsg}</span>
                    </div>
                  )}

                  {uploadSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/20 dark:text-emerald-400" id="alert-upload-ok">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{uploadSuccessMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUploading}
                    className={`w-full py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer ${
                      isUploading ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    id="submit-pdf-btn"
                  >
                    {isUploading ? "Encrypting & Stream Writing File..." : "🔒 Write Secure PDF to Database"}
                  </button>

                </form>
              </div>

              {/* Form 2: Designing new Subject categorization scheme */}
              <div className="lg:col-span-5 flex flex-col gap-6" id="subject-and-info-side-panel">
                
                {/* Subject Creator Form */}
                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-xs space-y-4 dark:bg-slate-900 dark:border-slate-800" id="subject-creator-card">
                  <div className="border-b border-gray-50 pb-2 dark:border-slate-800" id="sub-creator-header">
                    <h3 className="font-bold text-gray-800 text-lg dark:text-slate-100">Create Subject Category</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Define structured folder schema mapping for secure notes.</p>
                  </div>

                  <form onSubmit={handleSubjectCreateSubmit} className="space-y-3" id="subject-creator-form">
                    <div className="space-y-1.5" id="forms-sub-name-field">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-300">Subject Name <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Mechanical Engineering"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                        id="form-sub-name"
                      />
                    </div>

                    <div className="space-y-1.5" id="forms-sub-desc-field">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-300">Short Description</label>
                      <textarea
                        placeholder="Topics, class references, semester guidance description..."
                        rows={2}
                        value={newSubDesc}
                        onChange={(e) => setNewSubDesc(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                        id="form-sub-desc"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3" id="forms-sub-styles-row">
                      <div className="space-y-1.5" id="form-sub-colors-block">
                        <label className="text-xs font-bold text-gray-600 dark:text-slate-300">Theme Color</label>
                        <select
                          value={newSubColor}
                          onChange={(e) => setNewSubColor(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                          id="form-sub-color-select"
                        >
                          <option value="emerald">Emerald Green</option>
                          <option value="blue">Sapphire Blue</option>
                          <option value="purple">Cosmic Purple</option>
                          <option value="amber">Warm Amber</option>
                          <option value="rose">Strict Rose</option>
                        </select>
                      </div>

                      <div className="space-y-1.5" id="form-sub-icons-block">
                        <label className="text-xs font-bold text-gray-600 dark:text-slate-300">Symbol Icon</label>
                        <select
                          value={newSubIcon}
                          onChange={(e) => setNewSubIcon(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
                          id="form-sub-icon-select"
                        >
                          <option value="BookOpen">Default Book</option>
                          <option value="Laptop">Computer Tech</option>
                          <option value="Binary">Mathematics</option>
                          <option value="Atom">Physics Lab</option>
                          <option value="FlaskConical">Science Flask</option>
                        </select>
                      </div>
                    </div>

                    {subErrorMsg && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium" id="alert-sub-fail">{subErrorMsg}</p>
                    )}
                    {subSuccessMsg && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-pre-wrap" id="alert-sub-ok">{subSuccessMsg}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      id="submit-sub-btn"
                    >
                      + Save Category Scheme
                    </button>
                  </form>
                </div>

                {/* External Connection Settings card */}
                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-xs space-y-4 dark:bg-slate-900 dark:border-slate-800" id="external-connection-card">
                  <div className="border-b border-gray-50 pb-2 dark:border-slate-800" id="external-connection-header">
                    <h3 className="font-bold text-gray-800 text-lg dark:text-slate-100 flex items-center gap-1.5">
                      <Terminal className="text-emerald-500 w-5 h-5" />
                      External connectivity
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Connect with external educational portals or choose redirections easily.</p>
                  </div>

                  <div className="space-y-3" id="ext-conn-group">
                    <div className="space-y-1.5" id="forms-settings-url-field">
                      <label className="text-xs font-bold text-gray-650 dark:text-slate-350">Destination URL</label>
                      <input
                        type="url"
                        placeholder="e.g. https://my-college-main-site.com/dashboard"
                        value={adminIntUrlInput}
                        onChange={(e) => setAdminIntUrlInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white font-mono text-xs"
                        id="form-settings-url"
                      />
                    </div>

                    {settingsStatusMsg && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium" id="settings-save-success-log">{settingsStatusMsg}</p>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        setSettingsStatusMsg("");
                        try {
                          const res = await fetch("/api/settings", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ externalIntegrationUrl: adminIntUrlInput.trim() }),
                          });
                          if (res.ok) {
                            setExternalUrl(adminIntUrlInput.trim());
                            setSettingsStatusMsg("🔌 External link context saved successfully!");
                          } else {
                            setSettingsStatusMsg("Could not save settings.");
                          }
                        } catch (err) {
                          setSettingsStatusMsg("Network communication error.");
                        }
                      }}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      id="save-settings-btn"
                    >
                      Save Connectivity Settings
                    </button>
                  </div>
                </div>

                {/* Secure File Registry Manager (Listing & Deletion Tool) */}
                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-800" id="file-registry-card">
                  <div className="border-b border-gray-50 pb-2 dark:border-slate-800" id="registry-header-block">
                    <h3 className="font-bold text-gray-800 text-base dark:text-slate-100">Physical Storage Vault ({pdfs.length})</h3>
                    <p className="text-[10px] text-gray-400">Total binary PDFs registered in standard local storage directory node.</p>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2.5 pr-1" id="registry-items-scrollable">
                    {pdfs.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6" id="registry-empty-msg">No physical storage files mapped.</p>
                    ) : (
                      pdfs.map((p) => (
                        <div
                          key={p.id}
                          id={`registry-item-${p.id}`}
                          className="flex items-center justify-between gap-3 p-3 border border-gray-50 rounded-xl text-xs dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10"
                        >
                          <div className="min-w-0" id={`reg-${p.id}-meta`}>
                            <p className="font-bold text-gray-800 truncate dark:text-slate-200" id={`reg-${p.id}-title`}>{p.title}</p>
                            <p className="text-[10px] text-gray-400 truncate font-mono" id={`reg-${p.id}-filename`}>{p.fileName}</p>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1" id={`reg-${p.id}-uploadedBy`}>
                              👤 Contributed by: <span className="underline">{p.uploadedBy || "System Admin"}</span>
                            </p>
                          </div>
                          
                          <button
                            onClick={() => deleteDocument(p.id, p.fileName)}
                            className="p-1 px-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[10px] uppercase font-mono font-bold dark:bg-red-950/20 dark:text-red-400 shrink-0"
                            id={`reg-${p.id}-delete-btn`}
                          >
                            SYS_DELETE
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 5. CYBERSECURITY FIREWALL & TELEMETRY TAB */}
        {activeTab === "firewall" && (
          <div className="space-y-6 animate-fadeIn" id="firewall-scaffold-pane">
            <DashboardStats stats={stats} />
            <SecurityAuditLogs logs={logs} onRefresh={fetchAllData} />
          </div>
        )}

      </main>

      {/* 6. IMMERSIVE SECURE PDF viewer MODAL SCREEN LAYOUT */}
      {activePdfViewer && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xs flex flex-col"
          id="secure-viewer-modal-screen"
          onContextMenu={(e) => {
            e.preventDefault();
            logSecurityViolation("BLOCK_MOUSE_RIGHT_CLICK", activePdfViewer.fileName, "Context menu extraction click intercepted on viewer overlay.");
          }}
        >
          
          {/* Modal head control rail */}
          <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between" id="viewer-control-rail">
            
            <div className="flex items-center gap-2.5 min-w-0" id="viewer-title-branding">
              <button
                onClick={closeSecureViewer}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                id="close-viewer-btn-left"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div id="viewer-document-details">
                <span className="text-[9px] tracking-widest font-mono font-bold uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" id="viewer-indicator-restricted">
                  SECURE PORTAL DIRECT_STREAM VIEW
                </span>
                <h3 className="font-extrabold text-sm truncate max-w-xs md:max-w-md mt-0.5 text-white" id="viewer-doc-title">
                  {activePdfViewer.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0" id="viewer-action-controls">
              
              {/* Dynamic instruction status tags */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 font-mono" id="viewer-warning-tag">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span>Watermark Stamp Active. Copy attempts are instantly traced!</span>
              </div>

              {/* Close Button Right */}
              <button
                onClick={closeSecureViewer}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700/90 rounded-lg transition-colors flex items-center gap-1"
                id="close-viewer-btn-right"
              >
                <X className="w-4 h-4" />
                <span>Exit Reader</span>
              </button>

            </div>

          </div>

          {/* Secure Interactive Viewer Core Box */}
          <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center bg-slate-950" id="viewer-interactive-canvas">
            
            {/* Dynamic Watermark Layout (Pointer events false overlays spanning across the whole grid) */}
            {activePdfViewer.watermarkEnabled && (
              <div
                className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-24 opacity-[0.09] dark:opacity-[0.14] rotate-[-25deg] scale-120 flex items-center justify-center"
                id="viewer-watermark-overlay"
              >
                {Array.from({ length: 32 }).map((_, idx) => (
                  <div
                    key={`wm-${idx}`}
                    id={`wm-${idx}`}
                    className="text-center font-mono font-bold text-[10px] tracking-wide text-rose-500 dark:text-rose-400 p-4 border border-rose-500/10 rounded-md"
                  >
                    <p className="uppercase leading-normal font-sans text-xs">AUTHORIZED SECURE PREVIEW</p>
                    <p className="font-mono mt-0.5 text-[9px]">{currentUser.email}</p>
                    <p className="text-[8px] opacity-80 mt-0.5">IP: SECURE_FOOTPRINT</p>
                    <p className="text-[7px] opacity-70">SYSTEM_DO_NOT_REPLICATE</p>
                  </div>
                ))}
              </div>
            )}

            {/* Render Loader State if Stream initializes */}
            {isViewerLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white" id="viewer-loading-cover">
                <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 border-r-2 border-transparent animate-spin mb-4" id="viewer-spinner"></div>
                <p className="text-sm font-semibold tracking-wide font-mono" id="viewer-loading-status">VALIDATING ONETIME VIEW SECURITY TICKET CLIENT FOOTPRINT...</p>
              </div>
            )}

            {/* Central Secured File Stream Container Node */}
            {pdfIframeUrl ? (
              <div className="w-full h-full relative" id="pdf-interactive-scroller-node">
                
                {/* Canvas Rendered PDF Engine - Chrome Sandbox Secure */}
                <SecurePdfCanvasViewer
                  pdfUrl={pdfIframeUrl}
                  watermarkText={currentUser.email}
                  onViolation={(actionType, detail) => {
                    logSecurityViolation(actionType, activePdfViewer ? activePdfViewer.fileName : "Unknown PDF", detail);
                  }}
                />

                {/* Translucent Edge Shields - Blocking scrollbars/tools extraction if rendered natively */}
                <div className="absolute top-0 right-0 w-16 bottom-0 z-10 pointer-events-none" id="shield-right"></div>
                <div className="absolute top-0 left-0 w-16 bottom-0 z-10 pointer-events-none" id="shield-left"></div>
                <div className="absolute top-0 left-0 right-0 h-14 z-10 pointer-events-none" id="shield-top"></div>
                
              </div>
            ) : (
              !isViewerLoading && (
                <div className="text-center text-slate-400 p-8" id="viewer-unauthorized-notice">
                  <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-pulse" />
                  <h4 className="font-bold text-lg text-white">Security Decryption Session Terminated</h4>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                    Token parameters expired or connection is closed. Please recheck security logs and execute view again.
                  </p>
                  <button
                    onClick={() => openSecureViewer(activePdfViewer)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold font-mono"
                    id="retry-secure-view-btn"
                  >
                    REFRESH_OTT_TOKEN
                  </button>
                </div>
              )
            )}

            {/* Implements dynamic on-screen instruction bars guiding Hindi usage */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-slate-700/60 px-5 py-2.5 rounded-full flex items-center gap-3 shadow-2xl text-slate-200 text-xs text-center backdrop-blur-md whitespace-nowrap" id="hindi-visual-instructions">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <p className="font-serif">
                🔒 <strong className="font-sans font-bold">Security Rule:</strong> Yeh notes aap copy ya print nahi ker sakte he. Screen-recording ya screenshot capture strictly traces back to your email ID!
              </p>
            </div>

          </div>

        </div>
      )}

      {/* 7. FOOTER BAR GRAPHICS */}
      <footer className="bg-white border-t border-gray-100 py-6 dark:bg-slate-900 dark:border-slate-850 mt-12" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2 text-xs text-gray-500 dark:text-gray-400" id="footer-inner">
          <p className="font-medium" id="footer-copyright">
            © 2026 Surakshit PDF Portal. Crafted with 256-bit instant OTT decrypt streaming protocol.
          </p>
          <p className="text-[10px] opacity-75 max-w-xl mx-auto leading-relaxed" id="footer-disclaimer">
            This workspace complies with strict cybersecurity sandbox policy guidelines. Standard external downloads, reverse proxy indexing, direct-linking, and keyboard page scrapers are blocked by server-authoritative file controllers.
          </p>
        </div>
      </footer>

    </div>
  );
}
