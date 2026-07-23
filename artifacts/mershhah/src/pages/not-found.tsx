
import { Link } from "wouter";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
      <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-5">
        <SearchX className="h-7 w-7 text-gray-300" />
      </div>
      <h1 className="text-5xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-sm font-bold text-gray-900 mb-1">الصفحة مهيب فيها</p>
      <p className="text-[11px] text-gray-400 mb-6 max-w-xs">
        معليش، ما لقينا الصفحة اللي تدور عليها. يمكن انحذفت أو الرابط اللي معك غلط.
      </p>
      <Link href="/"
        className="h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors inline-flex items-center">
        ارجع للرئيسية
      </Link>
    </div>
  );
}
