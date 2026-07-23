export type RestaurantChatInput = { customerMessage: string; restaurantData: string; locale?: 'ar' | 'en' };
export type MenuItemCard = { name: string; price?: number; image_url?: string; category?: string; description?: string };
export type BranchCard = { name: string; address?: string; city?: string; district?: string; phone?: string; google_maps_url?: string };
export type OfferCard = { title: string; description?: string; image_url?: string; discount?: string };
export type RestaurantChatOutput = {
  smartReply: string;
  showApplications?: boolean;
  showBranches?: boolean;
  menuCards?: MenuItemCard[];
  branchCards?: BranchCard[];
  offerCards?: OfferCard[];
  totalBudget?: number;
};

interface RestaurantData {
  name: string;
  menu: Array<{ name: string; price?: number; image_url?: string; category?: string; description?: string; calories?: number }>;
  offers: Array<{ title: string; description?: string; image_url?: string; discount?: string }>;
  applications: Array<{ name: string; url: string }>;
  branches: Array<{ name?: string; address?: string; city?: string; phone?: string; google_maps_url?: string; district?: string }>;
  socialLinks: Array<{ platform: string; value: string }>;
}

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

// Fuzzy match - handles common typos by checking if words are similar
function fuzzyMatch(text: string, target: string): boolean {
  const n = normalize(text);
  const t = normalize(target);
  
  // Direct match
  if (n.includes(t) || t.includes(n)) return true;
  
  // Word-by-word match
  const nWords = n.split(/\s+/);
  const tWords = t.split(/\s+/);
  
  for (const nw of nWords) {
    for (const tw of tWords) {
      if (nw.length < 2 || tw.length < 2) continue;
      // Check if words are similar (share most characters)
      if (nw.includes(tw) || tw.includes(nw)) return true;
      // Check for common typos (swapped letters)
      if (nw.length >= 3 && tw.length >= 3) {
        for (let i = 0; i < nw.length - 1; i++) {
          const swapped = nw.slice(0, i) + nw[i + 1] + nw[i] + nw.slice(i + 2);
          if (swapped.includes(tw) || tw.includes(swapped)) return true;
        }
      }
    }
  }
  return false;
}

function match(text: string, ...keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some(k => n.includes(normalize(k)));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractNumbers(text: string): number[] {
  const arabicNums: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  let cleaned = text;
  Object.entries(arabicNums).forEach(([ar, en]) => { cleaned = cleaned.replace(new RegExp(ar, 'g'), en); });
  const matches = cleaned.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function detectIntent(msg: string, data: RestaurantData): {
  intent: string;
  item?: string;
  budget?: number;
  wantedCategories?: string[];
  quantity?: number;
  branchName?: string;
} {
  const n = normalize(msg);
  const numbers = extractNumbers(msg);

  // Quantity detection (e.g., "4 خيارات", "3 اطباق", "5 اصناف")
  let quantity: number | undefined;
  const quantityMatch = msg.match(/(\d+)\s*(اختيار|خيارات|طبق|اطباق|صنف|اصناف|شي|اشياء| options| items)/i);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1]);
  }

  // Budget detection - more robust
  const budgetPatterns = match(msg, 'ميزانيتي', 'ميزانيه', 'مHorizontally', 'بقالي', 'عندي', 'ابي', 'أبي', 'ب', 'عند');
  const hasBudgetWord = match(msg, 'ريال', 'ر.س', 'sar', 'فقط', 'بحدود', 'حد اقصى', 'حد اعلى');
  const hasBudget = budgetPatterns || hasBudgetWord;
  const budget = hasBudget && numbers.length > 0 ? numbers[0] : undefined;

  // Category detection - more comprehensive
  const wantedCategories: string[] = [];
  if (match(msg, 'طبق رئيسي', 'طبق رئيسي', 'الرئيسية', 'فطور', 'وجبه', 'وجبة', 'اكل اساسي', 'main course', 'main')) wantedCategories.push('main', 'appetizer', 'grill');
  if (match(msg, 'مشروب', 'مشروبات', 'drink', 'عصير', 'caafe', 'قهوة', 'شاي', 'ماء', 'بيبسي', 'بيبسي', 'فانتا', 'سفن', ' Sprite', ' water', 'juice')) wantedCategories.push('drinks', 'beverages');
  if (match(msg, 'حلويات', 'حلا', 'dessert', 'sweet', 'كيك', 'آيس كريم', 'ice cream', 'cake', 'شوكولاته', 'فاكهة')) wantedCategories.push('desserts', 'sweets');
  if (match(msg, 'سلطه', 'سلطة', 'مقبلات', 'appetizer', 'sides', 'جانبي', 'salad')) wantedCategories.push('sides', 'appetizer');
  if (match(msg, 'برجر', 'burger', 'ساندويتش', 'sandwich')) wantedCategories.push('burgers', 'sandwiches');
  if (match(msg, 'بيتزا', 'pizza')) wantedCategories.push('pizza');
  if (match(msg, 'مأكولات بحريه', 'سمك', 'shrimp', 'قريدس', 'seafood')) wantedCategories.push('seafood');
  if (match(msg, 'لحم', 'lamb', 'steak', 'ستيك', ' ribs', 'لحم')) wantedCategories.push('grill', 'main');
  if (match(msg, 'دجاج', 'chicken', 'فراخ', 'دجاجة')) wantedCategories.push('chicken', 'main');
  if (match(msg, 'رز', 'rice', 'ارز')) wantedCategories.push('rice', 'main');
  if (match(msg, 'معكرونه', 'معكرونة', 'pasta', 'نودلز')) wantedCategories.push('pasta', 'main');

  // Budget + categories = smart combo
  if (budget && wantedCategories.length > 0) {
    return { intent: 'budget_combo', budget, wantedCategories, quantity };
  }

  // Just budget without specific categories
  if (budget && !match(msg, 'منيو', 'قائمة', 'عرض')) {
    return { intent: 'budget_general', budget, quantity };
  }

  // Specific branch info (e.g., "رقم فرع القادسية", "هاتف فرع المحمدية", "متى يقفل فرع النزهة")
  if (match(msg, 'رقم', 'هاتف', 'جوال', 'مواعيد', 'عنوان', 'متى يقفل', 'متى يفتح', 'متى تقفل', 'ساعات') && match(msg, 'فرع')) {
    // Try to find which branch
    for (const branch of data.branches) {
      if (branch.name && n.includes(normalize(branch.name))) {
        return { intent: 'branch_info', branchName: branch.name };
      }
    }
    // If no specific branch found but asking about a branch
    return { intent: 'branches' };
  }

  // Menu / prices
  if (match(msg, 'منيو', 'قائمة', 'قائمه', 'طعام', 'اكل', 'أكل', 'شو فيه', 'ايش فيه', 'ايش عندك', 'شنو عندك', 'فيه ايش', 'اريد اكل')) {
    for (const item of data.menu) {
      if (n.includes(normalize(item.name))) {
        return { intent: 'menu_item', item: item.name };
      }
    }
    return { intent: 'menu' };
  }

  // Price of specific item
  for (const item of data.menu) {
    if (fuzzyMatch(msg, item.name) && match(msg, 'سعر', 'كم', 'بكم', 'السعر', 'كم سعره', 'بكم سعره', 'ابي اعرف', 'اعرف', 'قولي', 'قل لي', 'كم يسوى', 'كم تسعه', 'سوم', 'اطلب')) {
      return { intent: 'price', item: item.name };
    }
  }

  // Just asking about a specific item
  for (const item of data.menu) {
    if (fuzzyMatch(msg, item.name)) {
      return { intent: 'item_info', item: item.name };
    }
  }

  if (match(msg, 'عروض', 'عرض', 'تخفيف', 'خصم', 'خصومات')) return { intent: 'offers' };
  if (match(msg, 'فروع', 'فرع', 'عنوان', 'وين', 'فين', 'اين', 'الموقع', 'خريطه', 'خريطة')) return { intent: 'branches' };
  if (match(msg, 'افرع قريب', 'قرب', 'closest', 'near', 'اقرب فرع', 'وين اقرب', 'فرع قريب')) return { intent: 'nearest_branch' };
  if (match(msg, 'هاتف', 'جوال', 'رقم', 'تواصل', 'اتصال', 'واتساب', 'whatsapp')) return { intent: 'contact' };
  if (match(msg, 'انستا', 'انستقرام', 'تيك توك', 'سناب', 'تويتر', 'فيسبوك', 'يوتيوب')) return { intent: 'social' };
  if (match(msg, 'تطبيق', 'تطبيقات', 'app', 'تحميل')) return { intent: 'apps' };
  if (match(msg, 'مرحبا', 'اهلا', 'اهلين', 'السلام', 'هلا', 'hello', 'hi', 'مساء', 'صباح')) return { intent: 'greeting' };
  if (match(msg, 'شكر', 'مشكور', 'يعطيك', 'العفو', 'thanks', 'تسلم')) return { intent: 'thanks' };
  if (match(msg, 'مساعدة', 'ساعد', 'ابي مساعده')) return { intent: 'help' };
  if (match(msg, 'افضل', 'أفضل', 'توصيه', 'توصية', 'ايش تنصح', 'وش تنصح', 'recommend')) return { intent: 'recommend' };
  if (match(msg, 'سعرات', 'calori', 'صحي', 'دايت', 'diet')) return { intent: 'healthy' };
  if (match(msg, 'مواعيد', 'متى تفتح', 'متى تتقفل', 'to hours', 'open', 'close', 'متى تقفل', 'متى يقفل', 'متى يفتح', 'متى تبدون', 'متى تخلصون', 'توقفي', 'نهاية الدوام', 'بداية الدوام', 'الدوام', 'ساعات العمل', 'ساعات', 'الفتح', 'الاغلاق', 'اغلاق', 'فتو', 'تقفل', 'تقفلون', 'يفتح', 'يفتحون', 'ال蓐عة', 'ال蓐ع', 'الفرع يفتح', 'الفرع يقفل')) return { intent: 'hours' };
  if (match(msg, 'اي', 'ايوة', 'ايوه', 'نعم', 'تمام', 'occo', 'ok', 'تم', 'mfish', 'عادي', 'ممكن', 'لوسمحت', 'ابي', 'أبي')) return { intent: 'confirm' };

  return { intent: 'unknown' };
}

function findBestCombo(menu: RestaurantData['menu'], budget: number, categories: string[], maxItems: number = 4): MenuItemCard[] {
  const selected: MenuItemCard[] = [];
  let remaining = budget;

  for (const cat of categories) {
    if (selected.length >= maxItems) break;
    // Find items that match this category and fit within remaining budget
    const items = menu.filter(i => {
      const itemCat = normalize(i.category || '');
      const itemName = normalize(i.name);
      return (itemCat.includes(cat) || cat.includes(itemCat) || itemName.includes(cat)) && (i.price || 0) <= remaining;
    }).sort((a, b) => {
      // Prefer items closer to 60% of remaining budget for best value
      const targetPrice = remaining * 0.6;
      const diffA = Math.abs((a.price || 0) - targetPrice);
      const diffB = Math.abs((b.price || 0) - targetPrice);
      return diffA - diffB;
    });

    const best = items[0];
    if (best) {
      selected.push(best);
      remaining -= best.price || 0;
    }
  }

  // If budget still has room, add cheapest available items (up to maxItems)
  if (remaining > 0 && selected.length < maxItems) {
    const notSelected = menu
      .filter(i => !selected.some(s => s.name === i.name) && (i.price || 0) <= remaining && (i.price || 0) > 0)
      .sort((a, b) => (a.price || 0) - (b.price || 0));
    
    // Add more items to reach maxItems
    for (let i = 0; i < Math.min(notSelected.length, maxItems - selected.length); i++) {
      if (notSelected[i]) {
        selected.push(notSelected[i]);
        remaining -= notSelected[i].price || 0;
      }
    }
  }

  // If still has budget and only 1 item, try to add a drink
  if (remaining > 0 && selected.length === 1) {
    const drinks = menu.filter(i => {
      const cat = normalize(i.category || '');
      const name = normalize(i.name);
      return (cat.includes('drink') || cat.includes('beverage') || name.includes('مشروب') || name.includes('عصير') || name.includes('قهوة') || name.includes('ماء')) && (i.price || 0) <= remaining;
    }).sort((a, b) => (a.price || 0) - (b.price || 0));
    
    if (drinks[0]) {
      selected.push(drinks[0]);
      remaining -= drinks[0].price || 0;
    }
  }

  return selected;
}

function findBudgetItems(menu: RestaurantData['menu'], budget: number, maxItems: number = 4): MenuItemCard[] {
  return menu
    .filter(i => (i.price || 0) <= budget && (i.price || 0) > 0)
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, maxItems);
}

function formatMenuCards(items: MenuItemCard[]): string {
  return items.map(i => `• ${i.name}${i.price ? ` — ${i.price} ر.س` : ''}`).join('\n');
}

function calculateTotal(items: MenuItemCard[]): number {
  return items.reduce((sum, i) => sum + (i.price || 0), 0);
}

export async function restaurantChat(input: RestaurantChatInput): Promise<RestaurantChatOutput> {
  const data: RestaurantData = JSON.parse(input.restaurantData || '{}');
  const msg = input.customerMessage || '';
  const { intent, item, budget, wantedCategories, quantity, branchName } = detectIntent(msg, data);

  const replies: Record<string, () => RestaurantChatOutput> = {
    greeting: () => ({
      smartReply: pickRandom([
        `أهلاً وسهلاً! 👋 أنا مساعد ${data.name} الذكي. كيف أقدر أساعدك اليوم؟`,
        `هلا فيك! 😊 أنا هنا أساعدك في أي شيء تبيه عن ${data.name} — منيو، عروض، أو أي سؤال ثاني.`,
        `مرحباً! 🌟 تبي تشوف المنيو، تعرف العروض، أو تسأل عن أي شيء؟ أنا هنا!`,
      ]),
    }),

    budget_combo: () => {
      const maxItems = quantity || 4;
      const combo = findBestCombo(data.menu, budget!, wantedCategories!, maxItems);
      if (combo.length === 0) {
        return { smartReply: `ما لقيت أصناف تناسب ميزانيتك بالضبط، بس تقدر تشوف المنيو كله وتختار! 😊` };
      }
      const total = calculateTotal(combo);
      const remaining = budget! - total;
      const cards = combo.map(i => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category }));
      
      let reply = `✨ ${combo.length} خيارات بميزانية ${budget} ر.س\n💰 الإجمالي: ${total} ر.س`;
      if (remaining > 0) reply += ` | المتبقي: ${remaining} ر.س`;
      reply += `\nتمرر عشان تتصفح 👆`;
      return { smartReply: reply, menuCards: cards, totalBudget: budget };
    },

    budget_general: () => {
      const maxItems = quantity || 4;
      const items = findBudgetItems(data.menu, budget!, maxItems);
      if (items.length === 0) {
        return { smartReply: `ما عندنا أصناف بسعر ${budget} ر.س أو أقل، بس تقدر تشوف المنيو كله! 📋` };
      }
      const cards = items.map(i => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category }));
      return {
        smartReply: `💰 ${items.length} خيارات بميزانية ${budget} ر.س — تمرر عشان تتصفح 👆`,
        menuCards: cards,
        totalBudget: budget,
      };
    },

    menu: () => {
      const top = data.menu.slice(0, 8);
      const cards = top.map(i => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category, description: i.description }));
      return {
        smartReply: pickRandom([
          `📋 تمرر يمين ويسار عشان تشوف الأصناف 👆`,
          `هذا المنيو، تمرر عشان تتصفح 🍽️`,
          `انزل يمين ويسار عشان تشوف الباقي 👈👉`,
        ]),
        menuCards: cards,
      };
    },

    menu_item: () => {
      const found = data.menu.find(i => normalize(i.name) === normalize(item || ''));
      if (found) {
        const card = { name: found.name, price: found.price, image_url: found.image_url, category: found.category, description: found.description };
        return {
          smartReply: pickRandom([
            `🔥 ${found.name} — ${found.price ? `${found.price} ر.س` : 'السعر غير محدد'}\n\nتبي تعرف أصناف ثانية؟`,
            `${found.name} عندي! ${found.price ? `السعر: ${found.price} ر.س` : ''}\n\nتبيني أقترح لك شي ثاني؟ 😋`,
          ]),
          menuCards: [card],
        };
      }
      return { smartReply: `ما لقيت "${item}" بالضبط، بس عندنا أصناف ثانية! اسألني عن المنيو 😊` };
    },

    price: () => {
      const found = data.menu.find(i => normalize(i.name) === normalize(item || ''));
      if (found && found.price) {
        return {
          smartReply: pickRandom([
            `💰 سعر ${found.name}: ${found.price} ر.س`,
            `${found.name} بـ ${found.price} ر.س فقط! 🤩`,
          ]),
          menuCards: [{ name: found.name, price: found.price, image_url: found.image_url }],
        };
      }
      return { smartReply: `ما عندي السعر بالضبط، بس تقدر تشوف كل الأسعار بالمنيو! 📋` };
    },

    item_info: () => {
      const found = data.menu.find(i => normalize(i.name) === normalize(item || ''));
      if (found) {
        return {
          smartReply: `🍽️ ${found.name}${found.price ? ` — ${found.price} ر.س` : ''}${found.description ? `\n${found.description}` : ''}\n\nتبي شي ثاني؟`,
          menuCards: [{ name: found.name, price: found.price, image_url: found.image_url, category: found.category }],
        };
      }
      return { smartReply: `ما لقيت تفاصيل عن "${item}"، بس عندنا أصناف كثيرة! 😊` };
    },

    offers: () => {
      if (data.offers.length === 0) {
        return { smartReply: pickRandom([
          `حالياً ما عندنا عروض خاصة، بس تابعنا عشان نعلن عن عروض قريباً! 🔔`,
          `ما عندنا عروض الحين، بس قريباً بننزل عروض حلوة! 🎉`,
        ])};
      }
      const offerCards = data.offers.slice(0, 3).map(o => ({
        title: o.title,
        description: o.description,
        image_url: o.image_url,
        discount: o.discount,
      }));
      return {
        smartReply: pickRandom([
          `🔥 ${data.offers.length} عروض متاحة — تمرر عشان تتصفح 👆`,
          `هذي عروضنا الحالية، تمرر يمين ويسار 👈👉`,
          `🎯 شوف العروض — تمرر عشان تشوف الباقي`,
        ]),
        offerCards,
      };
    },

    branches: () => {
      if (data.branches.length === 0) {
        return { smartReply: `حالياً ما عندنا فروع ثانية، بس تقدر تطلب أونلاين! 📱` };
      }
      const branchCards = data.branches.map(b => ({
        name: b.name || 'الفرع',
        address: b.address,
        city: b.city,
        district: b.district,
        phone: b.phone,
        google_maps_url: b.google_maps_url,
      }));
      return {
        smartReply: pickRandom([
          `🏢 ${data.branches.length} فروع — تمرر عشان تتصفح 👆`,
          `هذي فروعنا، تمرر يمين ويسار 👈👉`,
          `📍 ${data.branches.length} فروع متاحة — اختر الأقرب لك`,
        ]),
        showBranches: true,
        branchCards,
      };
    },

    nearest_branch: () => {
      if (data.branches.length === 0) {
        return { smartReply: `حالياً ما عندنا فروع ثانية، بس تقدر تطلب أونلاين! 📱` };
      }
      const branchCards = data.branches.map(b => ({
        name: b.name || 'الفرع',
        address: b.address,
        city: b.city,
        district: b.district,
        phone: b.phone,
        google_maps_url: b.google_maps_url,
      }));
      return {
        smartReply: `📍 اختر فرعك وأضغط "الخريطة" عشان تشوف الأقرب لك`,
        showBranches: true,
        branchCards,
      };
    },

    branch_info: () => {
      const branch = data.branches.find(b => b.name && normalize(b.name) === normalize(branchName || ''));
      if (branch) {
        let reply = `📍 ${branch.name}\n\n`;
        if (branch.address) reply += `🏠 العنوان: ${branch.address}`;
        if (branch.city) reply += `، ${branch.city}`;
        reply += `\n`;
        if (branch.phone) reply += `📞 الجوال: ${branch.phone}\n`;
        if (branch.opening_hours) reply += `⏰ المواعيد: ${branch.opening_hours}\n`;
        if (branch.google_maps_url) reply += `🗺️ الخريطة: ${branch.google_maps_url}\n`;
        return {
          smartReply: reply,
          showBranches: true,
          branchCards: [{ name: branch.name, address: branch.address, city: branch.city, district: branch.district, phone: branch.phone, google_maps_url: branch.google_maps_url }],
        };
      }
      return { smartReply: `ما لقيت فرع "${branchName}"، بس عندنا فروع ثانية!`, showBranches: true };
    },

    contact: () => {
      const whatsapp = data.applications.find(a => normalize(a.name).includes('واتساب') || normalize(a.name).includes('whatsapp'));
      const phone = data.branches[0]?.phone;
      let reply = `📞 للتواصل:\n\n`;
      if (phone) reply += `• الجوال: ${phone}\n`;
      if (whatsapp) reply += `• واتساب: ${whatsapp.url}\n`;
      if (!phone && !whatsapp) reply += `تقدر تتواصل معنا عبر تطبيقاتنا أو السوشال ميديا!`;
      return { smartReply: reply, showApplications: true };
    },

    social: () => {
      if (data.socialLinks.length === 0) {
        return { smartReply: `ما حددنا حسابات التواصل بعد، بس تقدر تتواصل معنا عبر واتساب أو تطبيقاتنا! 📱`, showApplications: true };
      }
      const platforms = data.socialLinks.map(l => {
        const names: Record<string, string> = { instagram: 'انستقرام', tiktok: 'تيك توك', twitter: 'تويتر', snapchat: 'سناب شات', facebook: 'فيسبوك', youtube: 'يوتيوب' };
        return `• ${names[l.platform] || l.platform}: ${l.value}`;
      }).join('\n');
      return { smartReply: `📱 حساباتنا:\n\n${platforms}\n\nتابعنا! 🔔` };
    },

    apps: () => {
      if (data.applications.length === 0) {
        return { smartReply: `ما عندنا تطبيقات حالياً، بس تقدر تطلب أونلاين! 📱` };
      }
      const appList = data.applications.map(a => `• ${a.name}`).join('\n');
      return { smartReply: `📲 تطبيقات ${data.name}:\n\n${appList}`, showApplications: true };
    },

    recommend: () => {
      if (data.menu.length === 0) {
        return { smartReply: `ما أقدر أقترح لك الحين، بس اسألني عن المنيو! 😊` };
      }
      const top3 = data.menu.slice(0, 3);
      const cards = top3.map(i => ({ name: i.name, price: i.price, image_url: i.image_url, category: i.category }));
      const recText = top3.map(i => `⭐ ${i.name}${i.price ? ` — ${i.price} ر.س` : ''}`).join('\n');
      return { smartReply: `🌟 أنصحك تجرّب:\n\n${recText}\n\nهذي من الأكثر طلباً!`, menuCards: cards };
    },

    healthy: () => {
      const healthyItems = data.menu.filter(i => match(i.name, 'سلطة', 'مشوي', 'صحي', 'خضار', 'دجاج مشوي', 'سمك', 'grilled'));
      if (healthyItems.length > 0) {
        const cards = healthyItems.slice(0, 3).map(i => ({ name: i.name, price: i.price, image_url: i.image_url }));
        return { smartReply: `💪 أصناف صحية:\n\n${formatMenuCards(healthyItems.slice(0, 3))}\n\nتبي تعرف أكثر؟`, menuCards: cards };
      }
      return { smartReply: `ما حددنا أصناف صحية بشكل خاص، بس تقدر تتأكد من المكونات! 🥗` };
    },

    hours: () => {
      if (data.branches.length > 0) {
        const branchList = data.branches.map(b => {
          let info = `📍 ${b.name || 'الفرع'}`;
          if (b.opening_hours) info += `\n⏰ ${b.opening_hours}`;
          if (b.phone) info += `\n📞 ${b.phone}`;
          return info;
        }).join('\n\n');
        return {
          smartReply: `🕐 مواعيد الدوام:\n\n${branchList}\n\nتبي تتصل بفرع معين؟`,
          showBranches: true,
        };
      }
      return {
        smartReply: pickRandom([
          `⏰ مواعيد الدوام متغيرة حسب الفرع. تبي تتصل بفرع؟`,
          `🕐 ما عندي معلومات المواعيد بالضبط، بس تقدر تتصل فينا!`,
        ]),
        showBranches: true,
      };
    },

    confirm: () => ({
      smartReply: pickRandom([
        `تمام! هل تبي أساعدك في شي ثاني؟ 😊`,
        `أوكي! اسألني عن أي شيء — منيو، عروض، فروع، أو تواصل 🌟`,
        `تمام 🙌 وش تحتاج ثاني؟`,
      ]),
    }),

    thanks: () => ({
      smartReply: pickRandom([
        `العفو! 😊 إذا عندك أي سؤال ثاني، أنا هنا!`,
        `يا هلا! إذا تحتاج أي شي، لا تتردد! 🌟`,
        `تسلم! 🙏 أي وقت تحتاج مساعدة، اسألني!`,
      ]),
    }),

    help: () => ({
      smartReply: `أقدر أساعدك في:\n\n• 📋 المنيو والأسعار\n• 🔥 العروض\n• 📍 الفروع\n• 📞 التواصل\n• 📱 التطبيقات\n• ⭐ التوصيات\n• 💰 اقتراحات حسب الميزانية\n\nجرّب تقولي: "ميزانيتي 40 ريال وأبي طبق رئيسي ومشروب" 😊`,
    }),

    unknown: () => ({
      smartReply: pickRandom([
        `ما فهمت بالضبط 🤔 بس أقدر أساعدك في المنيو، العروض، الفروع، أو أي سؤال عن ${data.name}!`,
        `ممم، جرّب تسألني عن:\n• المنيو والأسعار\n• العروض\n• الفروع\n• "ميزانيتي X ريال وأبي..." 💡\n\nوأنا جاهز! 😊`,
      ]),
    }),
  };

  const handler = replies[intent] || replies.unknown;
  return handler();
}
