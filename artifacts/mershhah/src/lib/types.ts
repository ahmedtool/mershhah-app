// Represents a record from the 'profiles' table. Defines WHO the user is.
export type Profile = {
  id: string; // Corresponds to auth.users.id
  full_name: string | null;
  email: string;
  phone_number: string | null;
  role: 'admin' | 'owner';
  account_status: 'active' | 'pending' | 'suspended';
  created_at: any; // Can be Timestamp
  updated_at?: any | null;
  restaurant_name?: string; // Denormalized for easier access
  restaurant_id?: string | null; // FK to restaurants collection
  admin_permissions?: string[];
  // Flag to control one-time AI trial access for free plans
  ai_trial_used?: boolean;
};

// Represents a record from the 'restaurants' table. Defines WHAT the user owns.
export type Restaurant = {
  id: string;
  owner_id: string; // FK to profiles.id
  name: string;
  name_en?: string; // English name
  username: string;
  username_last_updated_at?: any; // Can be Firestore Timestamp
  description: string | null;
  description_en?: string | null; // English description
  logo: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  buttonTextColor: string | null;
  borderRadius: number | null;
  fontFamily: string | null;
  socialLinks: Json | null;
  deliveryApps: Json | null;
  aiConfig: Json | null;
  created_at: any;
  updated_at?: any | null;
  analysis_daily_count?: number;
  analysis_last_reset?: any;
  analysis_reviews_daily_count?: number;
  analysis_reviews_last_reset?: any;
  pulse_daily_count?: number;
  pulse_last_reset?: any;
  reply_templates_daily_count?: number;
  reply_templates_last_reset?: any;
  feedback_summary_daily_count?: number;
  feedback_summary_last_reset?: any;
  content_writer_daily_count?: number;
  content_writer_last_reset?: any;
  image_generation_daily_count?: number;
  image_generation_last_reset?: any;
  maps_search_daily_count?: number;
  maps_search_last_reset?: any;
  maps_details_daily_count?: number;
  maps_details_last_reset?: any;
  menu_import_monthly_count?: number;
  menu_import_last_reset?: any;
  is_paid_plan?: boolean; // Control visibility of "Powered by" and other pro features
};

export type Branch = {
  id: string;
  restaurant_id: string;
  name: string;
  name_en?: string; // English name
  city: string;
  city_en?: string; // English city
  district: string;
  district_en?: string; // English district
  address: string;
  address_en?: string; // English address
  phone?: string;
  google_maps_url?: string;
  opening_hours?: string;
  opening_hours_en?: string; // English opening hours
  status: 'active' | 'inactive';
  latitude?: number;
  longitude?: number;
};

export type MenuItemSize = {
  id: string;
  name: string;
  name_en?: string; // English size name
  price: number;
  cost: number;
  calories?: number;
};

export type MenuItem = {
  id: string;
  name: string;
  name_en?: string; // English name
  description: string;
  description_en?: string; // English description
  category: string;
  category_en?: string; // English category
  image_url: string;
  status: 'available' | 'unavailable';
  display_tags: 'new' | 'best_seller' | 'daily_offer' | 'none';
  sizes: MenuItemSize[];
  restaurant_id: string; // FK to restaurants.id
  position?: number;
  image_last_generated_at?: any;
  description_last_generated_at?: any;
  createdAt?: any;
  clicks_count?: number;
  profit?: number;
  profitMargin?: number;
  popularity?: number;
  calories?: number; // Total calories (for simple items without sizes)
  allergens?: string[]; // e.g. ["مكسرات", "حليب", "قمح", "بيض", "سمك"]
  classification?: 'Star' | 'Plow-Horse' | 'Puzzle' | 'Dog';
};

export type Offer = {
  id: string;
  title: string;
  title_en?: string; // English title
  description: string;
  description_en?: string; // English description
  image_url: string;
  external_link?: string;
  valid_until: any; // Stored as ISO string or Timestamp
  status: 'active' | 'expired';
  restaurant_id: string; // FK to restaurants.id
  items?: string[];
  views_count?: number;
  clicks_count?: number;
  link_clicks_count?: number;
};

export type Subscription = {
    id: string;
    profile_id: string;
    plan_name: string;
    plan_id: string;
    status: 'active' | 'inactive' | 'cancelled';
    start_date: any;
    end_date: any;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];


// Live Support Chat
export type ChatSession = {
    id: string; // The owner's user ID
    ownerId: string;
    ownerName: string;
    ownerLogo?: string | null;
    lastMessage?: string;
    lastMessageTimestamp?: any; // Firestore Timestamp
    adminHasUnread?: boolean;
    ownerHasUnread?: boolean;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: 'admin' | 'owner';
  text?: string;
  timestamp: any; // Firestore Timestamp
  attachment_url?: string;
  attachment_type?: 'image' | 'file';
  attachment_filename?: string;
};

export type AiSession = {
    id: string;
    restaurant_id: string;
    created_at: any; // Firestore Timestamp
    last_activity_at: any; // Firestore Timestamp
}

export type AiMessage = {
    id: string;
    session_id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: any; // Firestore Timestamp
}

export type SupportTicket = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  restaurant_id: string;
  restaurant_name: string;
  category: 'complaint' | 'inquiry' | 'employment' | 'suggestion' | 'other';
  status: 'open' | 'contacted' | 'resolved' | 'closed';
  created_at: any;
};

export type Tool = {
  id: string;
  title: string;
  title_en?: string; // English title
  description: string;
  description_en?: string; // English description
  category: "marketing" | "operations" | "analytics";
  price_label: string;
  price_label_en?: string; // English price label
  icon: string;
  color: string;
  bg_color: string;
  popular: boolean;
  type: "free" | "paid";
  /**
   * مسار صورة الأداة في Firebase Storage (اختياري).
   * إذا كان موجوداً، يتم استخدامه في المتجر بدلاً من أيقونة Lucide.
   */
  image_path?: string | null;
  /**
   * نوع مدة الأداة:
   * - plan: تنتهي مع اشتراك مرشح الأساسي.
   * - addon: لها مدة خاصة بها (period_months).
   */
  billing_type?: "plan" | "addon";
  /**
   * المدة الافتراضية (بالأشهر) للأدوات من نوع addon.
   * إذا لم يتم تحديدها، يتم اعتباره شهراً واحداً عند التفعيل.
   */
  period_months?: number | null;
};

export type Application = {
  id: string;
  name: string;
  platform_id: string;
  logo_url: string;
  category: 'delivery' | 'loyalty' | 'payment' | 'other';
};

export type ActivatedTool = {
    tool_id: string;
    activated_at: any;
    expires_at: any;
};

export type Review = {
  id: string;
  restaurant_id: string;
  rating: number;
  comment?: string;
  createdAt: any; // Can be Timestamp
  is_visible?: boolean;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar?: string | null;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'update';
  isActive: boolean;
  targetRole: 'owner' | 'all';
  createdAt: any; // Firestore Timestamp
};

export type GeneratedImage = {
  id: string;
  storagePath: string;
  createdAt: any;
  expiresAt: any;
  sourceItemId: string;
  sourceItemName: string;
};

export type Plan = {
    id: string;
    name: string;
    name_en?: string; // English name
    description: string;
    description_en?: string; // English description
    price: number;
    duration_months: number;
    is_active: boolean;
    is_featured: boolean;
    payment_link?: string;
    /**
     * ميزات الباقة كما يحددها المدير.
     * المفتاح هو اسم الميزة، والقيمة true/false لتحديد إن كانت مشمولة في الباقة.
     * إذا لم تكن موجودة، يتم استخدام DEFAULT_PLAN_FEATURES كافتراضي.
     */
    features?: Record<string, boolean>;
};

export type ActivationCode = {
    id: string;
    tool_id: string;
    status: "unused" | "used";
    created_at: any; // Can be Timestamp
    used_by?: string;
    restaurant_id?: string;
    used_at?: any; // Can be Timestamp
}