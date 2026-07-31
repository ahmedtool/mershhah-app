import { Link } from 'wouter';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-gray-900 group" dir="rtl">
      <span className="text-2xl font-black tracking-tight">مرشح</span>
    </Link>
  );
}
