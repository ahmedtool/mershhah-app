'use client';

import { useUser } from '@/hooks/useUser';
import { Loader2, ShieldAlert } from 'lucide-react';
import { usePathname } from '@/lib/navigation';

// Define which permission is required for each route
const routePermissions: Record<string, string> = {
    '/admin/dashboard': 'dashboard',
    '/admin/management': 'management',
    '/admin/financials': 'financials',
    '/admin/store-management': 'store-management',
    '/admin/applications': 'applications',
    '/admin/announcements': 'announcements',
    '/admin/support': 'support',
    '/admin/team': 'team',
    '/admin/workflow': 'workflow',
    '/admin/sales': 'sales',
    // '/admin/settings' is accessible to all admins
};

const SUPER_ADMIN_EMAILS = ['ahmedsupsa@gmail.com', 'ahmdtjrbt74@gmail.com'];


const FullPageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
    </div>
);

const CenteredMessage = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center p-6 bg-background rounded-lg">
        <Icon className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
)

export function AdminAccountStatusChecker({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useUser();
    const pathname = usePathname();

    if (isLoading) {
        return <FullPageLoader />;
    }

    if (!user) {
        return <FullPageLoader />;
    }

    // If there is a user, check their role.
    if (user.role !== 'admin') {
        return (
            <CenteredMessage icon={ShieldAlert} title="غير مصرح به">
                <p>يجب أن تكون مديرًا للوصول إلى هذه الصفحة.</p>
            </CenteredMessage>
        );
    }
    
    // Super admin bypass: If user is a super admin, grant access regardless of DB permissions.
    if (SUPER_ADMIN_EMAILS.includes(user.email)) {
        return <>{children}</>;
    }
    
    // Permission check based on route for other admins
    const requiredPermission = Object.entries(routePermissions).find(([route]) => pathname.startsWith(route))?.[1];
    if (requiredPermission && !user.admin_permissions?.includes(requiredPermission)) {
        return (
             <CenteredMessage icon={ShieldAlert} title="وصول مرفوض">
                <p>ليس لديك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع مدير النظام.</p>
            </CenteredMessage>
        );
    }

    // If all checks pass, render the children.
    return <>{children}</>;
}

    