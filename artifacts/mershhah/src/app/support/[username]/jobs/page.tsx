'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { uploadToImageKit } from '@/lib/imagekit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle, Info, Briefcase, MapPin, FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { PublicPageBackdrop } from '@/components/shared/PublicPageBackdrop';
import { useLanguage } from '@/components/shared/LanguageContext';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restaurant, setRestaurant] = useState<any>(null);
  const [postings, setPostings] = useState<JobPostingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPostingLite | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          setPostings((data.jobPostings || []) as JobPostingLite[]);
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCv(true);
    try {
      const url = await uploadToImageKit(file, 'cv-uploads');
      setCvUrl(url);
      setCvFileName(file.name);
    } catch {
      toast({ title: t('ownerSettings.errorTitle'), description: t('publicJobs.cvUploadFailed'), variant: 'destructive' });
    } finally {
      setIsUploadingCv(false);
    }
  };

  const handleSubmit = () => {
    if (!restaurant || !selectedJob) return;
    if (!cvUrl) {
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
          fields: { cv_url: cvUrl },
          status: 'new',
        });
        if (error) throw error;
        setSubmitted(true);
      } catch (error: any) {
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

  return (
    <div className="min-h-screen pb-16 relative overflow-x-hidden" style={{ ...themeStyle, background: 'linear-gradient(to bottom, color-mix(in srgb, var(--r-secondary) 25%, white), white 220px)' }} dir={dir}>
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
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
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
              {postings.map((posting) => (
                <button
                  key={posting.id}
                  onClick={() => setSelectedJob(posting)}
                  className={`w-full flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all ${alignStart}`}
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
                  {dir === 'rtl' ? <ChevronLeft className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />}
                </button>
              ))}
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
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={handleCvChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingCv}
                  className="w-full h-10 rounded-lg border border-dashed border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploadingCv ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('publicJobs.cvUploading')}</>
                  ) : cvFileName ? (
                    <><FileText className="h-3.5 w-3.5" /> {cvFileName}</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> {t('publicJobs.cvUploadPrompt')}</>
                  )}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full h-10 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
              disabled={isSubmitting || isUploadingCv || !name.trim() || !phone.trim()}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('publicShared.send')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
