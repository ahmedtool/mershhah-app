// Renders the official Saudi Riyal symbol via the bundled SaudiRiyalFont
// (see src/index.css) instead of the "ر.س" text abbreviation.
export function Riyal({ className }: { className?: string }) {
  return (
    <span className={className} style={{ fontFamily: "'SaudiRiyalFont', sans-serif" }} aria-label="ريال سعودي">
      &#xFDFC;
    </span>
  );
}
