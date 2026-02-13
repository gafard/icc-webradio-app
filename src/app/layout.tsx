import type { Metadata, Viewport } from 'next';
import { Manrope, Merriweather, Special_Elite } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import DynamicRadioPlayer from '../components/DynamicRadioPlayer';
import MobileRadioPlayer from '../components/MobileRadioPlayer';
import { ModeProvider } from '../contexts/ModeContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { I18nProvider } from '../contexts/I18nContext';
import SettingsModal from '../components/SettingsModal';
import GlobalCallManager from '../components/GlobalCallManager';
import NotificationManager from '../components/NotificationManager';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const specialElite = Special_Elite({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-typewriter',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
});

const tiktokSans = localFont({
  src: [
    {
      path: './fonts/TikTokSans-Latin.woff2',
      style: 'normal',
      weight: '300 900',
    },
  ],
  variable: '--font-tiktok-sans',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'ICC WebRadio',
  description: 'Plateforme de streaming chrétienne',
  applicationName: 'ICC WebRadio',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ICC WebRadio',
  },
  icons: {
    icon: [
      { url: '/icons/app-icon-pwa-192.jpg', sizes: '192x192', type: 'image/jpeg' },
      { url: '/icons/app-icon-pwa.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
    apple: [{ url: '/icons/app-icon-pwa.jpg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning={true}
      className={`${manrope.variable} ${specialElite.variable} ${merriweather.variable} ${tiktokSans.variable}`}
    >
      <body className="pb-[110px] font-sans antialiased" suppressHydrationWarning={true}>
        <I18nProvider>
          <ModeProvider>
            <SettingsProvider>
              {children}
              <SettingsModal />
              <NotificationManager />
              <GlobalCallManager />
              <DynamicRadioPlayer />
              <MobileRadioPlayer />
            </SettingsProvider>
          </ModeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
