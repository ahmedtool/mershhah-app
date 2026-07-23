'use client';

import { usePathname, useRouter } from '@/lib/navigation';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import {
  LayoutDashboard,
  Utensils,
  Megaphone,
  LogOut,
  Settings,
  MessageSquare,
  Ticket,
  Store,
  ChevronDown,
  Box,
  Star,
  Building2,
  BarChart3,
} from 'lucide-react';
import { Logo } from './Logo';
import { Separator } from '../ui/separator';
import { Link } from 'wouter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function OwnerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [activatedTools, setActivatedTools] = useState<any[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(true);

  const menuItems = [
    { href: '/owner/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { href: '/owner/menu', label: 'إدارة المنيو', icon: Utensils },
    { href: '/owner/pricing', label: 'مركز التقارير', icon: BarChart3 },
    { href: '/owner/offers', label: 'إدارة العروض', icon: Megaphone },
    { href: '/owner/reviews', label: 'التقييمات', icon: Star },
    { href: '/owner/branches', label: 'إدارة الفروع', icon: Building2 },
    { href: '/owner/customize', label: 'تخصيص الواجهة', icon: Settings },
    { href: '/owner/store', label: 'متجر الأدوات', icon: Store },
  ];

  const supportItems = [
    { href: '/owner/support', label: 'الدعم المباشر', icon: MessageSquare },
    { href: '/owner/tickets', label: 'تذاكر الدعم', icon: Ticket },
  ];

  useEffect(() => {
    const fetchTools = async () => {
      if (!user?.id) { setIsLoadingTools(false); return; }
      setIsLoadingTools(true);
      try {
        const { data: allTools } = await supabase.from('tools').select('id, title, icon');
        const allToolsMap = new Map((allTools || []).map((t: any) => [t.id, t]));
        const { data: activatedToolsData } = await supabase
          .from('activated_tools').select('tool_id').eq('profile_id', user.id);
        const userTools = (activatedToolsData || [])
          .map((row: any) => {
            const toolDetails = allToolsMap.get(row.tool_id) as any;
            if (!toolDetails) return null;
            const IconComponent = (toolDetails.icon as any) || Box;
            return { id: row.tool_id, label: toolDetails.title, href: `/owner/tools/${row.tool_id}`, icon: IconComponent };
          }).filter(Boolean);
        setActivatedTools(userTools as any[]);
      } catch (error) {
        console.error('Error fetching activated tools:', error);
      } finally {
        setIsLoadingTools(false);
      }
    };
    fetchTools();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col bg-white border-l border-gray-100" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)' }} dir="rtl">
      <SidebarHeader className="px-4 py-4">
        <Logo />
      </SidebarHeader>
      <Separator className="bg-gray-100" />
      <SidebarContent className="flex-1 px-2 py-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                size="lg"
                isActive={pathname.startsWith(item.href)}
                className="h-10 px-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 data-[active=true]:bg-gray-50 data-[active=true]:text-gray-900 justify-start rounded-lg"
              >
                <Link href={item.href} className="flex-row-reverse w-full">
                  <span className="flex-1 text-right">{item.label}</span>
                  <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {(isLoadingTools || activatedTools.length > 0) && (
            <Collapsible open={isToolsOpen} onOpenChange={setIsToolsOpen} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton size="lg" className="h-10 px-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 justify-between rounded-lg">
                    <span className="flex-1 text-right">أدواتي المفعلة</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {isLoadingTools ? (
                      <div className="p-2 space-y-1">
                        <SidebarMenuSkeleton showIcon />
                        <SidebarMenuSkeleton showIcon />
                      </div>
                    ) : (
                      activatedTools.map((tool) => (
                        <SidebarMenuSubItem key={tool.id}>
                          <SidebarMenuSubButton asChild isActive={pathname === tool.href} className="h-9 text-xs font-bold text-gray-500 hover:text-gray-700 justify-start">
                            <Link href={tool.href} className="flex-row-reverse w-full">
                              <span className="flex-1 text-right">{tool.label}</span>
                              <tool.icon className="h-4 w-4 shrink-0 text-gray-400" />
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          <Separator className="my-2 bg-gray-100" />

          {supportItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                size="lg"
                isActive={pathname.startsWith(item.href)}
                className="h-10 px-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 data-[active=true]:bg-gray-50 data-[active=true]:text-gray-900 justify-start rounded-lg"
              >
                <Link href={item.href} className="flex-row-reverse w-full">
                  <span className="flex-1 text-right">{item.label}</span>
                  <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="bg-gray-100" />
      <SidebarFooter className="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              isActive={pathname === '/owner/settings'}
              className="h-10 px-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 data-[active=true]:bg-gray-50 data-[active=true]:text-gray-900 justify-start rounded-lg"
            >
              <Link href="/owner/settings" className="flex-row-reverse w-full">
                <span className="flex-1 text-right">الإعدادات</span>
                <Settings className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={handleLogout}
              className="h-10 px-3 text-[13px] font-bold text-red-500 hover:bg-red-50 hover:text-red-600 justify-start rounded-lg"
            >
              <span className="flex flex-row-reverse w-full">
                <span className="flex-1 text-right">تسجيل الخروج</span>
                <LogOut className="h-4 w-4 shrink-0" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </div>
  );
}
