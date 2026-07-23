"use client";

import { Building2, User } from "lucide-react";
import { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RestaurantsTableProps {
  restaurants: Profile[];
  selectedProfileId: string | null;
  onProfileSelect: (profile: Profile) => void;
}

const statusConfig = {
  active: { text: "نشط", dot: "bg-emerald-400" },
  pending: { text: "بانتظار", dot: "bg-amber-400" },
  suspended: { text: "معلق", dot: "bg-red-400" },
};

export function RestaurantsTable({ restaurants, selectedProfileId, onProfileSelect }: RestaurantsTableProps) {
  return (
    <div className="divide-y divide-gray-50">
      {restaurants && restaurants.length > 0 ? restaurants.map((profile) => {
        const status = statusConfig[profile.account_status] || statusConfig.pending;
        return (
          <button
            key={profile.id}
            type="button"
            onClick={() => onProfileSelect(profile)}
            className={cn(
              "w-full px-4 py-3 flex items-center gap-3 text-right hover:bg-gray-50 transition-colors",
              selectedProfileId === profile.id && "bg-gray-50"
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-800 truncate">{profile.restaurant_name}</div>
              <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <User className="h-2.5 w-2.5" />
                <span className="truncate">{profile.full_name}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
              <span className="text-[10px] text-gray-400">{status.text}</span>
            </div>
          </button>
        );
      }) : (
        <div className="py-12 text-center text-gray-300 text-xs">
          لا يوجد مشتركين
        </div>
      )}
    </div>
  );
}
