
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/hooks/useUser';
import { Loader2, Check, X, ArrowRightLeft, User, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/shared/Logo';
import { Skeleton } from '@/components/ui/skeleton';

// Define types for clarity
type OAuthApp = {
    app_id: string;
    app_name: string;
    app_logo_url: string;
};

const mockOAuthApps: OAuthApp[] = [
    {
        app_id: '12345-abcde',
        app_name: 'تطبيق خارجي تجريبي',
        app_logo_url: 'https://picsum.photos/seed/oauth/100/100'
    }
];


function ConsentScreen() {
    const searchParams = useSearchParams();
    const { user, isLoading: userLoading } = useUser();
    const { toast } = useToast();

    const [app, setApp] = useState<OAuthApp | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Extract params
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const responseType = searchParams.get('response_type');
    const scopes = searchParams.get('scope')?.split(' ') || [];
    
    useEffect(() => {
        if (!clientId) {
            setError("معرّف العميل (client_id) مفقود. لا يمكن المتابعة.");
            setLoading(false);
            return;
        }

        async function fetchAppDetails() {
            try {
                // In a real app, this would fetch from a 'oauth_apps' table in Supabase
                const appData = mockOAuthApps.find(app => app.app_id === clientId);
                if (appData) {
                    setApp(appData);
                } else {
                    setError("التطبيق الذي تحاول الوصول إليه غير موجود أو غير مصرح به.");
                }
            } catch (err) {
                setError("حدث خطأ أثناء محاولة جلب معلومات التطبيق.");
            } finally {
                setLoading(false);
            }
        }
        fetchAppDetails();
    }, [clientId]);

    const handleAllow = () => {
        // In a real scenario, this would make a request to Supabase to grant the code
        // and then redirect.
        toast({ title: "تم منح الإذن بنجاح!", description: "سيتم إعادة توجيهك الآن..." });
        // window.location.href = redirectUri + '?code=...&state=...';
    };

    const handleDeny = () => {
        // Redirect back with an error
        toast({ title: "تم رفض الإذن.", variant: "destructive" });
        // window.location.href = redirectUri + '?error=access_denied&state=...';
    };

    if (userLoading || loading) {
        return (
            <Card>
                <CardHeader className="items-center text-center">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <Skeleton className="h-6 w-48 mt-4" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
        );
    }
    
    if (error) {
        return (
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle>خطأ في المصادقة</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!user) {
        // This case should ideally be handled by middleware, redirecting to login.
        return (
            <Card>
                <CardHeader>
                    <CardTitle>مطلوب تسجيل الدخول</CardTitle>
                    <CardDescription>يرجى تسجيل الدخول للمتابعة.</CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    const scopeDescriptions: Record<string, { desc: string, icon: any }> = {
        'profile:read': { desc: 'قراءة معلومات ملفك الشخصي الأساسية.', icon: User },
        'restaurants:read': { desc: 'قراءة بيانات مطاعمك.', icon: KeyRound },
        'restaurants:write': { desc: 'تعديل بيانات مطاعمك.', icon: KeyRound },
    };


    return (
        <Card className="shadow-lg">
            <CardHeader className="items-center text-center">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border">
                        <AvatarImage src={app?.app_logo_url} />
                        <AvatarFallback>{app?.app_name[0]}</AvatarFallback>
                    </Avatar>
                    <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                    <Logo />
                </div>
                <CardTitle className="mt-6 text-xl">
                    <span className="font-bold text-primary">{app?.app_name}</span> يريد الوصول إلى حسابك في مرشح
                </CardTitle>
                <CardDescription>
                    أنت مسجل الدخول بحساب <span className="font-semibold">{user.email}</span>. سيتم ربط هذا الحساب.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <p className="text-sm font-semibold text-center">سيتمكن هذا التطبيق من:</p>
                    <ul className="space-y-2 text-sm text-muted-foreground border rounded-lg p-4">
                        {scopes.map(scope => (
                            <li key={scope} className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500" />
                                <span>{scopeDescriptions[scope]?.desc || `تنفيذ الإجراء: ${scope}`}</span>
                            </li>
                        ))}
                         <li className="flex items-center gap-2">
                            <X className="h-4 w-4 text-destructive" />
                            <span>لا يمكنه الوصول إلى كلمة المرور الخاصة بك.</span>
                        </li>
                    </ul>
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        بمنحك الإذن، فإنك تسمح لهذا التطبيق باستخدام بياناتك وفقًا لشروط الخدمة وسياسة الخصوصية الخاصة به.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleDeny}>رفض</Button>
                <Button onClick={handleAllow}>السماح</Button>
            </CardFooter>
        </Card>
    );
}

export default function OAuthConsentPage() {
    return (
        <Suspense fallback={<Card><CardContent><Loader2 className="h-8 w-8 animate-spin mx-auto my-10" /></CardContent></Card>}>
            <ConsentScreen />
        </Suspense>
    );
}
