'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, Plus, Trash2, Download, Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

interface Employee {
  id: string;
  name: string;
  position: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  gosi: number;
  loans: number;
  absence: number;
  otherDeductions: number;
}

const defaultEmployee: Employee = {
  id: crypto.randomUUID(),
  name: '',
  position: '',
  basicSalary: 0,
  housingAllowance: 0,
  transportAllowance: 0,
  otherAllowances: 0,
  gosi: 0,
  loans: 0,
  absence: 0,
  otherDeductions: 0,
};

export default function SalaryCalculatorPage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([{ ...defaultEmployee }]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);

  const addEmployee = () => {
    setEmployees([...employees, { ...defaultEmployee, id: crypto.randomUUID() }]);
  };

  const removeEmployee = (id: string) => {
    if (employees.length === 1) return;
    setEmployees(employees.filter(e => e.id !== id));
  };

  const updateEmployee = (id: string, field: keyof Employee, value: string | number) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const calculateTotals = (emp: Employee) => {
    const totalAllowances = emp.housingAllowance + emp.transportAllowance + emp.otherAllowances;
    const grossSalary = emp.basicSalary + totalAllowances;
    const totalDeductions = emp.gosi + emp.loans + emp.absence + emp.otherDeductions;
    const netSalary = grossSalary - totalDeductions;
    return { totalAllowances, grossSalary, totalDeductions, netSalary };
  };

  const calculateGOSI = (basicSalary: number) => {
    // GOSI employee share: 11% of basic salary (capped at SAR 45,000)
    const capped = Math.min(basicSalary, 45000);
    return Math.round(capped * 0.11);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0 }).format(amount);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const salaryData = employees.map(emp => {
        const totals = calculateTotals(emp);
        return {
          employee_name: emp.name,
          position: emp.position,
          basic_salary: emp.basicSalary,
          housing_allowance: emp.housingAllowance,
          transport_allowance: emp.transportAllowance,
          other_allowances: emp.otherAllowances,
          gosi: emp.gosi,
          loans: emp.loans,
          absence: emp.absence,
          other_deductions: emp.otherDeductions,
          gross_salary: totals.grossSalary,
          total_deductions: totals.totalDeductions,
          net_salary: totals.netSalary,
        };
      });

      const { error } = await supabase.from('salary_records').insert({
        profile_id: user.id,
        month,
        employees: salaryData,
        total_gross: salaryData.reduce((s, e) => s + e.gross_salary, 0),
        total_net: salaryData.reduce((s, e) => s + e.net_salary, 0),
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const grandTotals = employees.reduce((acc, emp) => {
    const t = calculateTotals(emp);
    return {
      gross: acc.gross + t.grossSalary,
      deductions: acc.deductions + t.totalDeductions,
      net: acc.net + t.netSalary,
    };
  }, { gross: 0, deductions: 0, net: 0 });

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Calculator className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">حاسبة الرواتب</h1>
            <p className="text-xs text-gray-600">احسب رواتب موظفينك بسهولة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 px-3 rounded-xl border border-gray-200 text-xs text-right"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            حفظ
          </button>
        </div>
      </div>

      {/* Employees */}
      <div className="space-y-4">
        {employees.map((emp, index) => {
          const totals = calculateTotals(emp);
          return (
            <Card key={emp.id} className="border-gray-100">
              <CardContent className="p-5 space-y-4">
                {/* Employee Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      placeholder="اسم الموظف"
                      value={emp.name}
                      onChange={(e) => updateEmployee(emp.id, 'name', e.target.value)}
                      className="h-10 px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 w-40"
                    />
                    <input
                      type="text"
                      placeholder="الوظيفة"
                      value={emp.position}
                      onChange={(e) => updateEmployee(emp.id, 'position', e.target.value)}
                      className="h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-600 w-32"
                    />
                  </div>
                  {employees.length > 1 && (
                    <button
                      onClick={() => removeEmployee(emp.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Allowances */}
                <div>
                  <p className="text-[10px] font-bold text-gray-600 mb-2">البدلات</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">الراتب الأساسي</label>
                      <input
                        type="number"
                        value={emp.basicSalary || ''}
                        onChange={(e) => updateEmployee(emp.id, 'basicSalary', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">بدل سكن</label>
                      <input
                        type="number"
                        value={emp.housingAllowance || ''}
                        onChange={(e) => updateEmployee(emp.id, 'housingAllowance', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">بدل نقل</label>
                      <input
                        type="number"
                        value={emp.transportAllowance || ''}
                        onChange={(e) => updateEmployee(emp.id, 'transportAllowance', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">بدلات أخرى</label>
                      <input
                        type="number"
                        value={emp.otherAllowances || ''}
                        onChange={(e) => updateEmployee(emp.id, 'otherAllowances', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-[10px] font-bold text-gray-600 mb-2">الخصومات</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">التأمينات (GOSI)</label>
                      <input
                        type="number"
                        value={emp.gosi || ''}
                        onChange={(e) => updateEmployee(emp.id, 'gosi', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">سلفات</label>
                      <input
                        type="number"
                        value={emp.loans || ''}
                        onChange={(e) => updateEmployee(emp.id, 'loans', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">غياب</label>
                      <input
                        type="number"
                        value={emp.absence || ''}
                        onChange={(e) => updateEmployee(emp.id, 'absence', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 mb-1 block">خصومات أخرى</label>
                      <input
                        type="number"
                        value={emp.otherDeductions || ''}
                        onChange={(e) => updateEmployee(emp.id, 'otherDeductions', Number(e.target.value))}
                        className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-gray-600">الراتب الإجمالي</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(totals.grossSalary)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">إجمالي الخصومات</p>
                    <p className="text-sm font-bold text-red-500">{formatCurrency(totals.totalDeductions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">صافي الراتب</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(totals.netSalary)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Employee */}
      <button
        onClick={addEmployee}
        className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 text-gray-600 text-xs font-bold hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        إضافة موظف
      </button>

      {/* Grand Total */}
      {employees.length > 1 && (
        <Card className="border-gray-100 bg-gray-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
              <div>
                <p className="text-[10px] text-gray-600">إجمالي الرواتب</p>
                <p className="text-lg font-black text-gray-900">{formatCurrency(grandTotals.gross)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600">إجمالي الخصومات</p>
                <p className="text-lg font-black text-red-500">{formatCurrency(grandTotals.deductions)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600">صافي الإجمالي</p>
                <p className="text-lg font-black text-emerald-600">{formatCurrency(grandTotals.net)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
