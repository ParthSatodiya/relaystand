import type { Metadata } from 'next';
import { Anton, Barlow } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
});

// Display only — headings, the wordmark and the big numbers.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' });

export const metadata: Metadata = {
  title: 'RelayStand',
  description: 'The standup that remembers yesterday.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${barlow.variable} ${anton.variable}`}>
      <body className="h-full antialiased selection:bg-baton selection:text-baton-ink">
        {children}
      </body>
    </html>
  );
}
