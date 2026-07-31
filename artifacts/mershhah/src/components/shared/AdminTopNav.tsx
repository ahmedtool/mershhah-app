'use client';

import { usePathname, useRouter } from '@/lib/navigation';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { Link } from 'wouter';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'ahmedsupsa@gmail.com';

export function AdminTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { href: '/admin/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permissionId: 'dashboard' },
    { href: '/admin/management', label: 'المشتركين', icon: Building, permissionId: 'management' },
    { href: '/admin/plans', label: 'الباقات', icon: Package, permissionId: 'financials' },
    { href: '/admin/store-management', label: 'إدارة المتجر', icon: Store, permissionId: 'store-management' },
    { href: '/admin/applications', label: 'التطبيقات', icon: AppWindow, permissionId: 'applications' },
    { href: '/admin/announcements', label: 'الإعلانات', icon: Megaphone, permissionId: 'announcements' },
    { href: '/admin/support', label: 'الدعم', icon: MessageSquare, permissionId: 'support', showBadge: true },
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

  const visibleNavItems = navItems.filter((item) => {
    if (user?.email === SUPER_ADMIN_EMAIL) return true;
    return user?.admin_permissions?.includes(item.permissionId);
  });

  const isActive = (href: string) => pathname.startsWith(href);

  const navigatePage = (dir: 'next' | 'prev') => {
    const currentIndex = visibleNavItems.findIndex(item => isActive(item.href));
    if (currentIndex === -1) return;
    const rtl = document.documentElement.getAttribute('dir') === 'rtl';
    let nextIndex: number;
    if (rtl) {
      nextIndex = dir === 'next' ? currentIndex - 1 : currentIndex + 1;
    } else {
      nextIndex = dir === 'next' ? currentIndex + 1 : currentIndex - 1;
    }
    if (nextIndex >= 0 && nextIndex < visibleNavItems.length) {
      router.push(visibleNavItems[nextIndex].href);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-100" dir="rtl">
      <div className="flex items-center h-14 px-4 gap-3">
        {/* Logo */}
        <Link href="/admin/dashboard" className="shrink-0 flex items-center gap-2">
          <img src="/logo.png" alt="مرشح" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-black text-gray-900 hidden sm:block">مرشح</span>
        </Link>

        {/* Next page arrow - mobile */}
        <button onClick={() => navigatePage('next')} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 sm:hidden relative z-10">
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Nav items - scrollable */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 min-w-max">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  isActive(item.href)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
                {item.showBadge && unreadCount > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Prev page arrow - mobile */}
        <button onClick={() => navigatePage('prev')} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 sm:hidden relative z-10">
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* User menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-500">
                {user?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50 min-w-[200px]">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-900">{user?.full_name || 'مسؤول'}</p>
                  <p className="text-[10px] text-gray-400">{user?.email}</p>
                </div>
                <Link href="/admin/settings" onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-gray-500 hover:bg-gray-50">
                  <Settings className="h-3.5 w-3.5 text-gray-400" />
                  الإعدادات
                </Link>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-50">
                  <LogOut className="h-3.5 w-3.5" />
                  تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
