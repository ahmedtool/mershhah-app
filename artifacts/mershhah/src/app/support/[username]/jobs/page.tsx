'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { FileUploadInput } from '@/components/support/FormFieldsRenderer';
import { DEFAULT_CV_RULES, clampFileRules } from '@/lib/form-fields';
import type { FormFileRules, UploadedFormFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle, Info, Briefcase, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { PublicPageBackdrop } from '@/components/shared/PublicPageBackdrop';
import { useLanguage } from '@/components/shared/LanguageContext';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { usePublicPageBackground } from '@/hooks/usePublicPageBackground';

type JobPostingLite = {
  id: string;
  title: string;
  location?: string | null;
  employment_type?: string | null;
  description?: string | null;
};

export default function PublicJobsPage() {
  const params = useParams();
  const username = params.username as string;
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';

  const [restaurant, setRestaurant] = useState<any>(null);
  const [postings, setPostings] = useState<JobPostingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPostingLite | null>(null);
  const [cvRules, setCvRules] = useState<FormFileRules>(DEFAULT_CV_RULES);
  const [closedPostingIds, setClosedPostingIds] = useState<Set<string>>(new Set());
  usePublicPageBackground(restaurant?.secondaryColor);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cvFiles, setCvFiles] = useState<UploadedFormFile[]>([]);
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Postings that hit their application cap are shown as closed. The DB
  // trigger is the real boundary - this just spares visitors from filling a
  // whole form only to be rejected on submit.
  const loadOpenStatus = async (restaurantId: string) => {
    try {
      const { data } = await supabase.rpc('job_posting_open_status', { p_restaurant_id: restaurantId });
      setClosedPostingIds(new Set(((data || []) as Array<{ posting_id: string; is_open: boolean }>).filter((r) => !r.is_open).map((r) => r.posting_id)));
    } catch {
      // Availability is a UI nicety only - the DB trigger still enforces the cap.
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          setPostings((data.jobPostings || []) as JobPostingLite[]);
          const jobsSvc = (data.gatewayServices || []).find((sv) => sv.service_type === 'jobs');
          setCvRules(clampFileRules(jobsSvc?.config?.cvRules, DEFAULT_CV_RULES));
          loadOpenStatus(data.restaurant.id);
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase.from('restaurants').select('*').eq('username', username).limit(1).single();
        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }
        setRestaurant(rest);
        const { data: jp } = await supabase
          .from('job_postings')
          .select('id, title, location, employment_type, description')
          .eq('restaurant_id', rest.id)
          .eq('is_active', true);
        setPostings((jp || []) as JobPostingLite[]);
        const { data: svc } = await supabase
          .from('business_gateway_services')
          .select('config')
          .eq('restaurant_id', rest.id)
          .eq('service_type', 'jobs')
          .eq('is_enabled', true)
          .maybeSingle();
        setCvRules(clampFileRules(svc?.config?.cvRules, DEFAULT_CV_RULES));
        loadOpenStatus(rest.id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  const handleSubmit = () => {
    if (!restaurant || !selectedJob) return;
    if (cvFiles.length === 0) {
      toast({ title: t('publicJobs.cvRequired'), variant: 'destructive' });
      return;
    }
    startSubmitting(async () => {
      try {
        const { error } = await supabase.from('business_requests').insert({
          restaurant_id: restaurant.id,
          service_type: 'jobs',
          job_posting_id: selectedJob.id,
          name,
          phone,
          email: email || null,
          fields: { cv_url: cvFiles[0].url, cv_files: cvFiles },
          status: 'new',
        });
        if (error) throw error;
        setSubmitted(true);
      } catch (error: any) {
        if (String(error?.message || '').includes('job_posting_full')) {
          setClosedPostingIds((prev) => new Set(prev).add(selectedJob.id));
          setSelectedJob(null);
          toast({ title: t('publicJobs.postingFullTitle'), description: t('publicJobs.postingFullDesc'), variant: 'destructive' });
          return;
        }
        toast({ title: t('ownerSettings.errorTitle'), description: t('publicJobs.applicationFailedDesc'), variant: 'destructive' });
      }
    });
  };

  const primaryColor = restaurant?.primaryColor || '#111827';

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir={dir}>
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{t('hubPage.restaurantNotFound')}</h1>
      </div>
    );
  }

  const themeStyle = getPublicThemeStyle(restaurant);
  const displayName = dir === 'ltr' && restaurant.name_en ? restaurant.name_en : restaurant.name;

  return (
    <div className="min-h-screen pb-16 relative overflow-x-hidden" style={themeStyle} dir={dir}>
      <PublicPageBackdrop />

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => selectedJob ? setSelectedJob(null) : window.history.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          {dir === 'rtl' ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <LanguageSwitcher />
      </div>

      <div className={`max-w-lg mx-auto w-full px-5 pb-8 text-center space-y-3 ${alignStart}`}>
        <div className="relative w-16 h-16 mx-auto overflow-hidden" style={{ borderRadius: 'var(--r-radius)' }}>
          <StorageImage
            imagePath={restaurant.logo}
            alt={displayName}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{t('publicJobs.pageTitle')}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5">
        {!selectedJob ? (
          postings.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Briefcase className="h-10 w-10 text-gray-200 mx-auto" />
              <p className="text-sm text-gray-600">{t('publicJobs.noJobsAvailable')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {postings.map((posting) => {
                const isClosed = closedPostingIds.has(posting.id);
                return (
                <button
                  key={posting.id}
                  onClick={() => !isClosed && setSelectedJob(posting)}
                  disabled={isClosed}
                  className={`w-full flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm transition-all ${isClosed ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md'} ${alignStart}`}
                  style={{ borderRadius: 'var(--r-radius)' }}
                >
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{posting.title}</h3>
                    {posting.location && (
                      <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {posting.location}
                      </p>
                    )}
                  </div>
                  {isClosed ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{t('publicJobs.postingFullBadge')}</span>
                  ) : dir === 'rtl' ? <ChevronLeft className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />}
                </button>
                );
              })}
            </div>
          )
        ) : submitted ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('publicSupport.submittedTitle')}</h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xs mx-auto">{t('publicJobs.applicationSubmittedDesc')}</p>
            </div>
            <button onClick={() => window.history.back()} className="text-xs font-semibold" style={{ color: primaryColor }}>
              {t('publicSupport.back')}
            </button>
          </div>
        ) : (
          <div className="border border-gray-100 p-5 space-y-4" style={{ borderRadius: 'var(--r-radius)' }}>
            <div className={alignStart}>
              <p className="text-[11px] text-gray-600">{t('publicJobs.applyForTitle')}</p>
              <h2 className="text-base font-bold text-gray-900">{selectedJob.title}</h2>
              {selectedJob.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{selectedJob.description}</p>}
            </div>

            <div className={`space-y-3 ${alignStart}`}>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('publicSupport.nameLabel')}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('publicSupport.namePlaceholder')} className="h-10 text-sm rounded-lg border-gray-100" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('ownerSettings.phoneLabel')}</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="05XXXXXXXX" className="h-10 text-sm rounded-lg border-gray-100" dir="ltr" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('ownerSettings.emailLabel')}</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-10 text-sm rounded-lg border-gray-100" dir="ltr" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('publicJobs.cvLabel')}</label>
                <FileUploadInput rules={cvRules} value={cvFiles} onChange={setCvFiles} />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full h-10 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
              disabled={isSubmitting || !name.trim() || !phone.trim() || cvFiles.length === 0}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('publicShared.send')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
