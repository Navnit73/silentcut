import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, Heart, Users, Code2 } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />

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
        <div className="space-y-6 mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-none">
            Empowering creators with <span className="gradient-text">Local-First AI.</span>
          </h1>
          <p className="text-base sm:text-xl text-zinc-400 leading-relaxed">
            SilenceAI was born out of a simple frustration: why does editing a simple video have to be so slow and invasive? We believe that professional video tools should be as fast as your hardware and as private as your password.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Privacy First</h3>
            <p className="text-zinc-500">
              Unlike other AI video editors that require you to upload your raw footage to their servers, SilenceAI works entirely within your browser. Your data never leaves your device.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">In-Browser Speed</h3>
            <p className="text-zinc-500">
              By leveraging WebCodecs and FFmpeg WASM, we bring the performance of native desktop applications to the web, minus the bulky installation.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10 rounded-2xl sm:rounded-3xl bg-white/5 border border-white/10 glass">
          <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
          <div className="space-y-4 text-zinc-400 leading-relaxed">
            <p>
              We are a team of video editors and software engineers dedicated to automating the tedious parts of the creative process. Our goal is to save creators millions of hours by handling the "rough cuts" so they can focus on what they do best: storytelling.
            </p>
            <p>
              By 2026, we aim to be the standard tool for every YouTube, TikTok, and Podcast creator's workflow, providing secure, instant, and high-quality automation for every frame.
            </p>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 text-zinc-500 text-sm mt-12 bg-black text-center">
        <p>© 2026 SilenceAI Editor. All rights reserved.</p>
        <div className="flex gap-8">
           <Link href="/about" className="text-white">About</Link>
           <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
           <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
