import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar, Footer } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'TIXORA | Premiere Cinema Discovery, Seat Reservation & Digital Ticketing',
  description:
    'Book IMAX Laser, Dolby Atmos, and Noir Velvet cinema experiences with concurrency-safe PostgreSQL seat reservations and cryptographic QR tickets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#09090B] text-[#F8F7F4] antialiased selection:bg-amber-400 selection:text-zinc-950">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
