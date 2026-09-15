'use client';

import { useUser } from '@/hooks/useUser';
import { ShieldAlert, BadgeInfo } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import type { Subscription } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { PlanPricingGrid } from '@/components/dashboard/PlanPricingGrid';
import { FullScreenLoader } from '@/components/shared/FullScreenLoader';
import { isUnlimitedAccount } from '@/lib/unlimited-account';

const CenteredMessage = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center p-6 bg-background rounded-lg">
        <Icon className="w-16 h-16 text-gray-900 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
);

export function AccountStatusChecker({ children }: { children: React.ReactNode }) {
    const { user, isLoading: isUserLoading } = useUser();
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

    useEffect(() => {
        if (isUserLoading || !user) {
            setIsCheckingSubscription(false);
            return;
        }

        const checkSubscription = async () => {
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

                setHasActiveSubscription(hasValidSub);
            } catch (error) {
                console.error("Error checking subscription:", error);
                setHasActiveSubscription(false);
            } finally {
                setIsCheckingSubscription(false);
            }
        };

        checkSubscription();
    }, [user, isUserLoading]);

    const isLoading = isUserLoading || isCheckingSubscription;

    if (isLoading) return <FullScreenLoader />;
    if (!user) return <FullScreenLoader />;

    if (user.role !== 'owner') {
        return <CenteredMessage icon={ShieldAlert} title="غير مصرح به">ليس لديك صلاحية الوصول لهذه الصفحة.</CenteredMessage>;
    }

    const isUnlimited = isUnlimitedAccount(user.email);
    const needsToPay = !isUnlimited && (user.account_status === 'pending' || (user.account_status === 'active' && !hasActiveSubscription));

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
            <div className="w-full max-w-5xl mx-auto p-4 py-10" dir="rtl">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-2 text-gray-900">باقي خطوة واحدة لتفعيل حسابك!</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">شكراً لتسجيلك في مرشح. اختر الباقة التي تناسب مرحلة نمو مشروعك.</p>
                </div>
                <PlanPricingGrid />
            </div>
        );
    }

    if (isUnlimited || (user.account_status === 'active' && hasActiveSubscription)) {
        return <>{children}</>;
    }

    return <FullScreenLoader />;
}
