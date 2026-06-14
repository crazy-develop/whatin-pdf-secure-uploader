export interface Subject {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind colour class base, e.g., 'blue', 'purple', 'emerald'
  iconName: string; // Lucide icon identifier
}

export interface PDFDocument {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  views: number;
  downloadRestricted: boolean;
  printRestricted: boolean;
  watermarkEnabled: boolean;
  isLocked: boolean; // Custom access lock
  uploadedBy?: string; // Name of student or admin who uploaded the document
}

export interface SecurityLog {
  id: string;
  action: string; // e.g., 'UPLOAD', 'VIEW', 'DELETE', 'BLOCK_PRINT', 'BLOCK_RIGHT_CLICK'
  fileName: string;
  timestamp: string;
  ipAddress: string;
  detail: string;
}

export interface SystemStats {
  totalPDFs: number;
  totalSubjects: number;
  totalViews: number;
  blockedAttempts: number;
}
