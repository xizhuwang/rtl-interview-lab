import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://xizhuwang.github.io/rtl-interview-lab/'),
  title: 'SoC RTL Lab | Xi-Zhu Wang',
  description: 'Hands-on bilingual RTL, CDC, timing, verification and PPA practice for SoC engineers.',
  other: {
    'google-adsense-account': 'ca-pub-1191948823193656',
  },
  openGraph: {
    type: 'website',
    url: 'https://xizhuwang.github.io/rtl-interview-lab/',
    title: 'SoC RTL Lab',
    description: 'Hands-on bilingual RTL, CDC, CPU/cache, SoC, DFT and low-power practice.',
    images: [
      {
        url: 'soc-rtl-lab-preview.jpg',
        width: 1200,
        height: 628,
        alt: 'SoC RTL Lab penguin professions facing a gate-level timing boss with four elemental stones',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoC RTL Lab',
    description: 'Hands-on bilingual RTL, CDC, CPU/cache, SoC, DFT and low-power practice.',
    images: ['https://xizhuwang.github.io/rtl-interview-lab/soc-rtl-lab-preview.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
