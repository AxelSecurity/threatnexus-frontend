import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { Activity, Database, GitMerge, Send, ShieldAlert } from 'lucide-react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ThreatNexus | SOC Platform',
  description: 'Advanced Threat Intelligence Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-emerald-500/30">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-zinc-800">
              <ShieldAlert className="w-6 h-6 text-emerald-500 mr-3" />
              <span className="font-bold text-lg tracking-tight">ThreatNexus</span>
            </div>
            
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
              <Link href="/" className="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                <Activity className="w-5 h-5 mr-3 text-zinc-400" />
                Topology View
              </Link>
              <Link href="/miners" className="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                <Database className="w-5 h-5 mr-3 text-zinc-400" />
                Miners (Input)
              </Link>
              <Link href="/aggregators" className="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                <GitMerge className="w-5 h-5 mr-3 text-zinc-400" />
                Aggregators
              </Link>
              <Link href="/outputs" className="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                <Send className="w-5 h-5 mr-3 text-zinc-400" />
                Outputs (Feed)
              </Link>
            </nav>
            
            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center px-3 py-2 text-xs text-zinc-500 font-mono">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                System Online
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-zinc-950 relative">
            {/* Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 p-8 min-h-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
