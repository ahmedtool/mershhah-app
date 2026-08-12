// On wide screens the centered content column leaves flat empty space on
// both sides. These two blurred brand-color glows turn that into
// intentional negative space instead of looking unfinished. Hidden below
// `lg` since this is mostly viewed on a phone via QR code, where there's
// no gutter to fill in the first place.
export function PublicPageBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="hidden lg:block fixed -top-24 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] pointer-events-none"
        style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 22%, transparent)' }}
      />
      <div
        aria-hidden
        className="hidden lg:block fixed -bottom-32 -left-24 w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none"
        style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 14%, transparent)' }}
      />
    </>
  );
}
