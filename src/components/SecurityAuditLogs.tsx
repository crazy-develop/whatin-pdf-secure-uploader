import { Terminal, Shield, AlertTriangle, Play, Calendar, User, Key, Trash } from "lucide-react";
import { SecurityLog } from "../types";

interface AuditProps {
  logs: SecurityLog[];
  onRefresh: () => void;
}

export default function SecurityAuditLogs({ logs, onRefresh }: AuditProps) {
  
  const getSeverityStyle = (action: string) => {
    if (action.startsWith("BLOCKED_") || action === "UNAUTHORIZED_ACCESS" || action.includes("KEYBOARD")) {
      return {
        bg: "bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30",
        text: "text-rose-700 dark:text-rose-400",
        bullet: "bg-rose-500",
        icon: AlertTriangle
      };
    }
    if (action === "FILE_UPLOAD" || action === "SUBJECT_CREATE") {
      return {
        bg: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-905/30",
        text: "text-emerald-700 dark:text-emerald-400",
        bullet: "bg-emerald-500",
        icon: Shield
      };
    }
    if (action === "FILE_DELETE") {
      return {
        bg: "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
        bullet: "bg-amber-500",
        icon: Trash
      };
    }
    return {
      bg: "bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800",
      text: "text-slate-600 dark:text-slate-400",
      bullet: "bg-slate-400",
      icon: Terminal
    };
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800" id="audit-logs-card">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between dark:border-slate-800" id="audit-logs-header">
        <div className="flex items-center gap-2" id="audit-title-group">
          <Terminal className="w-5 h-5 text-gray-700 dark:text-slate-300" id="audit-terminal-icon" />
          <h3 className="font-bold text-gray-800 text-lg dark:text-slate-200" id="audit-heading">Security Firewalls & Event Logs</h3>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors font-mono dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          id="refresh-logs-btn"
        >
          SYS_REFRESH
        </button>
      </div>

      <div className="p-5" id="audit-logs-body">
        <p className="text-xs text-gray-500 mb-4 dark:text-gray-400" id="audit-description">
          The applet automatically captures and logs page-interaction anomalies, direct URL scraping attempts, Base64 compilation payloads, and physical deletes with client telemetry.
        </p>

        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200" id="logs-feed">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm" id="no-logs">
              No security events recorded yet.
            </div>
          ) : (
            logs.map((log) => {
              const styles = getSeverityStyle(log.action);
              const LogIcon = styles.icon;
              return (
                <div
                  key={log.id}
                  id={log.id}
                  className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs ${styles.bg}`}
                >
                  <div className="flex items-start gap-3" id={`${log.id}-main-section`}>
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${styles.text} bg-white/60 dark:bg-slate-900/60`} id={`${log.id}-icon-outer`}>
                      <LogIcon className="w-4.5 h-4.5" id={`${log.id}-log-icon`} />
                    </div>
                    <div className="space-y-1" id={`${log.id}-details-block`}>
                      <div className="flex flex-wrap items-center gap-1.5" id={`${log.id}-action-meta`}>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold shrink-0 tracking-wider text-xs ${styles.text} bg-white/80 dark:bg-slate-900/40`} id={`${log.id}-badge`}>
                          {log.action}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-slate-200" id={`${log.id}-filename`}>
                          {log.fileName}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-slate-300 leading-relaxed" id={`${log.id}-details-text`}>
                        {log.detail}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-gray-400" id={`${log.id}-footer-telemetry`}>
                        <span className="flex items-center gap-1" id={`${log.id}-time-label`}>
                          <Calendar className="w-3.5 h-3.5" id={`${log.id}-cal-icon`} />
                          {formatDate(log.timestamp)}
                        </span>
                        <span className="flex items-center gap-1 font-mono" id={`${log.id}-ip-label`}>
                          <User className="w-3.5 h-3.5" id={`${log.id}-user-icon`} />
                          IP: {log.ipAddress}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
