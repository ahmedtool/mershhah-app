'use client';

import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// Replaces the browser's native <input type="color"> - its system dialog
// looks dated and inconsistent across OSes - with an in-app popover that
// matches the rest of the dashboard, plus a hex field for typing/pasting
// a code directly.
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface ColorSwatchPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const commitHex = (raw: string) => {
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (HEX_RE.test(normalized)) {
      onChange(normalized);
    } else {
      setHexInput(value);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer shrink-0"
          style={{ backgroundColor: value }}
          aria-label={value}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-3" align="end">
        <HexColorPicker color={value} onChange={onChange} />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ backgroundColor: value }} />
          <Input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={() => commitHex(hexInput)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitHex(hexInput);
                e.currentTarget.blur();
              }
            }}
            className="h-8 text-xs font-mono"
            dir="ltr"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
