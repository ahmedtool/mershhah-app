'use client';

import { useUser } from '@/hooks/useUser';
import { Loader2, ShieldAlert, BadgeInfo } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import type { Plan, Subscription } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getPlanFeatures } from '@/lib/plan-features';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react';

const FullPageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
    </div>
);

const CenteredMessage = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center p-6 bg-background rounded-lg">
        <Icon className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
);

export function AccountStatusChecker({ children }: { children: React.ReactNode }) {
    const { user, isLoading: isUserLoading } = useUser();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<Plan | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchPlans = async () => {
            setIsLoadingPlans(true);
            try {
                const { data, error } = await supabase
                    .from('plans')
                    .select('*')
                    .eq('is_active', true);
                if (error) throw error;
                const fetchedPlans = (data || []) as Plan[];
                fetchedPlans.sort((a, b) => {
                    if (a.is_featured && !b.is_featured) return -1;
                    if (!a.is_featured && b.is_featured) return 1;
                    return a.price - b.price;
                });
                setPlans(fetchedPlans);
            } catch (error) {
                console.error("Error fetching plans:", error);
            } finally {
                setIsLoadingPlans(false);
            }
        };
        fetchPlans();
    }, []);

    useEffect(() => {
        if (isUserLoading || !user) {
            setIsCheckingSubscription(false);
            return;
        }

        const checkAndMigrateSubscription = async () => {
            setIsCheckingSubscription(true);
            try {
                const { data: subs, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('profile_id', user.uid);

                if (error) throw error;

                const now = new Date();
                const hasValidSub = (subs || []).some((sub: Subscription) => {
                    const endDate = new Date(sub.end_date);
                    return sub.status === 'active' && endDate > now;
                });

                if (hasValidSub) {
                    setHasActiveSubscription(true);
                } else {
                    setHasActiveSubscription(false);

                    // Migration: old user with active account but no subscription row
                    if (user.account_status === 'active' && (!subs || subs.length === 0)) {
                        const startDate = new Date();
                        const endDate = new Date();
                        endDate.setFullYear(startDate.getFullYear() + 100);

                        const { error: insertError } = await supabase.from('subscriptions').insert({
                            profile_id: user.uid,
                            plan_id: 'free',
                            plan_name: 'الباقة المجانية',
                            status: 'active',
                            start_date: startDate.toISOString(),
                            end_date: endDate.toISOString(),
                        });

                        if (!insertError) {
                            setHasActiveSubscription(true);
                            toast({ title: 'أهلاً بعودتك!', description: 'تم تحديث حسابك إلى نظام الباقات الجديد (الباقة المجانية).', duration: 5000 });
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking/migrating subscription:", error);
                setHasActiveSubscription(false);
            } finally {
                setIsCheckingSubscription(false);
            }
        };

        checkAndMigrateSubscription();
    }, [user, isUserLoading, toast]);

    const handleChoosePlan = (plan: Plan) => {
        if (!user?.uid) return;
        setSelectedPlanForPayment(plan);
    };

    const isLoading = isUserLoading || isLoadingPlans || isCheckingSubscription;

    if (isLoading) return <FullPageLoader />;
    if (!user) return <FullPageLoader />;

    if (user.role !== 'owner') {
        return <CenteredMessage icon={ShieldAlert} title="غير مصرح به">ليس لديك صلاحية الوصول لهذه الصفحة.</CenteredMessage>;
    }

    const needsToPay = user.account_status === 'pending' || (user.account_status === 'active' && !hasActiveSubscription);

    if (user.account_status === 'suspended') {
        return (
            <CenteredMessage icon={BadgeInfo} title="الحساب معلق">
                <p>تم تعليق حسابك. الرجاء التواصل مع الدعم للمزيد من المعلومات.</p>
                <Button asChild className='mt-6'>
                    <Link href="/owner/support">تواصل مع الدعم</Link>
                </Button>
            </CenteredMessage>
        );
    }

    if (needsToPay) {
        return (
            <>
                <div className="w-full max-w-5xl mx-auto p-4 py-8">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold font-headline mb-2">باقي خطوة واحدة لتفعيل حسابك!</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">شكراً لتسجيلك في مرشح. اختر الباقة التي تناسب مرحلة نمو مشروعك.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                        {plans.map(plan => {
                            const features = getPlanFeatures(plan.id);
                            return (
                                <Card key={plan.id} className={`flex flex-col text-right ${plan.is_featured ? "border-2 border-primary shadow-lg" : ""}`}>
                                    <CardHeader>
                                        {plan.is_featured && <Badge className="mb-2 w-fit bg-primary/10 text-primary border-primary/20">الأكثر انتشاراً</Badge>}
                                        <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                        <CardDescription>{plan.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 space-y-4">
                                        <div className="flex items-baseline gap-2 justify-end mb-4">
                                            <span className="text-5xl font-black text-primary">{plan.price}</span>
                                            <span className="text-xl font-semibold text-muted-foreground">ر.س</span>
                                        </div>
                                        <span className="block text-sm text-muted-foreground text-right -mt-4">
                                            {plan.price === 0 ? 'دائماً' : `/ لكل ${plan.duration_months} أشهر`}
                                        </span>
                                        <Separator className="my-4" />
                                        <ul className="space-y-3 text-sm">
                                            {Object.entries(features).map(([feature, included]) => (
                                                <li key={feature} className={`flex items-center gap-3 ${!included ? 'text-muted-foreground line-through opacity-70' : 'font-medium'}`}>
                                                    {included ? <Check className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-muted-foreground/50" />}
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button onClick={() => handleChoosePlan(plan)} className="w-full h-12 text-lg" variant={plan.is_featured ? 'default' : 'outline'}>
                                            اختر هذه الباقة
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <AlertDialog open={!!selectedPlanForPayment} onOpenChange={(isOpen) => !isOpen && setSelectedPlanForPayment(null)}>
                    <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>إتمام عملية الدفع</AlertDialogTitle>
                            <AlertDialogDescription>
                                لإتمام تفعيل باقة "{selectedPlanForPayment?.name}", الرجاء إتمام الدفع عبر الرابط التالي.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {selectedPlanForPayment?.payment_link ? (
                            <>
                                <div className="py-4">
                                    <p className="text-sm font-bold mb-2">رابط الدفع:</p>
                                    <div className="p-2 bg-muted rounded-md text-center font-mono text-sm break-all" dir="ltr">
                                        {selectedPlanForPayment.payment_link}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">بعد الدفع، سيبقى حسابك "قيد المراجعة" حتى يتم تأكيد الدفع.</p>
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction asChild>
                                        <Link href={selectedPlanForPayment.payment_link} target="_blank">الانتقال إلى الدفع</Link>
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </>
                        ) : (
                            <>
                                <div className="py-4">
                                    <p className="text-center text-muted-foreground">لا يوجد رابط دفع متاح حالياً. تواصل مع الدعم.</p>
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>حسناً</AlertDialogCancel>
                                </AlertDialogFooter>
                            </>
                        )}
                    </AlertDialogContent>
                </AlertDialog>
            </>
        );
    }

    if (user.account_status === 'active' && hasActiveSubscription) {
        return <>{children}</>;
    }

    return <FullPageLoader />;
}
