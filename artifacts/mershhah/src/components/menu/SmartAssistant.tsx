'use client';

import { useState, useTransition, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, X, Users, Wallet, ThumbsUp, Loader2, Bot, ShoppingBasket, Plus, Minus } from 'lucide-react';
import { suggestMenuCombo, SuggestMenuComboOutput } from '@/ai/flows/suggest-menu-combo';
import type { MenuItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type Stage = 'closed' | 'people' | 'budget' | 'preferences' | 'loading' | 'results';

interface SmartAssistantProps {
  menuItems: MenuItem[];
  primaryColor: string;
}

export function SmartAssistant({ menuItems, primaryColor }: SmartAssistantProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('closed');
  const [peopleCount, setPeopleCount] = useState(2);
  const [budget, setBudget] = useState(100);
  const [preferences, setPreferences] = useState('');
  const [isGenerating, startGeneration] = useTransition();
  const [suggestion, setSuggestion] = useState<SuggestMenuComboOutput | null>(null);

  const openAssistant = () => {
    setIsOpen(true);
    setStage('people');
  };

  const closeAssistant = () => {
    setIsOpen(false);
    // Delay stage reset to allow for closing animation
    setTimeout(() => {
        setStage('closed');
        setSuggestion(null);
        setPreferences('');
    }, 300);
  };
  
  const smartPreferenceOptions = useMemo(() => {
    if (!menuItems) return [];
    const options = new Set<string>();

    const categoryTranslations: {[key: string]: string} = {
        main: 'أطباق رئيسية',
        appetizer: 'مقبلات',
        dessert: 'حلى',
        drink: 'مشروبات',
        breakfast: 'فطور',
    };

    const categories = new Set(menuItems.map(item => item.category));
    categories.forEach(cat => {
        if (categoryTranslations[cat]) {
            options.add(categoryTranslations[cat]);
        }
    })

    menuItems.forEach(item => {
        const text = `${item.name} ${item.description || ''}`.toLowerCase();
        if (text.includes('مشوي') || text.includes('جريل')) options.add('مشويات');
        if (text.includes('بحري') || text.includes('سمك') || text.includes('روبيان')) options.add('مأكولات بحرية');
        if (text.includes('نباتي')) options.add('نباتي');
        if (text.includes('صحي')) options.add('صحي');
        if (text.includes('دجاج')) options.add('دجاج');
        if (text.includes('لحم')) options.add('لحم');
    });

    return Array.from(options).slice(0, 5); // Limit to 5 for UI
  }, [menuItems]);

  const handleGenerate = () => {
      startGeneration(async () => {
          setStage('loading');
          try {
              const simplifiedMenu = menuItems
                .filter(item => item.status === 'available' && item.sizes && item.sizes.length > 0)
                .map(item => ({
                    name: item.name,
                    description: item.description,
                    category: item.category,
                    price: item.sizes[0].price,
                }));

              const result = await suggestMenuCombo({
                  menuItems: simplifiedMenu,
                  peopleCount: peopleCount,
                  budget: budget,
                  preferences: preferences,
              });
              setSuggestion(result);
              setStage('results');
          } catch(e: any) {
              toast({ title: "خطأ", description: "لم نتمكن من إنشاء الاقتراح. حاول مرة أخرى.", variant: "destructive"});
              setStage('preferences'); // Go back to the last step
          }
      });
  }

  const renderContent = () => {
    switch (stage) {
      case 'people':
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users />كم عددكم؟</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
               <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setPeopleCount(p => Math.max(1, p - 1))}><Minus /></Button>
                  <span className="text-4xl font-bold w-16 text-center">{peopleCount}</span>
                  <Button variant="outline" size="icon" onClick={() => setPeopleCount(p => p + 1)}><Plus /></Button>
              </div>
            </CardContent>
            <Button onClick={() => setStage('budget')} className="w-full">التالي</Button>
          </>
        );
      case 'budget':
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet />ما هي ميزانيتكم الإجمالية؟</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center gap-2">
              <div className="relative">
                  <Input 
                    type="number" 
                    value={budget} 
                    onChange={e => setBudget(Number(e.target.value))} 
                    className="text-4xl font-bold h-20 text-center pr-12"
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-semibold">ر.س</span>
              </div>
            </CardContent>
            <Button onClick={() => setStage('preferences')} className="w-full">التالي</Button>
          </>
        );
      case 'preferences':
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ThumbsUp />هل لديكم تفضيلات معينة؟</CardTitle>
              <CardDescription>اختر من الاقتراحات الذكية أو اكتب ما تفضله.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <Input 
                placeholder="مثال: أكل نباتي، بدون فلفل..." 
                value={preferences}
                onChange={e => setPreferences(e.target.value)}
              />
              {smartPreferenceOptions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">اقتراحات ذكية:</p>
                    <div className="flex flex-wrap gap-2">
                        {smartPreferenceOptions.map(option => (
                            <Button 
                              key={option} 
                              variant="outline" 
                              size="sm"
                              className="rounded-full"
                              onClick={() => setPreferences(prev => prev ? `${prev}, ${option}` : option)}
                            >
                              {option}
                            </Button>
                        ))}
                    </div>
                </div>
              )}
            </CardContent>
            <Button onClick={handleGenerate} className="w-full">اقترح لي!</Button>
          </>
        );
       case 'loading':
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <h3 className="font-semibold">لحظات... يقوم المساعد بإعداد اقتراحكم المثالي.</h3>
            </div>
        );
        case 'results':
            if (!suggestion) return null;
            return (
                <>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot />هذا هو اقتراحي لكم!</CardTitle>
                    <CardDescription>{suggestion.summary}</CardDescription>
                 </CardHeader>
                 <CardContent className="flex-1 space-y-3 overflow-y-auto">
                    {suggestion.suggestedItems.map(item => (
                        <div key={item.name} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <p className="font-bold">{item.quantity} x {item.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                        </div>
                    ))}
                 </CardContent>
                 <div className="p-4 border-t text-center space-y-3">
                    <p className="text-lg font-bold">الإجمالي: <span style={{ color: primaryColor }}>{suggestion.totalPrice.toFixed(2)} ر.س</span></p>
                    <Button onClick={closeAssistant} className="w-full">رائع، شكراً!</Button>
                 </div>
                </>
            );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}>
            <Button
              onClick={openAssistant}
              size="lg"
              className="rounded-full shadow-lg h-14 px-6"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="ml-2 h-5 w-5" />
              <span className="font-bold text-base">اقتراح ذكي لوجبتك</span>
            </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={closeAssistant}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[70vh] z-50 p-4 pt-8"
          >
            <Card className="w-full h-full max-w-lg mx-auto flex flex-col shadow-2xl">
              <Button variant="ghost" size="icon" className="absolute top-2 left-2 h-8 w-8 rounded-full bg-muted" onClick={closeAssistant}><X className="h-4 w-4" /></Button>
              {renderContent()}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
