'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import {
  Smartphone,
  Palette,
  Globe,
  ArrowRight,
  Utensils,
  Loader2,
  X,
  PlusCircle,
  Check,
  Layout,
  Link as LinkIcon,
  AppWindow,
  ImageIcon,
} from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { StorageImage } from '@/components/shared/StorageImage';
import { InstagramIcon, XIcon, TikTokIcon, SnapchatIcon, YoutubeIcon, FacebookIcon, WhatsAppIcon, WebsiteIcon } from '@/components/shared/SocialIcons';
import PageHeader from '@/components/dashboard/PageHeader';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { extractColorsFromImage } from '@/lib/extract-colors-from-image';
import { Skeleton } from '@/components/ui/skeleton';

const SOCIAL_PLATFORMS = [
  { label: 'واتساب', value: 'whatsapp', icon: WhatsAppIcon, color: '#25D366' },
  { label: 'انستقرام', value: 'instagram', icon: InstagramIcon, color: '#E4405F' },
  { label: 'تيك توك', value: 'tiktok', icon: TikTokIcon, color: '#000000' },
  { label: 'تويتر (X)', value: 'twitter', icon: XIcon, color: '#000000' },
  { label: 'سناب شات', value: 'snapchat', icon: SnapchatIcon, color: '#FFFC00' },
  { label: 'فيسبوك', value: 'facebook', icon: FacebookIcon, color: '#1877F2' },
  { label: 'يوتيوب', value: 'youtube', icon: YoutubeIcon, color: '#FF0000' },
  { label: 'موقع إلكتروني', value: 'website', icon: WebsiteIcon, color: '#714dfa' },
];

export default function CustomizePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [globalApps, setGlobalApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isSuggestingColors, setIsSuggestingColors] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [customAppFiles, setCustomAppFiles] = useState<Record<string, File>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appLogoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const initialUsernameRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (user?.restaurantId) {
        try {
            const { data: restData } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', user.restaurantId)
                .single();

            if (restData) {
              initialUsernameRef.current = restData.username ?? null;
              setSettings({
                ...restData,
                socialLinks: Array.isArray(restData.socialLinks) ? restData.socialLinks : [],
                applications: Array.isArray(restData.applications) ? restData.applications : [],
                borderRadius: restData.borderRadius ?? 16,
                fontFamily: restData.fontFamily ?? 'Cairo',
              });
              setLogoPreview(restData.logo);
            }
        } catch (serverError: any) {
            console.error("Error fetching restaurant data:", serverError);
        }

        try {
            const { data: appsData } = await supabase.from('applications').select('*');
            setGlobalApps(appsData || []);
        } catch (serverError: any) {
            console.error("Error fetching applications:", serverError);
        }

        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleSuggestColors = async () => {
    let dataUri = '';

    try {
        if (logoFile) {
            dataUri = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(logoFile);
            });
        } else if (logoPreview) {
            let finalUrl = logoPreview;
            if (!logoPreview.startsWith('http') && !logoPreview.startsWith('blob:')) {
                const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(logoPreview);
                finalUrl = publicUrl;
            }
            const response = await fetch(finalUrl);
            const blob = await response.blob();
            dataUri = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        if (!dataUri) return;

        setIsSuggestingColors(true);
        const result = await extractColorsFromImage(dataUri);
        setSettings({
            ...settings,
            primaryColor: result.primaryColor,
            secondaryColor: result.secondaryColor,
            buttonTextColor: result.buttonTextColor
        });
        toast({ title: "تم استخراج الألوان من الشعار!" });
    } catch (error: any) {
        toast({ title: "خطأ", description: error.message || "فشل تحليل الشعار.", variant: "destructive" });
    } finally {
        setIsSuggestingColors(false);
    }
  };

  const handleSave = async () => {
    if (!user?.restaurantId || isSaving) return;

    startSaving(async () => {
      try {
        let logoUrl = settings.logo;
        if (logoFile) {
          const path = `restaurants/${user.restaurantId}/logo`;
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from('restaurant-assets')
              .upload(path, logoFile, { upsert: true });
          if (uploadError) throw uploadError;
          logoUrl = uploadData.path;
        }

        const updatedApplications = await Promise.all((settings.applications || []).map(async (app: any) => {
            if (app.type === 'custom' && customAppFiles[app.id]) {
                const file = customAppFiles[app.id];
                const path = `restaurants/${user.restaurantId}/custom_apps/${app.id}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('restaurant-assets')
                    .upload(path, file, { upsert: true });
                if (uploadError) throw uploadError;
                return { ...app, logo: uploadData.path };
            }
            return app;
        }));

        const { ...cleanSettings } = settings;
        const newUsername = (cleanSettings.username ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
        if (!newUsername && initialUsernameRef.current) {
          toast({ title: 'خطأ', description: 'اسم المستخدم مطلوب للرابط النهائي.', variant: 'destructive' });
          return;
        }
        const usernameChanged = newUsername && newUsername !== (initialUsernameRef.current ?? '');
        if (usernameChanged) {
          const lastUpdated = cleanSettings.username_last_updated_at;
          if (lastUpdated) {
            const date = new Date(lastUpdated);
            const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 30) {
              toast({ title: 'خطأ', description: 'لا يمكن تغيير اسم المستخدم إلا مرة واحدة كل 30 يوماً.', variant: 'destructive' });
              return;
            }
          }
        }

        const updateData: Record<string, unknown> = {
            ...cleanSettings,
            username: newUsername || cleanSettings.username,
            logo: logoUrl || null,
            applications: updatedApplications || [],
            updated_at: new Date().toISOString(),
        };
        if (usernameChanged) {
          updateData.username_last_updated_at = new Date().toISOString();
          initialUsernameRef.current = newUsername;
        }

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const { error } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', user.restaurantId);
        if (error) throw error;

        syncPublicPage(user.restaurantId!).catch(() => {});

        if (logoFile) {
          await supabase.from('activity').insert({
            type: "logo_added",
            restaurantId: user.restaurantId,
            restaurantName: settings.name || null,
            userId: user.uid,
            timestamp: new Date().toISOString(),
          });
        }

        toast({ title: "تم الحفظ بنجاح!" });

      } catch (e: any) {
          toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
      }
    });
  };

  const toggleGlobalApp = (app: any) => {
    const isAlreadyAdded = settings.applications?.some((a: any) => a.platformId === app.id);
    if (isAlreadyAdded) {
      setSettings({
        ...settings,
        applications: settings.applications.filter((a: any) => a.platformId !== app.id)
      });
    } else {
      const newApp = {
        id: `global-${app.id}`,
        type: 'global',
        platformId: app.id,
        name: app.name,
        logo: app.logo_url,
        value: ''
      };
      setSettings({
        ...settings,
        applications: [...(settings.applications || []), newApp]
      });
    }
  };

  const addCustomApp = () => {
    const customCount = settings.applications?.filter((a: any) => a.type === 'custom').length || 0;
    if (customCount >= 2) {
        toast({ title: "الحد الأقصى للتطبيقات الخاصة هو 2", variant: "destructive" });
        return;
    }
    const newApp = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      name: 'تطبيق جديد',
      logo: '',
      value: ''
    };
    setSettings({
      ...settings,
      applications: [...(settings.applications || []), newApp]
    });
  };

  const removeApp = (id: string) => {
    setSettings({
      ...settings,
      applications: settings.applications.filter((a: any) => a.id !== id)
    });
  };

  const updateAppField = (id: string, field: string, value: string) => {
    setSettings({
      ...settings,
      applications: settings.applications.map((a: any) => a.id === id ? { ...a, [field]: value } : a)
    });
  };

  const handleAppLogoChange = (appId: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setCustomAppFiles(prev => ({ ...prev, [appId]: file }));
    setSettings({
        ...settings,
        applications: settings.applications.map((a: any) => a.id === appId ? { ...a, logo: previewUrl } : a)
    });
  };

  const addSocialLink = (platform: string) => {
    const newLink = { id: Math.random().toString(36).substr(2, 9), platform, value: '' };
    setSettings({ ...settings, socialLinks: [...(settings.socialLinks || []), newLink] });
  };

  const removeSocialLink = (id: string) => {
    setSettings({ ...settings, socialLinks: (settings.socialLinks || []).filter((l: any) => l.id !== id) });
  };

  const updateSocialLink = (id: string, value: string) => {
    setSettings({
      ...settings,
      socialLinks: (settings.socialLinks || []).map((l: any) => l.id === id ? { ...l, value } : l)
    });
  };

  if (loading || !settings) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          <div className="space-y-4">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
          <div className="xl:col-span-2 flex justify-center">
            <Skeleton className="w-[300px] h-[600px] rounded-[3rem]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20" dir="rtl">
      <PageHeader title="تخصيص الواجهة" description="صمم هويتك البصرية والروابط الخاصة بك.">
          <button
            onClick={() => window.open(`/hub/${settings.username}`, '_blank')}
            className="h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Globe className="h-3.5 w-3.5" />
            معاينة
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            حفظ
          </button>
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start min-w-0">
        {/* Settings Panel */}
        <div className="xl:col-span-1 space-y-4 min-w-0">
            <Accordion type="multiple" defaultValue={['branding', 'colors', 'apps', 'social']} className="space-y-3">
                {/* Branding */}
                <AccordionItem value="branding" className="border border-gray-100 rounded-2xl px-4 bg-white">
                    <AccordionTrigger className="font-bold hover:no-underline text-right text-sm text-gray-900 py-4">
                        <div className="flex items-center gap-2"><Layout className="h-4 w-4 text-gray-400"/> الهوية البصرية</div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-5 text-right">
                        <div className="space-y-2">
                            <Label className="text-[11px] text-gray-400">شعار التطبيق</Label>
                            <div className="relative w-28 h-28 mx-auto border border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 cursor-pointer overflow-hidden group" onClick={() => fileInputRef.current?.click()}>
                                <StorageImage imagePath={logoPreview} alt="Logo" fill className="object-contain p-2" sizes="112px" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">تغيير</div>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={e => { if(e.target.files?.[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); } }} className="hidden" accept="image/*" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400">اسم المطعم</Label>
                            <Input value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})}
                              className="h-10 rounded-xl border-gray-200 text-xs text-right" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400">اسم المستخدم (للرابط)</Label>
                            <Input
                                dir="ltr"
                                value={settings.username ?? ''}
                                onChange={e => setSettings({ ...settings, username: e.target.value })}
                                placeholder="اسم-المطعم"
                                className="h-10 rounded-xl border-gray-200 text-xs text-right font-mono"
                                disabled={(() => {
                                    const lastUpdated = settings.username_last_updated_at;
                                    if (!lastUpdated) return false;
                                    const date = new Date(lastUpdated);
                                    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
                                    return daysSince < 30;
                                })()}
                            />
                            <p className="text-[10px] text-gray-300">
                                /hub/{settings.username || '...'} — مرة كل 30 يوماً
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] text-gray-400">الوصف</Label>
                            <Textarea value={settings.description || ''} onChange={e => setSettings({...settings, description: e.target.value})}
                              rows={2} className="rounded-xl border-gray-200 text-xs text-right resize-none" />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Colors */}
                <AccordionItem value="colors" className="border border-gray-100 rounded-2xl px-4 bg-white">
                    <AccordionTrigger className="font-bold hover:no-underline text-right text-sm text-gray-900 py-4">
                        <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-gray-400"/> الألوان</div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 text-right">
                        <button
                            className="w-full h-9 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            onClick={handleSuggestColors}
                            disabled={isSuggestingColors || !logoPreview}
                        >
                            {isSuggestingColors ? <Loader2 className="h-3 w-3 animate-spin" /> : <Palette className="h-3 w-3" />}
                            استخراج من الشعار
                        </button>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <Label className="text-[11px] font-bold text-gray-600">اللون الأساسي</Label>
                                <input type="color" value={settings.primaryColor || '#111827'} onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <Label className="text-[11px] font-bold text-gray-600">لون الخلفية</Label>
                                <input type="color" value={settings.secondaryColor || '#ffffff'} onChange={e => setSettings({...settings, secondaryColor: e.target.value})}
                                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Apps */}
                <AccordionItem value="apps" className="border border-gray-100 rounded-2xl px-4 bg-white">
                    <AccordionTrigger className="font-bold hover:no-underline text-right text-sm text-gray-900 py-4">
                        <div className="flex items-center gap-2"><AppWindow className="h-4 w-4 text-gray-400"/> التطبيقات</div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-5 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                            {globalApps.map(app => {
                                const isAdded = settings.applications?.some((a: any) => a.platformId === app.id);
                                return (
                                    <button key={app.id}
                                        className={cn(
                                            "h-8 gap-1.5 text-[10px] font-bold rounded-lg px-3 flex items-center border transition-colors",
                                            isAdded ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                                        )}
                                        onClick={() => toggleGlobalApp(app)}
                                    >
                                        <div className="relative w-3.5 h-3.5 shrink-0">
                                            <StorageImage imagePath={app.logo_url} alt={app.name} fill className="object-contain" sizes="14px" />
                                        </div>
                                        {app.name}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="border-t border-gray-100" />
                        <div className="space-y-3">
                            <div className="flex justify-between items-center flex-row-reverse">
                                <h4 className="text-xs font-bold text-gray-900">تطبيقات خاصة</h4>
                                <button onClick={addCustomApp} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 flex items-center gap-1 transition-colors">
                                    <PlusCircle className="h-3 w-3" /> إضافة
                                </button>
                            </div>
                            {settings.applications?.map((app: any) => (
                                <div key={app.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2 relative text-right">
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <div
                                            className="relative w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                                            onClick={() => app.type === 'custom' && appLogoInputRefs.current[app.id]?.click()}
                                        >
                                            {app.logo ? <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain p-1" sizes="36px" /> : <ImageIcon size={16} className="text-gray-200" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {app.type === 'global' ? <p className="text-[11px] font-bold text-gray-900">{app.name}</p> : <Input value={app.name} onChange={e => updateAppField(app.id, 'name', e.target.value)} className="h-8 text-[11px] font-bold text-right rounded-lg border-gray-200" />}
                                        </div>
                                        <button onClick={() => removeApp(app.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><X size={12} /></button>
                                    </div>
                                    <Input dir="ltr" value={app.value} onChange={e => updateAppField(app.id, 'value', e.target.value)} placeholder="https://..." className="h-8 text-[10px] rounded-lg border-gray-200" />
                                    {app.type === 'custom' && <input type="file" ref={el => { appLogoInputRefs.current[app.id] = el; }} onChange={e => e.target.files?.[0] && handleAppLogoChange(app.id, e.target.files[0])} className="hidden" accept="image/*" />}
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Social */}
                <AccordionItem value="social" className="border border-gray-100 rounded-2xl px-4 bg-white">
                    <AccordionTrigger className="font-bold hover:no-underline text-right text-sm text-gray-900 py-4">
                        <div className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-gray-400"/> التواصل الاجتماعي</div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 text-right">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                            {SOCIAL_PLATFORMS.map(p => (
                                <button key={p.value}
                                    className="h-8 gap-1.5 text-[10px] font-bold rounded-lg px-3 flex items-center border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors disabled:opacity-30"
                                    onClick={() => addSocialLink(p.value)}
                                    disabled={(settings.socialLinks || []).some((l: any) => l.platform === p.value && p.value !== 'website')}
                                >
                                    <p.icon size={12} style={{ color: p.color }} />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {(settings.socialLinks || []).map((link: any) => {
                                const platform = SOCIAL_PLATFORMS.find(p => p.value === link.platform);
                                const Icon = platform?.icon || WebsiteIcon;
                                return (
                                    <div key={link.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 flex-row-reverse">
                                        <div className="p-1.5 bg-white rounded-lg border border-gray-100 shrink-0">
                                            <Icon size={14} style={{ color: platform?.color }} />
                                        </div>
                                        <Input dir="ltr" value={link.value} onChange={e => updateSocialLink(link.id, e.target.value)} placeholder="الرابط..." className="h-8 text-[10px] rounded-lg border-gray-200 flex-1" />
                                        <button onClick={() => removeSocialLink(link.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><X size={12}/></button>
                                    </div>
                                )
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>

        {/* Phone Preview */}
        <div className="xl:col-span-2 flex flex-col items-center min-w-0 overflow-x-hidden px-4 sm:px-0">
          <div className="sticky top-24 w-full max-w-[360px] self-start mx-auto">
            <div className="relative border-[10px] border-gray-900 rounded-[3rem] overflow-hidden w-full aspect-[9/19] flex flex-col min-h-[400px] bg-white">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-xl z-30" />
              <div className="flex-1 min-h-0 w-full relative pt-2">
                {settings?.username ? (
                  <iframe
                    key={settings.username}
                    src={`/hub/${settings.username}`}
                    title="معاينة"
                    className="w-full h-full min-h-[600px] border-0 rounded-b-[2rem] bg-white"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-300 text-xs p-6 text-center">
                    <Smartphone className="h-10 w-10 mb-3 text-gray-200" />
                    <p className="font-bold text-gray-400">احفظ اسم المستخدم أولاً</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-300 text-center mt-3 flex items-center justify-center gap-1.5">
                <Smartphone className="h-3 w-3"/> معاينة حية
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
