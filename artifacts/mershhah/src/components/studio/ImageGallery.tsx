'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Clock, Download, Loader2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GeneratedImage, MenuItem } from '@/lib/types';

export function ImageGallery({ onImageSelect }: { onImageSelect?: (storagePath: string) => void }) {
    const { user } = useUser();
    const [generatedImages, setGeneratedImages] = useState<any[]>([]);
    const [menuItemImages, setMenuItemImages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!user?.restaurantId) {
            setIsLoading(false);
            setGeneratedImages([]);
            setMenuItemImages([]);
            return;
        }

        setIsLoading(true);
        const restaurantId = user.restaurantId;
        const now = new Date().toISOString();

        const fetchGallery = async () => {
            const { data } = await supabase
                .from('image_gallery')
                .select('*')
                .eq('restaurantId', restaurantId)
                .gt('expiresAt', now)
                .order('expiresAt', { ascending: false });
            setGeneratedImages(data || []);
        };

        const fetchMenuItems = async () => {
            const { data } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .not('image_url', 'is', null)
                .neq('image_url', '');

            const images = (data || []).map((item: MenuItem) => ({
                id: item.id,
                storagePath: item.image_url,
                createdAt: item.createdAt || new Date().toISOString(),
                expiresAt: null,
                sourceItemId: item.id,
                sourceItemName: item.name,
            }));
            setMenuItemImages(images);
        };

        Promise.all([fetchGallery(), fetchMenuItems()]).finally(() => setIsLoading(false));

        const galleryChannel = supabase.channel('gallery_images')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'image_gallery', filter: `restaurantId=eq.${restaurantId}` }, fetchGallery)
            .subscribe();

        const menuChannel = supabase.channel('gallery_menu_items')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, fetchMenuItems)
            .subscribe();

        return () => {
            supabase.removeChannel(galleryChannel);
            supabase.removeChannel(menuChannel);
        };
    }, [user?.restaurantId]);

    const allImages = useMemo(() => {
        const imageMap = new Map<string, any>();

        generatedImages.forEach(img => {
            if (img.storagePath) imageMap.set(img.storagePath, img);
        });

        menuItemImages.forEach(img => {
            if (img.storagePath && !imageMap.has(img.storagePath)) imageMap.set(img.storagePath, img);
        });

        return Array.from(imageMap.values()).sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [generatedImages, menuItemImages]);

    const handleDownload = async (storagePath: string, sourceItemName: string) => {
        if (!storagePath) return;
        setDownloadingId(storagePath);
        toast({ title: "جاري تجهيز الصورة للتحميل..." });
        try {
            const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(storagePath);
            const response = await fetch(publicUrl);
            if (!response.ok) throw new Error('فشل تحميل الصورة من الخادم');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${sourceItemName || 'generated-image'}.webp`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast({ title: "بدأ تحميل الصورة بنجاح!" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ", description: error.message });
        } finally {
            setDownloadingId(null);
        }
    };

    if (isLoading) {
        return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>;
    }

    if (allImages.length === 0) {
        return <div className="text-right py-10 text-muted-foreground border-2 border-dashed rounded-lg pr-6">لا توجد صور لعرضها. قم بإنشاء صور في الاستوديو أو أضف صوراً لأصناف المنيو.</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {allImages.map(image => (
                 <Card
                    key={image.storagePath}
                    className={cn("group relative overflow-hidden", onImageSelect && "cursor-pointer hover:border-primary border-2")}
                    onClick={onImageSelect ? () => onImageSelect(image.storagePath) : undefined}
                >
                    {onImageSelect ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                    ) : (
                         <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/70" onClick={(e) => { e.stopPropagation(); handleDownload(image.storagePath, image.sourceItemName); }} disabled={downloadingId === image.storagePath}>
                                {downloadingId === image.storagePath ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Download className="h-4 w-4 text-white" />}
                            </Button>
                        </div>
                    )}

                    <div className="aspect-square w-full relative">
                        <StorageImage imagePath={image.storagePath} alt={image.sourceItemName || 'Generated Image'} fill sizes="200px" className="object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-xs font-bold truncate">{image.sourceItemName}</p>
                        {image.expiresAt && (
                          <p className="text-white/80 text-[10px] flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {`تنتهي خلال ${formatDistanceToNow(new Date(image.expiresAt), { locale: ar })}`}
                          </p>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
}
