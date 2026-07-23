
'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Calculator, Bot, BarChart, DollarSign } from "lucide-react";

export function CostSavingCalculator() {
    const [laborHours, setLaborHours] = useState(40);
    const [hourlyRate, setHourlyRate] = useState(25);
    const [foodWaste, setFoodWaste] = useState(500);
    const [wasteReductionPercent, setWasteReductionPercent] = useState(30);

    const laborCostSaved = laborHours * hourlyRate;
    const foodWasteSaved = foodWaste * (wasteReductionPercent / 100);
    const totalMonthlySavings = laborCostSaved + foodWasteSaved;
    const totalAnnualSavings = totalMonthlySavings * 12;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-primary" />
                    <CardTitle className="text-2xl font-bold">كيف 'مرشح' يوفر عليك؟ (حاسبة تفاعلية)</CardTitle>
                </div>
                <CardDescription>
                    جرّب تحرك المؤشرات وشوف كيف الأتمتة وتحليل البيانات توفر عليك فلوس صدق.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Labor Savings */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-5 h-5 text-muted-foreground"/>
                        <h4 className="font-semibold">توفير رواتب خدمة العملاء بالمساعد الذكي</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                        <div>
                            <label className="text-sm font-medium">ساعات خدمة العملاء شهرياً: <span className="font-bold text-primary">{laborHours} ساعة</span></label>
                            <Slider defaultValue={[40]} max={200} step={5} onValueChange={(val) => setLaborHours(val[0])} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">متوسط تكلفة ساعة الموظف: <span className="font-bold text-primary">{hourlyRate} ريال</span></label>
                            <Slider defaultValue={[25]} max={100} step={1} onValueChange={(val) => setHourlyRate(val[0])} />
                        </div>
                    </div>
                     <p className="text-center mt-2 text-green-600 font-semibold">توفير يوصل إلى: {laborCostSaved.toLocaleString()} ريال شهرياً</p>
                </div>

                {/* Food Waste Savings */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart className="w-5 h-5 text-muted-foreground"/>
                        <h4 className="font-semibold">تقليل هدر الأكل بتحليلات المنيو</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                        <div>
                            <label className="text-sm font-medium">قيمة الأكل المهدر شهرياً: <span className="font-bold text-primary">{foodWaste.toLocaleString()} ريال</span></label>
                            <Slider defaultValue={[500]} max={5000} step={50} onValueChange={(val) => setFoodWaste(val[0])} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">كم ممكن تقلل منه: <span className="font-bold text-primary">{wasteReductionPercent}%</span></label>
                            <Slider defaultValue={[30]} max={100} step={5} onValueChange={(val) => setWasteReductionPercent(val[0])} />
                        </div>
                    </div>
                     <p className="text-center mt-2 text-green-600 font-semibold">توفير يوصل إلى: {foodWasteSaved.toLocaleString()} ريال شهرياً</p>
                </div>

            </CardContent>
            <CardFooter>
                <div className="w-full space-y-4 rounded-lg bg-muted/50 p-4 text-center">
                     <div>
                        <p className="text-muted-foreground">مجموع التوفير الشهري مع 'مرشح'</p>
                        <p className="text-3xl font-extrabold text-green-600 flex items-center justify-center gap-2">
                            <DollarSign className="w-7 h-7" />
                            {totalMonthlySavings.toLocaleString()}
                            <span className="text-lg font-medium text-muted-foreground">ريال</span>
                        </p>
                    </div>
                    <Separator/>
                     <div>
                        <p className="text-muted-foreground">مجموع التوفير السنوي اللي ممكن توصله</p>
                        <p className="text-4xl font-extrabold text-foreground">
                           {totalAnnualSavings.toLocaleString()}
                           <span className="text-xl font-medium text-muted-foreground"> ريال</span>
                        </p>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
