'use client';

import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, MousePointer2, ExternalLink } from "lucide-react";
import { EditOfferDialog } from "./EditOfferDialog";
import { StorageImage } from "../shared/StorageImage";
import type { Offer } from "@/lib/types";

interface OfferCardProps {
    offer: Offer;
    onDelete: () => void;
    restaurantId?: string;
    onActionCompletion?: () => void;
}

export function OfferCard({ offer, onDelete, restaurantId, onActionCompletion }: OfferCardProps) {
    const validUntilDate = offer.valid_until?.toDate ? offer.valid_until.toDate() : new Date();
    const timeRemaining = Math.round((validUntilDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    const isExpired = timeRemaining < 0;

    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col">
            {/* Image */}
            <div className="relative aspect-video w-full">
                <StorageImage
                    imagePath={offer.image_url}
                    alt={offer.title}
                    fill
                    className="object-cover"
                    sizes="400px"
                />
                <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isExpired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {isExpired ? 'منتهي' : 'فعّال'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1">
                <h3 className="text-sm font-bold text-gray-900 mb-1">{offer.title}</h3>
                <p className="text-[11px] text-gray-400 line-clamp-2 mb-3">{offer.description}</p>

                {offer.external_link && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 p-2 rounded-lg mb-3">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate" dir="ltr">{offer.external_link}</span>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-gray-50 border border-gray-100 rounded-xl p-2">
                        <Eye className="h-3 w-3 text-gray-300 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-400">مشاهدة</p>
                        <p className="text-sm font-black text-gray-900">{offer.views_count || 0}</p>
                    </div>
                    <div className="text-center bg-gray-50 border border-gray-100 rounded-xl p-2">
                        <MousePointer2 className="h-3 w-3 text-gray-300 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-400">نقرات</p>
                        <p className="text-sm font-black text-gray-900">{offer.clicks_count || 0}</p>
                    </div>
                    <div className="text-center bg-gray-50 border border-gray-100 rounded-xl p-2">
                        <ExternalLink className="h-3 w-3 text-gray-300 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-400">رابط</p>
                        <p className="text-sm font-black text-gray-900">{offer.link_clicks_count || 0}</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] text-gray-400">
                    {isExpired ? 'انتهى:' : 'ينتهي بعد:'} <span className="font-bold text-gray-600">{isExpired ? validUntilDate.toLocaleDateString('ar-SA') : `${timeRemaining} أيام`}</span>
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-900">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-gray-100">
                        <EditOfferDialog offer={offer} restaurantId={restaurantId} onSave={onActionCompletion}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-xs gap-2">
                                <Pencil className="h-3 w-3" />
                                تعديل
                            </DropdownMenuItem>
                        </EditOfferDialog>
                        <DropdownMenuItem onClick={onDelete} className="text-xs gap-2 text-red-600">
                            <Trash2 className="h-3 w-3" />
                            حذف
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
