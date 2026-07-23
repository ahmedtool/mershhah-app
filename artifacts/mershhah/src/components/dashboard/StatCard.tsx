import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
}

export default function StatCard({ title, value, icon: Icon, change }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-400">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      </div>
      <div className="text-xl font-black text-gray-900">{value}</div>
      {change && <p className="text-[10px] text-gray-300 mt-1">{change}</p>}
    </div>
  );
}
