import { supabase } from '@/lib/supabase';

export async function getTools(): Promise<any[]> {
    try {
        const { data, error } = await supabase.from('tools').select('*');
        if (error) throw error;
        const tools: any[] = data || [];

        const marketingCalendarTool = {
            id: "marketing-calendar",
            title: "تقويم التسويق 2025",
            description: "تقويم عملي ومذهل مصمم للمطاعم السعودية، مليء بالأفكار المبتكرة والواقعية التي يمكنك تنفيذها فوراً.",
            category: "marketing",
            price_label: "مجاني",
            icon: "CalendarDays",
            color: "text-blue-500",
            bg_color: "bg-blue-500/10",
            popular: true,
            type: "free",
        };

        if (!tools.some((tool: any) => tool.id === marketingCalendarTool.id)) {
            tools.push(marketingCalendarTool);
        }

        return tools;
    } catch (error) {
        console.error("Error fetching tools:", error);
        return [];
    }
}

export async function getMenuByRestaurantId(restaurantId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching menu items by restaurant ID:', error);
    return [];
  }
}
