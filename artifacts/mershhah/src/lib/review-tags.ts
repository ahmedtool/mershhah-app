// Shared keyword-based review categorization — used on the public reviews
// page (filter chips) and the owner reports page (topic breakdown), so both
// classify comments the same way.
export const REVIEW_TAGS = [
  { id: 'quality', label: 'الجودة', icon: '✦', keywords: ['جودة', 'ممتاز', 'رائع', 'جميل', 'فخم', 'مميز', 'أفضل', 'نظيف', 'مرتب'] },
  { id: 'taste', label: 'الطعم', icon: '◆', keywords: ['طعم', 'لذيذ', 'بنكه', 'مذاق', 'حلو', 'مر', 'مالح', 'حار', 'طازج'] },
  { id: 'price', label: 'السعر', icon: '●', keywords: ['سعر', 'غالي', 'رخيص', 'مناسب', 'قيمة', 'فلوس', 'ميزانية', 'يبرد'] },
  { id: 'speed', label: 'الخدمة', icon: '▲', keywords: ['سريع', 'بطيء', 'انتظار', 'خدمة', 'توصيل', 'استلام', 'زحمة', 'مهمل', 'ودود'] },
] as const;

export type ReviewTagId = typeof REVIEW_TAGS[number]['id'];

export function countReviewsByTag(comments: string[]): Record<ReviewTagId, number> {
  const counts = { quality: 0, taste: 0, price: 0, speed: 0 } as Record<ReviewTagId, number>;
  for (const comment of comments) {
    for (const tag of REVIEW_TAGS) {
      if (tag.keywords.some(kw => comment.includes(kw))) counts[tag.id]++;
    }
  }
  return counts;
}
