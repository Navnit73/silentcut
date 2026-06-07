import React from "react";
import Link from "next/link";
import { Zap, HelpCircle, Plus, Minus } from "lucide-react";

const FAQS = [
  {
    question: "How does SilenceAI process video without uploading?",
    answer: "SilenceAI uses cutting-edge browser technologies like WebAssembly (WASM) and WebCodecs. This allows us to run a full instance of FFmpeg directly inside your browser. Your video data stays in your local memory and is processed using your CPU/GPU, never leaving your device."
  },
  {
    question: "What video formats are supported?",
    answer: "We support most common video formats including .MP4, .MOV, .WebM, and .MKV. However, for the best performance and compatibility with all browser hardware accelerators, we recommend using H.264/H.265 encoded files."
  },
  {
    question: "Is there a file size limit?",
    answer: "There technically isn't a hard limit, but because the processing happens in your browser's memory, extremely large files (20GB+) might cause your browser tab to crash if you have low RAM. We recommend systems with at least 8GB of RAM for 4K video editing."
  },
  {
    question: "Can I use it for commercial projects?",
    answer: "Absolutely! Once you export a video using SilenceAI, you own that file completely. Our pay-as-you-go model makes it easy to factor the cost into your production budget."
  },
  {
    question: "Is my payment information secure?",
    answer: "Yes. We use industry-standard payment processors like Stripe. We never store your credit card information on our servers; in fact, we don't even have a 'server' that stores your personal data besides your basic account metadata."
  },
  {
    question: "How do I get the best silence detection?",
    answer: "For the best results, use a threshold between -30dB and -40dB if you have a clean setup. If you have background noise, try -25dB. We always recommend adding 0.1s of 'Padding' so the cuts don't sound too abrupt."
  }
];

export default function FAQPage() {
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
           <Link href="/about" className="hover:text-white transition-colors">About</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="text-center mb-10 sm:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            <HelpCircle className="w-3 h-3" />
            Support Center
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter">Everything you need to <span className="gradient-text">know.</span></h1>
          <p className="text-sm sm:text-base text-zinc-400">Find answers to common questions about our local-first AI video editor.</p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <div key={index} className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              <h3 className="text-lg font-bold mb-3 flex items-center justify-between group cursor-pointer">
                {faq.question}
                <Plus className="w-5 h-5 text-primary" />
              </h3>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 sm:mt-20 p-6 sm:p-8 rounded-2xl sm:rounded-3xl gradient-bg text-center space-y-4">
          <h3 className="text-2xl font-bold">Still have questions?</h3>
          <p className="opacity-90">Our technical support team is ready to help you with your workflow.</p>
          <button className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:scale-105 transition-transform">
            Contact Support
          </button>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 text-zinc-500 text-sm mt-12 bg-black text-center">
        <p>© 2026 SilenceAI Editor. All rights reserved.</p>
        <div className="flex gap-8">
           <Link href="/about" className="hover:text-white transition-colors">About</Link>
           <Link href="/faq" className="text-white">FAQ</Link>
           <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
