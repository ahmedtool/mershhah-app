/**
 * استخراج ألوان من الشعار محلياً (بدون ذكاء اصطناعي).
 * يحلل صورة الشعار ويُرجع ألواناً مناسبة للواجهة.
 */

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** تجميع لون في دلو (تقريب للأقرب) لعدّ التكرارات */
function bucket(r: number, g: number, b: number, step = 32): string {
  const br = Math.round(r / step) * step;
  const bg = Math.round(g / step) * step;
  const bb = Math.round(b / step) * step;
  return `${br},${bg},${bb}`;
}

export type ExtractedPalette = {
  primaryColor: string;
  secondaryColor: string;
  buttonTextColor: string;
};

/**
 * يستخرج ألواناً من صورة (data URI أو URL).
 * اللون الأساسي من الشعار، الخلفية فاتحة، ولون النص على الأزرار أبيض أو أسود حسب الوضوح.
 */
export async function extractColorsFromImage(imageSource: string): Promise<ExtractedPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('لا يمكن رسم الشعار'));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const count: Record<string, { r: number; g: number; b: number; n: number }> = {};
        const step = 4;
        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;
          const lum = getLuminance(r, g, b);
          if (lum > 0.9) continue;
          if (lum < 0.15) continue;
          const key = bucket(r, g, b, 24);
          if (!count[key]) count[key] = { r, g, b, n: 0 };
          count[key].n++;
        }

        const sorted = Object.values(count).sort((a, b) => b.n - a.n);
        const primary = sorted[0];
        if (!primary) {
          resolve({
            primaryColor: '#714dfa',
            secondaryColor: '#f8f9fa',
            buttonTextColor: '#ffffff',
          });
          return;
        }

        const primaryColor = rgbToHex(primary.r, primary.g, primary.b);
        const luminance = getLuminance(primary.r, primary.g, primary.b);
        const buttonTextColor = luminance > 0.4 ? '#000000' : '#ffffff';
        const secondaryColor = '#f8f9fa';

        resolve({
          primaryColor,
          secondaryColor,
          buttonTextColor,
        });
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => reject(new Error('فشل تحميل الشعار'));
    img.src = imageSource;
  });
}
