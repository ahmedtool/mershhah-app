'use client';

import { useRef, useState } from 'react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

function formatTo12(time: string): { hour: string; minute: string; period: string } {
  if (!time) return { hour: '', minute: '', period: 'ص' };
  const [h, m] = time.split(':');
  const hour24 = parseInt(h);
  const period = hour24 >= 12 ? 'م' : 'ص';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: String(hour12), minute: m, period };
}

function formatTo24(hour12: string, minute: string, period: string): string {
  if (!hour12) return '';
  let h = parseInt(hour12);
  if (period === 'م' && h !== 12) h += 12;
  if (period === 'ص' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute || '00'}`;
}

function formatDisplay(time: string): string {
  if (!time) return '--:--';
  const { hour, minute, period } = formatTo12(time);
  return `${hour}:${minute} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimePicker({ value, onChange, label, className = '' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const { hour, minute, period } = formatTo12(value);

  const handleHourClick = (h: string) => {
    onChange(formatTo24(h, minute, period));
  };

  const handleMinuteClick = (m: string) => {
    onChange(formatTo24(hour, m, period));
  };

  const handlePeriodClick = (p: string) => {
    onChange(formatTo24(hour, minute, p));
  };

  return (
    <div className={`relative ${className}`}>
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-right flex items-center justify-between text-sm hover:border-gray-300 transition-colors"
      >
        <span className={value ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {formatDisplay(value)}
        </span>
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
            <div className="flex gap-2 items-start">
              {/* Hour */}
              <div className="flex-1">
                <div className="text-center text-[10px] text-muted-foreground mb-1">الساعة</div>
                <div ref={hourRef} className="h-32 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 snap-y snap-mandatory">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourClick(h)}
                      className={`w-full h-8 flex items-center justify-center text-sm snap-center transition-all
                        ${h === hour ? 'bg-gray-900 text-white font-bold scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xl font-bold text-gray-300 mt-6">:</span>

              {/* Minute */}
              <div className="flex-1">
                <div className="text-center text-[10px] text-muted-foreground mb-1">الدقيقة</div>
                <div ref={minuteRef} className="h-32 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 snap-y snap-mandatory">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteClick(m)}
                      className={`w-full h-8 flex items-center justify-center text-sm snap-center transition-all
                        ${m === minute ? 'bg-gray-900 text-white font-bold scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xl font-bold text-gray-300 mt-6">:</span>

              {/* Period */}
              <div className="w-14">
                <div className="text-center text-[10px] text-muted-foreground mb-1">الوقت</div>
                <div className="h-32 rounded-lg border border-gray-100 bg-gray-50/50 flex flex-col">
                  <button
                    type="button"
                    onClick={() => handlePeriodClick('ص')}
                    className={`flex-1 flex items-center justify-center text-sm font-bold rounded-t-lg transition-all
                      ${period === 'ص' ? 'bg-gray-900 text-white scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    ص
                  </button>
                  <div className="h-px bg-gray-100" />
                  <button
                    type="button"
                    onClick={() => handlePeriodClick('م')}
                    className={`flex-1 flex items-center justify-center text-sm font-bold rounded-b-lg transition-all
                      ${period === 'م' ? 'bg-gray-900 text-white scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    م
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full mt-2 h-8 rounded-lg bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              تم
            </button>
          </div>
        </>
      )}
    </div>
  );
}
