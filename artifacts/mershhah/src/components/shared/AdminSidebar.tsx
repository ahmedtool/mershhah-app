'use client';

import { usePathname, useRouter } from '@/lib/navigation';
import {
  LayoutDashboard,
  LogOut,
  Settings,
  MessageSquare,
  Building,
  Store,
  Users,
  Activity,
  Megaphone,
  AppWindow,
  Package,
  TrendingUp,
  Tag,
  DollarSign,
} from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEffect, useState } from 'react';

const SUPER_ADMIN_EMAIL = 'ahmedsupsa@gmail.com';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const menuItems = [
    { href: '/admin/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permissionId: 'dashboard' },
    { href: '/admin/management', label: 'المشتركين', icon: Building, permissionId: 'management' },
    { href: '/admin/plans', label: 'الباقات', icon: Package, permissionId: 'financials' },
    { href: '/admin/discounts', label: 'كوبونات الخصم', icon: Tag, permissionId: 'financials' },
    { href: '/admin/financials', label: 'المالية', icon: DollarSign, permissionId: 'financials' },
    { href: '/admin/store-management', label: 'إدارة المتجر', icon: Store, permissionId: 'store-management' },
    { href: '/admin/applications', label: 'التطبيقات', icon: AppWindow, permissionId: 'applications' },
    { href: '/admin/announcements', label: 'الإعلانات', icon: Megaphone, permissionId: 'announcements' },
    { href: '/admin/support', label: 'الدعم المباشر', icon: MessageSquare, permissionId: 'support' },
    { href: '/admin/team', label: 'الفريق', icon: Users, permissionId: 'team' },
    { href: '/admin/workflow', label: 'سير العمل', icon: Activity, permissionId: 'workflow' },
    { href: '/admin/sales', label: 'دليل المبيعات', icon: TrendingUp, permissionId: 'sales' },
  ];

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('adminHasUnread', true);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('admin-unread-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => { fetchUnread(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const visibleMenuItems = menuItems.filter((item) => {
    if (user?.email === SUPER_ADMIN_EMAIL || user?.admin_permissions?.includes('all')) return true;
    return user?.admin_permissions?.includes(item.permissionId);
  });

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-white border-l border-gray-100 shrink-0" dir="rtl">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-100">
        <Link href="/admin/dashboard" className="text-sm font-black text-gray-900">مرشح</Link>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 h-10 px-3 rounded-xl text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === '/admin/support' && unreadCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 py-3 px-3 space-y-0.5">
        <Link
          href="/admin/settings"
          className={`flex items-center gap-3 h-10 px-3 rounded-xl text-xs font-bold transition-colors ${
            pathname === '/admin/settings'
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>الإعدادات</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
