import './globals.css';
import { AuthProvider } from '../lib/auth';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

export const metadata = {
  title: 'Nucleus | Meridian Engineering',
  description: 'Premium Work Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-[#FAFAFA]">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden w-full">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0 bg-[#FAFAFA]">
               <Header />
               <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-8 mx-auto w-full max-w-[1600px]">
                 {children}
               </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
