import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
export type DashboardAssistantInput = {
  question: string;
  currentPage: string;
  menuItems?: any[];
  branches?: any[];
  offers?: any[];
  reviews?: any[];
  user?: { uid: string; restaurantId?: string; full_name?: string };
  locale?: 'ar' | 'en';
};

export type DashboardAssistantOutput = {
  answer: string;
  action?: {
    type: 'ADD_MENU_ITEM' | 'ADD_BRANCH' | 'ADD_OFFER' | 'EDIT_MENU_ITEM' | 'DELETE_MENU_ITEM' | 'NAVIGATE' | 'NONE';
    payload?: any;
  };
  cards?: { name: string; price?: number; image_url?: string; category?: string; description?: string }[];
  stats?: { label: string; value: string | number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u06D6-\u06ED\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

function match(text: string, ...keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some(k => n.includes(normalize(k)));
}

function extractNumbers(text: string): number[] {
  const arabicNums: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  let cleaned = text;
  Object.entries(arabicNums).forEach(([ar, en]) => { cleaned = cleaned.replace(new RegExp(ar, 'g'), en); });
  const matches = cleaned.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Intent Detection ─────────────────────────────────────────────────────────
function detectIntent(msg: string, ctx: {
  menuItems: any[];
  branches: any[];
  offers: any[];
  reviews: any[];
  currentPage: string;
}): {
  intent: string;
  extract?: Record<string, any>;
} {
  const n = normalize(msg);
  const numbers = extractNumbers(msg);

  // ── Greetings ─────────────────────────────────────────────────────────────
  if (match(msg, 'مرحبا', 'اهلا', 'هلا', 'السلام', 'صباح', 'مساء', 'hello', 'hi')) {
    return { intent: 'greeting' };
  }
  if (match(msg, 'شكر', 'مشكور', 'يعطيك', 'العفو', 'thanks', 'تسلم')) {
    return { intent: 'thanks' };
  }
  if (match(msg, 'اي', 'ايوة', 'ايوه', 'نعم', 'تمام', 'ok', 'تم', 'ممكن', 'ابي', 'أبي')) {
    return { intent: 'confirm' };
  }

  // ── Add Menu Item ─────────────────────────────────────────────────────────
  if (match(msg, 'اضف طبق', 'أضف طبق', 'اضافه طبق', 'إضافة طبق', 'ضيف طبق', 'ضيف لي طبق', 'add dish', 'add item', 'new dish', 'طبق جديد')) {
    // Parse sizes: "بيض مقلي الوسط بـ 12 ريال والكبير 18 ريال"
    // Pattern: name size1 price1 size2 price2 ...
    const sizeKeywords = ['الصغير', 'صغير', 'الوسط', 'وسط', 'الكبير', 'كبير', 'العملاق', 'عملاق', 'ال⚬', 'متوسط', 'كبير جدا'];
    
    // Extract name: everything before the first size keyword or first price
    let name: string | undefined;
    let sizes: { name: string; price: number }[] = [];
    
    // Try to find the product name (before first size keyword or price)
    const firstSizeIdx = sizeKeywords.reduce((minIdx, kw) => {
      const idx = msg.indexOf(kw);
      return idx !== -1 && idx < minIdx ? idx : minIdx;
    }, Infinity);
    
    const firstPriceIdx = (() => {
      const m = msg.match(/\d+\s*(ريال|ر\.س|sar)/i);
      return m ? msg.indexOf(m[0]) : Infinity;
    })();
    
    const nameEndIdx = Math.min(firstSizeIdx, firstPriceIdx);
    if (nameEndIdx !== Infinity && nameEndIdx > 2) {
      // Extract name from after "اضف" to before first size/price
      const afterAdd = msg.replace(/^(اضف|أضف|ضيف|اضافه|إضافة)\s+(?:طبق| dish| item)?\s*/i, '');
      const nameCandidate = afterAdd.substring(0, Math.min(afterAdd.length, nameEndIdx - msg.indexOf(afterAdd))).trim();
      // Remove any trailing prepositions
      name = nameCandidate.replace(/\s*(بـ|بسعر|بس|ب)\s*$/i, '').trim();
      if (name.length < 2) name = undefined;
    } else {
      // Fallback: extract name after "اضف"
      const nameMatch = msg.match(/(?:اضف|أضف|ضيف|اضافه|إضافة)\s+(?:طبق| dish| item)?\s*(.+)/i);
      if (nameMatch) {
        name = nameMatch[1].replace(/\d+\s*(ريال|ر\.س|sar)/i, '').trim();
        if (name.length < 2) name = undefined;
      }
    }
    
    // Parse sizes: look for "size price" patterns
    const sizePattern = /(الصغير|صغير|الوسط|وسط|الكبير|كبير|العملاق|عملاق|متوسط|كبير جدا)\s*(?:بـ|بسعر|بس|ب)?\s*(\d+)\s*(ريال|ر\.س|sar)?/gi;
    let sizeMatch;
    while ((sizeMatch = sizePattern.exec(msg)) !== null) {
      sizes.push({
        name: sizeMatch[1],
        price: parseInt(sizeMatch[2]),
      });
    }
    
    // Also check for reverse pattern: "12 ريال الوسط" or "12 ريال للوسط"
    const reverseSizePattern = /(\d+)\s*(ريال|ر\.س|sar)?\s*(?:لل|لـ|ل)?\s*(الصغير|صغير|الوسط|وسط|الكبير|كبير|العملاق|عملاق|متوسط)/gi;
    let revMatch;
    while ((revMatch = reverseSizePattern.exec(msg)) !== null) {
      const alreadyHas = sizes.some(s => normalize(s.name) === normalize(revMatch![3]));
      if (!alreadyHas) {
        sizes.push({
          name: revMatch[3],
          price: parseInt(revMatch[1]),
        });
      }
    }
    
    // If no sizes found but has a single price, use that as default
    if (sizes.length === 0) {
      const priceMatch = msg.match(/(\d+)\s*(ريال|ر\.س|sar)/i);
      const price = priceMatch ? parseInt(priceMatch[1]) : undefined;
      return { intent: 'add_menu_item', extract: { name, price, sizes: [] } };
    }
    
    return { intent: 'add_menu_item', extract: { name, sizes, hasSizes: true } };
  }

  // ── Add Branch ────────────────────────────────────────────────────────────
  if (match(msg, 'اضف فرع', 'أضف فرع', 'ضيف فرع', 'فرع جديد', 'add branch', 'new branch', 'فرع جديد')) {
    let cityName: string | undefined;
    const cities = ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الخبر', 'تبوك', 'أبها', 'الظهران', 'المبرز'];
    for (const city of cities) {
      if (match(msg, city)) { cityName = city; break; }
    }
    return { intent: 'add_branch', extract: { city: cityName } };
  }

  // ── Add Offer ─────────────────────────────────────────────────────────────
  if (match(msg, 'اضف عرض', 'أضف عرض', 'ضيف عرض', 'عرض جديد', 'add offer', 'new offer', 'عرض جديد', 'خصم جديد')) {
    const discountMatch = msg.match(/(\d+)\s*%/);
    const discount = discountMatch ? discountMatch[1] : undefined;
    return { intent: 'add_offer', extract: { discount } };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (match(msg, 'كم عدد', 'إحصائيات', 'احصائيات', 'stats', 'summary', 'ملخص', 'كم طبق', 'كم فرع', 'كم عرض', 'كم تقييم', 'عندي كم', 'وش عندي')) {
    return { intent: 'stats' };
  }

  // ── Platform Help ─────────────────────────────────────────────────────────
  if (match(msg, 'كيف اضيف', 'كيف أضيف', 'كيف اعدل', 'كيف أعدل', 'كيف احذف', 'كيف أحذف', 'وين اضيف', 'وين أضيف', 'وين اعدل', 'وين أعدل', 'how to add', 'how to edit', 'help me', 'ساعدني', 'مساعدة')) {
    return { intent: 'platform_help', extract: { question: msg } };
  }

  // ── Search ────────────────────────────────────────────────────────────────
  if (match(msg, 'ابحث', 'بحث', 'search', 'find', 'دور', 'ادور')) {
    const searchTerm = msg.replace(/(ابحث|بحث|search|find|دور|ادور)\s*(عن| عن| عن)?\s*/gi, '').trim();
    return { intent: 'search', extract: { term: searchTerm } };
  }

  // ── List Menu ─────────────────────────────────────────────────────────────
  if (match(msg, 'المنيو', 'قائمة الطعام', 'وش عندي من', 'وريني المنيو', 'وريني الأطباق', ' شوف المنيو', 'view menu', 'show menu', 'list menu', 'undi menu', 'عندي اطباق')) {
    return { intent: 'list_menu' };
  }

  // ── List Branches ─────────────────────────────────────────────────────────
  if (match(msg, 'الفروع', 'وريني الفروع', 'شوف الفروع', 'view branches', 'show branches', 'كم فرع')) {
    return { intent: 'list_branches' };
  }

  // ── List Offers ───────────────────────────────────────────────────────────
  if (match(msg, 'العروض', 'وريني العروض', 'شوف العروض', 'view offers', 'show offers', 'كم عرض')) {
    return { intent: 'list_offers' };
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  if (match(msg, 'التقييمات', 'التقييم', 'reviews', 'ratings', 'وريني التقييمات', 'شوف التقييمات', 'كم تقييم')) {
    return { intent: 'reviews' };
  }

  // ── Menu Item Info ────────────────────────────────────────────────────────
  for (const item of ctx.menuItems) {
    if (item.name && n.includes(normalize(item.name))) {
      return { intent: 'menu_item_info', extract: { itemName: item.name } };
    }
  }

  // ── Offers info ───────────────────────────────────────────────────────────
  if (match(msg, 'عرض', 'عروض', 'خصم', 'تخفيف')) {
    return { intent: 'list_offers' };
  }

  // ── Branches info ─────────────────────────────────────────────────────────
  if (match(msg, 'فرع', 'فروع', 'فرع')) {
    return { intent: 'list_branches' };
  }

  // ── Platform navigation ───────────────────────────────────────────────────
  if (match(msg, 'روح', 'روح ل', 'افتح', 'افتح صفحة', 'go to', 'open page')) {
    const pages: Record<string, string> = {
      'المنيو': '/owner/menu', 'menu': '/owner/menu',
      'التقارير': '/owner/pricing', 'reports': '/owner/pricing',
      'العروض': '/owner/offers', 'offers': '/owner/offers',
      'التقييمات': '/owner/reviews', 'reviews': '/owner/reviews',
      'الفروع': '/owner/branches', 'branches': '/owner/branches',
      'التخصيص': '/owner/customize', 'customize': '/owner/customize',
      'المتجر': '/owner/store', 'store': '/owner/store',
      'الدعم': '/owner/support', 'support': '/owner/support',
      'التذاكر': '/owner/tickets', 'tickets': '/owner/tickets',
      'الإعدادات': '/owner/settings', 'settings': '/owner/settings',
      'لوحة التحكم': '/owner/dashboard', 'dashboard': '/owner/dashboard',
    };
    for (const [key, path] of Object.entries(pages)) {
      if (match(msg, key)) {
        return { intent: 'navigate', extract: { path, label: key } };
      }
    }
  }

  // ── Help ──────────────────────────────────────────────────────────────────
  if (match(msg, 'وش تقدر', 'ايش تقدر', 'شنو تقدر', 'وش تسوي', 'ايش تسوي', 'what can you')) {
    return { intent: 'help' };
  }

  // ── Cost / Profit questions ────────────────────────────────────────────────
  if (match(msg, 'تكلف', 'تكلفة', 'التكلفة', 'الربح', 'ربح', 'كم يكلف', 'كم تكلفت', 'cost', 'profit', 'margin', 'هامش الربح')) {
    // Try to find which item
    for (const item of ctx.menuItems) {
      if (item.name && n.includes(normalize(item.name))) {
        return { intent: 'item_cost', extract: { itemName: item.name } };
      }
    }
    return { intent: 'cost_help' };
  }

  // ── Set Cost ───────────────────────────────────────────────────────────────
  if (match(msg, 'كلفة', 'تكلفه', 'تكلف', 'التكلفة', 'cost is', 'التكلفه')) {
    const costMatch = msg.match(/(\d+)\s*(ريال|ر\.س|sar)/i);
    if (costMatch) {
      const cost = parseInt(costMatch[1]);
      // Try to find which item
      for (const item of ctx.menuItems) {
        if (item.name && n.includes(normalize(item.name))) {
          return { intent: 'set_cost', extract: { itemName: item.name, cost } };
        }
      }
      return { intent: 'set_cost', extract: { cost } };
    }
  }

  // ── Allergen-free / Healthy ────────────────────────────────────────────────
  if (match(msg, 'حساسية', 'حساس', 'بدون حساسية', 'خالي من', 'free from', 'allergen', 'أكسلر', 'مقصي')) {
    // Find which allergen
    const allergenMap: Record<string, string> = {
      'مكسرات': 'nuts', 'حليب': 'milk', 'بيض': 'eggs', 'قمح': 'wheat',
      'سمك': 'fish', 'محار': 'shellfish', 'صويا': 'soy', 'سمسم': 'sesame', 'غلوتين': 'gluten',
    };
    for (const [ar, en] of Object.entries(allergenMap)) {
      if (match(msg, ar)) {
        return { intent: 'allergen_free', extract: { allergen: en, allergenName: ar } };
      }
    }
    return { intent: 'allergen_help' };
  }

  // ── Calories ───────────────────────────────────────────────────────────────
  if (match(msg, 'سعره', 'سعرات', 'سعرات حرارية', 'calori', 'سعرريه', 'السعره')) {
    // Find specific item
    for (const item of ctx.menuItems) {
      if (item.name && n.includes(normalize(item.name))) {
        return { intent: 'item_calories', extract: { itemName: item.name } };
      }
    }
    return { intent: 'calories_help' };
  }

  return { intent: 'unknown' };
}

// ─── Response Generator ───────────────────────────────────────────────────────
export async function dashboardAssistant(input: DashboardAssistantInput): Promise<DashboardAssistantOutput> {
  const ctx = {
    menuItems: input.menuItems || [],
    branches: input.branches || [],
    offers: input.offers || [],
    reviews: input.reviews || [],
    currentPage: input.currentPage,
  };

  const { intent, extract } = detectIntent(input.question, ctx);

  const replies: Record<string, () => DashboardAssistantOutput> = {
    greeting: () => ({
      answer: pickRandom([
        'أهلاً وسهلاً! 👋 أنا رفيق دربك. كيف أقدر أساعدك اليوم؟',
        'هلا فيك! 😊 أنا هنا أساعدك في أي شيء تبيه — منيو، عروض، فروع، أو أي سؤال ثاني.',
        'مرحباً! 🌟 وش تحتاج اليوم؟ أنا جاهز أساعدك!',
      ]),
    }),

    thanks: () => ({
      answer: pickRandom([
        'العفو! 😊 إذا عندك أي سؤال ثاني، أنا هنا!',
        'يا هلا! إذا تحتاج أي شي، لا تتردد! 🌟',
        'تسلم! 🙏 أي وقت تحتاج مساعدة، اسألني!',
      ]),
    }),

    confirm: () => ({
      answer: pickRandom([
        'تمام! هل تبي أساعدك في شي ثاني؟ 😊',
        'أوكي! اسألني عن أي شيء 🌟',
        'تمام 🙌 وش تحتاج ثاني؟',
      ]),
    }),

    // ── Add Menu Item ─────────────────────────────────────────────────────
    add_menu_item: () => {
      // Has sizes
      if (extract?.hasSizes && extract?.sizes?.length > 0) {
        const sizesList = extract.sizes.map((s: any) => `  • ${s.name}: ${s.price} ريال`).join('\n');
        const totalPrices = extract.sizes.map((s: any) => s.price);
        const minPrice = Math.min(...totalPrices);
        const maxPrice = Math.max(...totalPrices);
        return {
          answer: `🔄 جاري إضافة "${extract.name}" بـ ${extract.sizes.length} أحجام:\n${sizesList}\n\n💰 النطاق السعري: ${minPrice} - ${maxPrice} ريال`,
          action: {
            type: 'ADD_MENU_ITEM',
            payload: { name: extract.name, sizes: extract.sizes, hasSizes: true },
          },
        };
      }
      // Has single price
      if (extract?.name && extract?.price) {
        return {
          answer: `🔄 جاري إضافة "${extract.name}" بسعر ${extract.price} ريال...`,
          action: {
            type: 'ADD_MENU_ITEM',
            payload: { name: extract.name, price: extract.price },
          },
        };
      }
      // Has name but no price
      if (extract?.name) {
        return {
          answer: `تمام، تبي تضيف "${extract.name}". كم سعره؟\n\nأو قول لي بالأحجام:\n"الوسط بـ 12 ريال والكبير 18 ريال"`,
          action: { type: 'NONE' },
        };
      }
      // Nothing extracted
      return {
        answer: `📦 تبي تضيف طبق جديد؟ قول لي:\n\n**سعر واحد:**\n"أضف طبق شاورما بسعر 15 ريال"\n\n**أحجام متعددة:**\n"أضف بيض مقلي الوسط بـ 12 ريال والكبير 18 ريال"`,
        action: { type: 'NONE' },
      };
    },

    // ── Add Branch ────────────────────────────────────────────────────────
    add_branch: () => {
      if (extract?.city) {
        return {
          answer: `🔄 جاري إضافة فرع جديد في ${extract.city}...`,
          action: {
            type: 'ADD_BRANCH',
            payload: { city: extract.city },
          },
        };
      }
      return {
        answer: `🏢 تبي تضيف فرع جديد؟ قول لي:\n\n• المدينة\n• العنوان (اختياري)\n• رقم الجوال (اختياري)\n\nمثال: "أضف فرع في جدة"` ,
        action: { type: 'NONE' },
      };
    },

    // ── Add Offer ─────────────────────────────────────────────────────────
    add_offer: () => {
      if (extract?.discount) {
        return {
          answer: `🔄 جاري إضافة عرض بخصم ${extract.discount}%...`,
          action: {
            type: 'ADD_OFFER',
            payload: { discount: extract.discount },
          },
        };
      }
      return {
        answer: `🎯 تبي تضيف عرض جديد؟ قول لي:\n\n• عنوان العرض\n• الوصف\n• نسبة الخصم\n\nمثال: "أضف عرض خصم 20% على البرجر"` ,
        action: { type: 'NONE' },
      };
    },

    // ── Stats ─────────────────────────────────────────────────────────────
    stats: () => {
      const statsItems = [
        { label: '🍽️ الأطباق', value: ctx.menuItems.length },
        { label: '🏢 الفروع', value: ctx.branches.length },
        { label: '🎯 العروض', value: ctx.offers.length },
        { label: '⭐ التقييمات', value: ctx.reviews.length },
      ];
      const avgRating = ctx.reviews.length > 0
        ? (ctx.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ctx.reviews.length).toFixed(1)
        : '—';
      statsItems.push({ label: '📊 متوسط التقييم', value: avgRating });

      return {
        answer: `📊 ملخص حسابك:\n\n• 🍽️ ${ctx.menuItems.length} طبق في المنيو\n• 🏢 ${ctx.branches.length} فرع\n• 🎯 ${ctx.offers.length} عرض\n• ⭐ ${ctx.reviews.length} تقييم (متوسط: ${avgRating})`,
        stats: statsItems,
      };
    },

    // ── Platform Help ─────────────────────────────────────────────────────
    platform_help: () => {
      const q = extract?.question || '';
      if (match(q, 'طبق', 'منيو', 'أطباق', 'dish', 'menu', 'اكل')) {
        return {
          answer: `📝 لإضافة طبق جديد:\n\n1. اذهب إلى صفحة "المنيو" من النافبار\n2. اضغط "+ طبق جديد"\n3. أدخل اسم الطبق والسعر والوصف\n4. اضغط "حفظ"\n\nأو قول لي: "أضف طبق [الاسم] بسعر [السعر]" وأنا أساعدك! 😊`,
          action: { type: 'NAVIGATE', payload: { path: '/owner/menu' } },
        };
      }
      if (match(q, 'فرع', 'فروع', 'branch')) {
        return {
          answer: `📝 لإضافة فرع جديد:\n\n1. اذهب إلى صفحة "الفروع" من النافبار\n2. اضغط "+ فرع جديد"\n3. أدخل اسم الفرع وعنوانه\n4. اضغط "حفظ"\n\nأو قول لي: "أضف فرع في [المدينة]" وأنا أساعدك! 🏢`,
          action: { type: 'NAVIGATE', payload: { path: '/owner/branches' } },
        };
      }
      if (match(q, 'عرض', 'عروض', 'offer', 'خصم')) {
        return {
          answer: `📝 لإضافة عرض جديد:\n\n1. اذهب إلى صفحة "العروض" من النافبار\n2. اضغط "+ عرض جديد"\n3. أدخل عنوان العرض والوصف والخصم\n4. اضغط "حفظ"\n\nأو قول لي: "أضف عرض خصم [النسبة]%" وأنا أساعدك! 🎯`,
          action: { type: 'NAVIGATE', payload: { path: '/owner/offers' } },
        };
      }
      return {
        answer: `📖 أنا أقدر أساعدك في:\n\n• 🍽️ إضافة أطباق: "أضف طبق [الاسم] بسعر [السعر]"\n• 🏢 إضافة فروع: "أضف فرع في [المدينة]"\n• 🎯 إضافة عروض: "أضف عرض خصم [النسبة]%"\n• 📊 عرض الإحصائيات: "كم عدد أطبافي"\n• 🔍 بحث: "ابحث عن [الكلمة]"\n• 📄 الذهاب لصفحة: "روح للمنيو"\n\nجرّب أي أمر! 😊`,
      };
    },

    // ── Search ────────────────────────────────────────────────────────────
    search: () => {
      const term = extract?.term || '';
      if (!term) return { answer: 'قول لي وش تبي أبحث عنه؟ مثال: "ابحث عن شاورما"' };
      
      const results = ctx.menuItems.filter((item: any) =>
        item.name && normalize(item.name).includes(normalize(term))
      );
      if (results.length > 0) {
        const cards = results.slice(0, 5).map((i: any) => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category }));
        return {
          answer: `🔍 نتائج البحث عن "${term}":\n\n${results.slice(0, 5).map((i: any) => `• ${i.name}${i.price ? ` — ${i.price} ر.س` : ''}`).join('\n')}`,
          cards,
        };
      }
      return { answer: `🔍 ما لقيت نتائج لـ "${term}" في المنيو.` };
    },

    // ── List Menu ─────────────────────────────────────────────────────────
    list_menu: () => {
      if (ctx.menuItems.length === 0) {
        return { answer: '📋 المنيو فاضي حالياً. تبي تضيف أطباق جديدة؟ قول لي: "أضف طبق [الاسم] بسعر [السعر]"' };
      }
      const cards = ctx.menuItems.slice(0, 8).map((i: any) => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category, description: i.description }));
      return {
        answer: `📋 عندك ${ctx.menuItems.length} طبق في المنيو — تمرر عشان تتصفح 👆`,
        cards,
      };
    },

    // ── List Branches ─────────────────────────────────────────────────────
    list_branches: () => {
      if (ctx.branches.length === 0) {
        return { answer: '🏢 ما عندك فروع حالياً. تبي تضيف فرع جديد؟ قول لي: "أضف فرع في [المدينة]"' };
      }
      return {
        answer: `🏢 عندك ${ctx.branches.length} فروع:\n\n${ctx.branches.map((b: any) => `• ${b.name || 'الفرع'} — ${b.address || b.city || ''}`).join('\n')}`,
      };
    },

    // ── List Offers ───────────────────────────────────────────────────────
    list_offers: () => {
      if (ctx.offers.length === 0) {
        return { answer: '🎯 ما عندك عروض حالياً. تبي تضيف عرض جديد؟ قول لي: "أضف عرض خصم [النسبة]%"' };
      }
      return {
        answer: `🎯 عندك ${ctx.offers.length} عروض:\n\n${ctx.offers.map((o: any) => `• ${o.title}${o.discount ? ` (${o.discount}% خصم)` : ''}`).join('\n')}`,
      };
    },

    // ── Reviews ───────────────────────────────────────────────────────────
    reviews: () => {
      if (ctx.reviews.length === 0) {
        return { answer: '⭐ ما عندك تقييمات حالياً. التقييمات تظهر عندما يقيّم عملاؤك المطعم.' };
      }
      const avg = (ctx.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ctx.reviews.length).toFixed(1);
      return {
        answer: `⭐ عندك ${ctx.reviews.length} تقييم (متوسط: ${avg}/5)\n\nتبي تشوف التقييمات؟ [رابط صفحة التقييمات](/owner/reviews)`,
        action: { type: 'NAVIGATE', payload: { path: '/owner/reviews' } },
      };
    },

    // ── Menu Item Info ────────────────────────────────────────────────────
    menu_item_info: () => {
      const item = ctx.menuItems.find((i: any) => i.name && normalize(i.name) === normalize(extract?.itemName || ''));
      if (item) {
        let reply = `🍽️ ${item.name}\n`;
        if (item.price) reply += `💰 السعر: ${item.price} ر.س\n`;
        if (item.description) reply += `📝 ${item.description}\n`;
        if (item.category) reply += `📂 التصنيف: ${item.category}\n`;
        if (item.calories) reply += `🔥 السعرات: ${item.calories} سعرة\n`;
        if (item.allergens && item.allergens.length > 0) {
          const allergenNames: Record<string, string> = {
            nuts: '🥜 مكسرات', milk: '🥛 حليب', eggs: '🥚 بيض', wheat: '🌾 قمح',
            fish: '🐟 سمك', shellfish: '🦐 محار', soy: '🫘 فول الصويا', sesame: '⚪ سمسم', gluten: '🍞 غلوتين',
          };
          reply += `⚠️ الحساسية: ${item.allergens.map((a: string) => allergenNames[a] || a).join(' | ')}\n`;
        }
        if (item.sizes && item.sizes.length > 0) {
          reply += `\n📋 الأحجام:\n`;
          item.sizes.forEach((s: any) => {
            reply += `  • ${s.name}: ${s.price} ر.س`;
            if (s.calories) reply += ` (${s.calories} سعرة)`;
            reply += `\n`;
          });
        }
        return {
          answer: reply,
          cards: [{ name: item.name, price: item.price, image_url: item.image_url, category: item.category }],
        };
      }
      return { answer: `ما لقيت "${extract?.itemName}" في المنيو.` };
    },

    // ── Navigate ──────────────────────────────────────────────────────────
    navigate: () => {
      const path = extract?.path;
      const label = extract?.label;
      return {
        answer: `🔄 أخذك لصفحة "${label}"...`,
        action: { type: 'NAVIGATE', payload: { path } },
      };
    },

    // ── Help ──────────────────────────────────────────────────────────────
    help: () => ({
      answer: `🤖 أنا رفيق الدرب، أقدر أساعدك في:\n\n🍽️ **إضافة أطباق:** "أضف طبق [الاسم] بسعر [السعر]"\n🍽️ **أحجام:** "أضف بيض مقلي الوسط بـ 12 ريال والكبير 18 ريال"\n🏢 **إضافة فروع:** "أضف فرع في [المدينة]"\n🎯 **إضافة عروض:** "أضف عرض خصم [النسبة]%"\n📊 **الإحصائيات:** "كم عدد أطبافي"\n🔍 **البحث:** "ابحث عن [الكلمة]"\n💰 **التكلفة والربح:** "كم تكلفة شاورما"\n🔥 **السعرات:** "سعرات شاورما"\n⚠️ **الحساسية:** "خالي من المكسرات"\n📋 **عرض المنيو:** "وريني المنيو"\n📄 **التنقل:** "روح للمنيو"\n❓ **المساعدة:** "كيف أضيف طبق"\n\nجرّب أي أمر! 😊`,
    }),

    // ── Item Cost ─────────────────────────────────────────────────────────
    item_cost: () => {
      const item = ctx.menuItems.find((i: any) => i.name && normalize(i.name) === normalize(extract?.itemName || ''));
      if (item) {
        const hasSizes = item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0;
        let reply = `💰 ${item.name}\n\n`;
        
        if (hasSizes) {
          reply += `📋 الأحجام والأسعار:\n`;
          item.sizes.forEach((s: any) => {
            reply += `  • ${s.name}: ${s.price} ريال\n`;
          });
        } else {
          reply += `💰 سعر البيع: ${item.price || 'غير محدد'} ريال\n`;
        }
        
        if (item.profit) {
          reply += `💵 التكلفة: ${item.profit} ريال\n`;
          reply += `📈 هامش الربح: ${item['profitMargin'] || '—'}%\n`;
        } else {
          reply += `\n💡 ما عندنا بيانات التكلفة بعد. عشان نحسب الربح، قول لي:\n"كلفة ${item.name} [التكلفة] ريال"`;
        }
        
        return { answer: reply };
      }
      return { answer: `ما لقيت "${extract?.itemName}" في المنيو.` };
    },

    // ── Cost Help ─────────────────────────────────────────────────────────
    cost_help: () => ({
      answer: `💰 حساب التكلفة والربح:\n\nلحساب هامش الربح لأي طبق:\n1. أضف الطبق أولاً: "أضف طبق [الاسم] بسعر [السعر]"\n2. حدد التكلفة: "كلفة [الاسم] [التكلفة] ريال"\n3. بنحسب لك هامش الربح تلقائياً\n\n💡 مثال: إذا الشاورما بـ 15 ريال وتكلفتها 6 ريال:\n  → الربح: 9 ريال\n  → هامش الربح: 60%\n\nجرّب تسأل عن طبق معين: "كم تكلفة شاورما" 😊`,
    }),

    // ── Set Cost ──────────────────────────────────────────────────────────
    set_cost: () => {
      if (extract?.itemName && extract?.cost) {
        const item = ctx.menuItems.find((i: any) => i.name && normalize(i.name) === normalize(extract.itemName));
        if (item) {
          const price = item.price || 0;
          const cost = extract.cost;
          const profit = price - cost;
          const margin = price > 0 ? ((profit / price) * 100).toFixed(0) : '0';
          return {
            answer: `✅ تم تسجيل تكلفة "${item.name}"\n\n💰 سعر البيع: ${price} ريال\n💵 التكلفة: ${cost} ريال\n📈 الربح: ${profit} ريال\n📊 هامش الربح: ${margin}%`,
            action: {
              type: 'UPDATE_MENU_ITEM_COST',
              payload: { itemId: item.id, cost, profit, profitMargin: margin },
            },
          };
        }
        return { answer: `ما لقيت "${extract.itemName}" في المنيو.` };
      }
      return { answer: `قول لي التكلفة مثل:\n"كلفة شاورما 6 ريال"\n\nوأحسب لك هامش الربح! 💰` };
    },

    // ── Allergen Free ─────────────────────────────────────────────────────
    allergen_free: () => {
      const allergenName = extract?.allergenName || '';
      const allergen = extract?.allergen || '';
      const freeItems = ctx.menuItems.filter((item: any) => {
        if (!item.allergens || !Array.isArray(item.allergens)) return true;
        return !item.allergens.includes(allergen);
      });
      if (freeItems.length > 0) {
        const cards = freeItems.slice(0, 6).map((i: any) => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category }));
        return {
          answer: `✅ ${freeItems.length} طبق خالي من ${allergenName}:\n\n${freeItems.slice(0, 5).map((i: any) => `• ${i.name}${i.price ? ` — ${i.price} ر.س` : ''}`).join('\n')}\n\nتمرر عشان تتصفح 👆`,
          cards,
        };
      }
      return { answer: `⚠️ للأسف، كل الأطباق تحتوي على ${allergenName} حالياً.` };
    },

    allergen_help: () => ({
      answer: `⚠️ للبحث عن أطباق خالية من مادة حساسية معينة:\n\n• "خالي من المكسرات"\n• "بدون حليب"\n• "بيض خالي"\n• "بدون قمح"\n• "خالي من السمك"\n\nالمواد المتاحة:\n🥜 مكسرات | 🥛 حليب | 🥚 بيض | 🌾 قمح\n🐟 سمك | 🦐 محار | 🫘 صويا | ⚪ سمسم | 🍞 غلوتين`,
    }),

    // ── Item Calories ─────────────────────────────────────────────────────
    item_calories: () => {
      const item = ctx.menuItems.find((i: any) => i.name && normalize(i.name) === normalize(extract?.itemName || ''));
      if (item) {
        if (item.calories) {
          return { answer: `🔥 ${item.name} يحتوي على ${item.calories} سعرة حرارية.` };
        }
        if (item.sizes && item.sizes.length > 0) {
          const sizeCals = item.sizes.filter((s: any) => s.calories).map((s: any) => `• ${s.name}: ${s.calories} سعرة`);
          if (sizeCals.length > 0) {
            return { answer: `🔥 سعرات ${item.name} حسب الحجم:\n\n${sizeCals.join('\n')}` };
          }
        }
        return { answer: `ℹ️ ما عندنا بيانات السعرات الحرارية لـ "${item.name}" حالياً.` };
      }
      return { answer: `ما لقيت "${extract?.itemName}" في المنيو.` };
    },

    calories_help: () => ({
      answer: `🔥 للاطلاع على السعرات الحرارية:\n\n• "سعرات [اسم الطبق]"\n• "كم سعرة في [اسم الطبق]"\n\nأو شوف تفاصيل أي طبق وانظر السعرات! 😊`,
    }),

    // ── Unknown ───────────────────────────────────────────────────────────
    unknown: () => ({
      answer: pickRandom([
        `ما فهمت بالضبط 🤔 بس أقدر أساعدك في:\n• إضافة أطباق، فروع، عروض\n• عرض الإحصائيات\n• البحث في المنيو\n• التكلفة والربح\n• السعرات الحرارية\n• المواد الحساسية\n• الذهاب لأي صفحة\n\nجرّب تقول: "أضف طبق شاورما بسعر 15 ريال" 😊`,
        `ممم، جرّب تسألني عن:\n• "أضف طبق..." 🍽️\n• "أضف فرع..." 🏢\n• "أضف عرض..." 🎯\n• "كم عدد..." 📊\n• "وريني المنيو" 📋\n• "سعرات..." 🔥\n• "خالي من..." ⚠️\n\nوأنا جاهز! 😊`,
      ]),
    }),
  };

  const handler = replies[intent] || replies.unknown;
  return handler();
}
