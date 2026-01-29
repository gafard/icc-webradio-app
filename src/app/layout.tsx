import type { Metadata, Viewport } from 'next';
import './globals.css';
import DynamicRadioPlayer from '../components/DynamicRadioPlayer';
import { ModeProvider } from '../contexts/ModeContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import SettingsModal from '../components/SettingsModal';

export const metadata: Metadata = {
  title: 'ICC WebRadio',
  description: 'Plateforme de streaming chrétienne',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ICC WebRadio',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-512.png' }],
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
    <html lang="fr" suppressHydrationWarning>
      <body className="pb-[110px]">
        <ModeProvider>
          <SettingsProvider>
            {children}
            <SettingsModal />
            <DynamicRadioPlayer />
          </SettingsProvider>
        </ModeProvider>
      </body>
    </html>
  );
}