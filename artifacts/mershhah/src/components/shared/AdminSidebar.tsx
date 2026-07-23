'use client';

import { Link, usePathname } from '@/lib/navigation';
import { useUser } from '@/hooks/useUser';
import {
  LayoutDashboard,
  Building,
  Package,
  Store,
  AppWindow,
  Megaphone,
  MessageSquare,
  Users,
  Activity,
  TrendingUp,
  Settings,
  CreditCard,
} from 'lucide-react';

const SUPER_ADMIN_EMAILS = ['ahmedsupsa@gmail.com', 'ahmdtjrbt74@gmail.com'];

const navItems = [
  { href: '/admin/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permissionId: 'dashboard' },
  { href: '/admin/management', label: 'المشتركين', icon: Building, permissionId: 'management' },
  { href: '/admin/plans', label: 'الباقات', icon: Package, permissionId: 'financials' },
  { href: '/admin/financials', label: 'المالية', icon: CreditCard, permissionId: 'financials' },
  { href: '/admin/store-management', label: 'إدارة المتجر', icon: Store, permissionId: 'store-management' },
  { href: '/admin/applications', label: 'التطبيقات', icon: AppWindow, permissionId: 'applications' },
  { href: '/admin/announcements', label: 'الإعلانات', icon: Megaphone, permissionId: 'announcements' },
  { href: '/admin/support', label: 'الدعم', icon: MessageSquare, permissionId: 'support' },
  { href: '/admin/team', label: 'الفريق', icon: Users, permissionId: 'team' },
  { href: '/admin/workflow', label: 'سير العمل', icon: Activity, permissionId: 'workflow' },
  { href: '/admin/sales', label: 'المبيعات', icon: TrendingUp, permissionId: 'sales' },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings, permissionId: 'settings' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const visibleNavItems = navItems.filter((item) => {
    if (SUPER_ADMIN_EMAILS.includes(user?.email)) return true;
    return user?.admin_permissions?.includes(item.permissionId);
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-white border-l border-gray-100 h-screen sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-100">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-black text-gray-900">مرشح</span>
          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">أدمن</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-[11px] font-bold transition-colors ${
                isActive(item.href)
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-500">
              {user?.full_name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-gray-900 truncate">{user?.full_name || 'مسؤول'}</p>
            <p className="text-[9px] text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
