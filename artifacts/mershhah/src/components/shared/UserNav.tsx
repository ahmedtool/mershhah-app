'use client';

import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from 'wouter';
import { useRouter } from '@/lib/navigation';
import { Skeleton } from "../ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function UserNav() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.logo || user.role !== 'owner') {
      setLogoUrl(null);
      return;
    }
    const path = user.logo.startsWith('http') || user.logo.startsWith('blob:') ? null : user.logo;
    if (!path) {
      setLogoUrl(user.logo);
      return;
    }
    const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
    setLogoUrl(data.publicUrl || null);
  }, [user?.logo, user?.role]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getDisplayName = () => {
    if (user?.full_name) return user.full_name;
    if (user?.email) return user.email.split('@')[0];
    return 'مستخدم';
  };

  const getInitials = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  if (!hasMounted || isLoading) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!user) {
    return (
      <Button variant="default" asChild size="sm">
        <Link href="/login">تسجيل الدخول</Link>
      </Button>
    );
  }

  const displayName = getDisplayName();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            {logoUrl && <AvatarImage src={logoUrl} alt={displayName} className="object-cover" />}
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user?.role === 'owner' ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/owner/settings">ملفي الشخصي</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/owner/support">الدعم الفني</Link>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/admin/settings">الإعدادات</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
        >
          <LogOut className="ml-2 h-4 w-4" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
