import type { Metadata } from 'next';
import localFont from 'next/font/local';
import OurThemeProvider from '@/components/providers/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

// Satoshi font for English
const satoshi = localFont({
  src: [
    {
      path: '../public/fonts/Satoshi/Satoshi-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-Black.otf',
      weight: '900',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-LightItalic.otf',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-MediumItalic.otf',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../public/fonts/Satoshi/Satoshi-BlackItalic.otf',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-satoshi',
  display: 'swap',
});

// ExpoArabic font for Arabic
const expoArabic = localFont({
  src: [
    {
      path: '../public/fonts/ExpoArabic/ExpoArabic-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/ExpoArabic/ExpoArabic-Book.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/ExpoArabic/ExpoArabic-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/ExpoArabic/ExpoArabic-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/ExpoArabic/ExpoArabic-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-expo-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Admin Panel',
    template: '%s | Admin Panel',
  },
  description: 'Admin Dashboard',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const fontClass = locale === 'ar' ? expoArabic.variable : satoshi.variable;

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={fontClass}
    >
      <body
        className={`antialiased ${locale === 'ar' ? 'font-expo-arabic' : 'font-satoshi'}`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <OurThemeProvider>{children}</OurThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
