
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { HydrationGate } from '@/components/shared/HydrationGate';
import { LanguageProvider } from '@/components/shared/LanguageContext';

const siteUrl = 'https://mershhah.com';
const logoUrl = 'https://i.ibb.co/7x0KgVyv/image.png';



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href={logoUrl} />
      </head>
      <body className="antialiased bg-background text-foreground" suppressHydrationWarning>
        <div id="app-root" suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <LanguageProvider>
              <HydrationGate>
                {children}
                <Toaster />
              </HydrationGate>
            </LanguageProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
