const POSITIVE_WORDS = [
  'ممتاز', 'رائع', 'جميل', 'مميز', 'أفضل', 'نظيف', 'مرتب', 'لذيذ', 'طعم', 'حلو',
  'طازج', ' سريع', 'خدمة', 'ودود', ' approached', 'مبدع', 'فخم', 'رخيص', 'مناسب',
  'مقبول', 'جيد', 'مميز', 'أحب', 'استمتع', 'شكرا', 'ممتن', 'أنصح', 'أكرر',
  'فوق', 'الرائع', 'الجميل', 'الممتاز', 'الحلو', 'اللطيف', 'النظيف', 'المرتب',
  'لطيف', 'حلوه', 'تمام', 'كويس', 'حبيت', 'عجبني', 'ما شاء', 'توب', 'أحلى',
];

const NEGATIVE_WORDS = [
  'سيء', 'بطيء', 'غالي', 'مر', 'مالح', 'حار', 'زحمة', 'مهمل', 'oder', 'غير',
  'لا', 'مش', 'ما', 'ندمان', 'خيب', '失望', 'سيئ', 'باهت', 'طفش', 'زبونة',
  'مزعج', 'فوضى', 'قرف', 'неприятно', 'فاضح', 'مقرف', 'ندم', 'حراام',
  'ندمت', 'خرب', 'تالف', 'منتهي', 'صفر', 'نار', 'حر', '.obnoxious',
];

const TOPIC_KEYWORDS: Record<string, { label: string; keywords: string[]; positive: boolean }> = {
  quality: {
    label: 'الجودة',
    keywords: ['جودة', 'ممتاز', 'رائع', 'جميل', 'فخم', 'مميز', 'أفضل', 'نظيف', 'مرتب', 'طازج', 'خامة', 'material'],
    positive: true,
  },
  taste: {
    label: 'الطعم',
    keywords: ['طعم', 'لذيذ', 'بنكه', 'مذاق', 'حلو', 'مر', 'مالح', 'حار', 'طازج', ' seasoning'],
    positive: true,
  },
  price: {
    label: 'السعر',
    keywords: ['سعر', 'غالي', 'رخيص', 'مناسب', 'قيمة', 'فلوس', 'ميزانية', 'يبرد', 'worth'],
    positive: false,
  },
  speed: {
    label: 'السرعة',
    keywords: ['سريع', 'بطيء', 'انتظار', 'خدمة', 'توصيل', 'استلام', 'زحمة', 'مهمل', 'ودود', 'slow', 'fast'],
    positive: false,
  },
  service: {
    label: 'الخدمة',
    keywords: ['خدمة', 'طاقم', 'موظف', 'استقبال', 'ودود', ' Friendly', 'staff', 'approached'],
    positive: true,
  },
  quantity: {
    label: 'الكمية',
    keywords: ['كمية', 'كبير', 'صغير', 'شبع', 'جوع', ' portion', 'size'],
    positive: false,
  },
};

function stripTashkeel(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
    .replace(/[ًٌٍَُِّْ]/g, '');
}

function countWords(text: string): Record<string, number> {
  const words: Record<string, number> = {};
  const cleaned = stripTashkeel(text.toLowerCase());
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 2);
  for (const w of tokens) {
    words[w] = (words[w] || 0) + 1;
  }
  return words;
}

export type ReviewAnalysisResult = {
  sentimentScore: number;
  sentimentLabel: string;
  positiveThemes: string[];
  negativeThemes: string[];
  topWords: { word: string; count: number }[];
  topicBreakdown: { topic: string; positive: number; negative: number; neutral: number }[];
  recommendation: string;
  overallEmoji: string;
};

export function analyzeReviewsLocally(
  reviews: { rating: number; comment?: string }[]
): ReviewAnalysisResult {
  if (reviews.length === 0) {
    return {
      sentimentScore: 50,
      sentimentLabel: 'لا توجد بيانات',
      positiveThemes: [],
      negativeThemes: [],
      topWords: [],
      topicBreakdown: [],
      recommendation: 'أضف تقييمات لبدء التحليل.',
      overallEmoji: '📊',
    };
  }

  const comments = reviews.map(r => (r.comment || '').toLowerCase());
  const allText = comments.join(' ');
  const words = countWords(allText);

  // Sentiment from ratings (40%) + keywords (60%)
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const ratingSentiment = (avgRating / 5) * 100;

  let positiveHits = 0;
  let negativeHits = 0;
  for (const w of POSITIVE_WORDS) {
    const key = w.trim().toLowerCase();
    if (words[key]) positiveHits += words[key];
  }
  for (const w of NEGATIVE_WORDS) {
    const key = w.trim().toLowerCase();
    if (words[key]) negativeHits += words[key];
  }
  const totalHits = positiveHits + negativeHits || 1;
  const keywordSentiment = Math.round((positiveHits / totalHits) * 100);

  const sentimentScore = Math.round(ratingSentiment * 0.4 + keywordSentiment * 0.6);

  let sentimentLabel = '';
  let overallEmoji = '';
  if (sentimentScore >= 80) { sentimentLabel = 'ممتاز - رضا عالي جداً'; overallEmoji = '🔥'; }
  else if (sentimentScore >= 60) { sentimentLabel = 'جيد - رضا مقبول'; overallEmoji = '👍'; }
  else if (sentimentScore >= 40) { sentimentLabel = 'متوسط - يحتاج تحسين'; overallEmoji = '⚠️'; }
  else { sentimentLabel = 'ضعيف - يحتاج مراجعة'; overallEmoji = '🔴'; }

  // Topics
  const topicBreakdown = Object.entries(TOPIC_KEYWORDS).map(([key, config]) => {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const c of comments) {
      const hasKeyword = config.keywords.some(kw => c.includes(kw.toLowerCase()));
      if (hasKeyword) {
        const review = reviews[comments.indexOf(c)];
        if (review.rating >= 4) positive++;
        else if (review.rating <= 2) negative++;
        else neutral++;
      }
    }
    return { topic: config.label, positive, negative, neutral };
  });

  // Positive themes
  const positiveThemes: string[] = [];
  const negativeThemes: string[] = [];
  for (const t of topicBreakdown) {
    if (t.positive > 0) positiveThemes.push(`${t.topic}: ${t.positive} تعليق إيجابي`);
    if (t.negative > 0) negativeThemes.push(`${t.topic}: ${t.negative} تعليق سلبي`);
  }

  // Top words
  const topWords = Object.entries(words)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Recommendation
  let recommendation = '';
  if (sentimentScore >= 80) {
    recommendation = 'عملاءك سعداء جداً! حافظ على هذا المستوى وشارك آراءهم على وسائل التواصل.';
  } else if (sentimentScore >= 60) {
    if (negativeThemes.length > 0) {
      recommendation = `ركّز على تحسين: ${negativeThemes[0].split(':')[0]}. عملاؤك يقدّرون جهدك.`;
    } else {
      recommendation = 'النتيجة جيدة. شجّع عملاءك على ترك تعليقات أكثر لتعزيز التقييم.';
    }
  } else if (sentimentScore >= 40) {
    const weakest = topicBreakdown.reduce((min, t) =>
      (t.negative > min.negative) ? t : min, topicBreakdown[0]);
    recommendation = `يحتاج ${weakest.topic} اهتمام أكبر. راجع الملاحظات واعمل خطة تحسين.`;
  } else {
    recommendation = 'يجب مراجعة شاملة. ابدأ بتحليل أسباب الشكاوى الرئيسية والتركيز على الإصلاح.';
  }

  return { sentimentScore, sentimentLabel, positiveThemes, negativeThemes, topWords, topicBreakdown, recommendation, overallEmoji };
}
