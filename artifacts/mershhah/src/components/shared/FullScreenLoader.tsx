import { Loader2 } from "lucide-react";

/**
 * Single loading screen reused by the route Suspense fallback and by
 * owner/admin layouts while auth resolves, so navigating between them
 * never flashes two visually different "loading" screens back to back.
 */
export function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin h-6 w-6 text-gray-900" />
        <span className="text-xs font-bold text-gray-600">مرشح</span>
      </div>
    </div>
  );
}
