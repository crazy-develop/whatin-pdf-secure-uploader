import { Shield, FileText, Eye, AlertTriangle } from "lucide-react";
import { SystemStats } from "../types";

interface StatsProps {
  stats: SystemStats | null;
}

export default function DashboardStats({ stats }: StatsProps) {
  const defaultStats: SystemStats = stats || {
    totalPDFs: 0,
    totalSubjects: 0,
    totalViews: 0,
    blockedAttempts: 0,
  };

  const items = [
    {
      id: "stat-1",
      title: "Total Secure PDFs",
      value: defaultStats.totalPDFs,
      icon: FileText,
      color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
    },
    {
      id: "stat-2",
      title: "Subject Categories",
      value: defaultStats.totalSubjects,
      icon: Shield,
      color: "text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30",
    },
    {
      id: "stat-3",
      title: "Secure Document Reads",
      value: defaultStats.totalViews,
      icon: Eye,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
    },
    {
      id: "stat-4",
      title: "Prevented Leak Attempts",
      value: defaultStats.blockedAttempts,
      icon: AlertTriangle,
      color: defaultStats.blockedAttempts > 0 
        ? "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 animate-pulse"
        : "text-gray-600 bg-gray-50 border-gray-100 dark:bg-gray-850 dark:border-gray-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5" id="stats-container">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            id={item.id}
            className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all hover:scale-[1.02] hover:shadow-md dark:bg-slate-900 dark:border-slate-800"
          >
            <div className={`p-3 rounded-xl border ${item.color}`} id={`${item.id}-icon-wrapper`}>
              <Icon className="w-6 h-6" id={`${item.id}-icon`} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400" id={`${item.id}-title`}>
                {item.title}
              </p>
              <h3 className="text-2xl font-bold font-sans mt-0.5 text-gray-800 dark:text-gray-100" id={`${item.id}-value`}>
                {item.value}
              </h3>
            </div>
          </div>
        );
      })}
    </div>
  );
}
