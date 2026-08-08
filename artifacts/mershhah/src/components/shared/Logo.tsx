import { Link } from 'wouter';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-gray-900 group" dir="rtl">
      <img src="/logo.jpg" alt="مرشح" className="h-8 w-auto" />
    </Link>
  );
}
