import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, Lock, EyeOff, ServerOff } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 sm:py-6 max-w-7xl mx-auto border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Silence<span className="text-primary">AI</span></span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 md:gap-8 text-sm font-medium text-zinc-400">
           {process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && (
             <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
           )}
           <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
           <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <header className="mb-10 sm:mb-16 space-y-4">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter">Privacy <span className="gradient-text">Policy.</span></h1>
          <p className="text-sm sm:text-base text-zinc-400">Last updated: April 14, 2026</p>
        </header>

        <section className="space-y-12">
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-white/5 border border-white/10 glass space-y-6">
            <div className="flex items-center gap-4 text-primary">
              <ServerOff className="w-8 h-8" />
              <h2 className="text-2xl font-bold">1. Zero-Upload Policy</h2>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              The fundamental principle of SilenceAI is that **your video files never leave your device.** Unlike traditional online video editors, we do not upload your footage to our servers for processing. All audio analysis, silence detection, and video rendering happen entirely within your local browser environment using WebAssembly and WebCodecs.
            </p>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold">2. Information We Collect</h2>
            <p className="text-zinc-400 leading-relaxed">
              We collect minimal information required to provide our service:
            </p>
            <ul className="space-y-4 text-zinc-400 list-disc ml-6">
              <li>**Account Information**: Emails and basic profile data if you create an account.</li>
              <li>**Usage Data**: Anonymous telemetry to help us improve the tool (e.g., "how many users clicked the export button").</li>
              <li>**Payment Data**: Handled securely via Stripe. We do not store credit card numbers.</li>
            </ul>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold">3. How We Use Data</h2>
            <p className="text-zinc-400 leading-relaxed">
              The data we collect is used solely for:
            </p>
            <ul className="space-y-4 text-zinc-400 list-disc ml-6">
              <li>Processing your payments and managing your single-export licenses.</li>
              <li>Providing technical support and responding to inquiries.</li>
              <li>Debugging browser-specific performance issues in our FFmpeg engine.</li>
            </ul>
          </div>

          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-primary/10 border border-primary/20 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Lock className="w-6 h-6" /> Data Security
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Since your video data stays locally, the security of your raw footage is as strong as your own device's security. We recommend keeping your browser updated to ensure the latest WebAssembly security patches are active.
            </p>
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 text-zinc-500 text-sm mt-12 bg-black text-center">
        <p>© 2026 SilenceAI Editor. All rights reserved.</p>
        <div className="flex gap-8">
           <Link href="/about" className="hover:text-white transition-colors">About</Link>
           <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
           <Link href="/privacy" className="text-white">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
