import React from "react";
import Link from "next/link";
import { Zap, Check, Shield, Star, Clock, FileVideo } from "lucide-react";
import { redirect } from "next/navigation";

export default function PricingPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    redirect("/");
  }
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      {/* Background Effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full -z-10 pointer-events-none" />
      
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Silence<span className="text-primary">AI</span></span>
        </Link>
        <div className="flex items-center gap-8 text-sm font-medium text-zinc-400">
           <Link href="/pricing" className="text-white">Pricing</Link>
           <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
           <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-20 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            <Star className="w-3 h-3" />
            Simple Pay-As-You-Go
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-none mb-4">
            No subscriptions. <br />
            <span className="gradient-text tracking-tighter">Only pay for what you use.</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Professional silence removal without the monthly commitment. Choose the tier that fits your video length.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Short Form Tier */}
          <div className="relative group p-8 rounded-3xl bg-zinc-900/50 border border-white/10 glass hover:border-primary/50 transition-all duration-300 transform hover:-translate-y-2">
            <div className="absolute -top-4 right-8 px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-bold tracking-widest uppercase border border-white/10">Most Popular</div>
            
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Short Form</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">$2.99</span>
                <span className="text-zinc-500 text-sm">/ export</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 text-left">
              {[
                "Up to 10 minutes video",
                "High-speed silence detection",
                "4K Export quality",
                "100% Local processing",
                "No watermarks"
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-zinc-400">
                  <Check className="w-5 h-5 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button className="w-full py-4 rounded-xl gradient-bg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
              Start Editing
            </button>
          </div>

          {/* Long Form Tier */}
          <div className="relative group p-8 rounded-3xl bg-zinc-900/50 border border-white/10 glass hover:border-orange-500/50 transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6">
                <FileVideo className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Podcast / Long Form</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">$10.00</span>
                <span className="text-zinc-500 text-sm">/ export</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 text-left">
              {[
                "Up to 60 minutes video",
                "Multi-track analysis support",
                "High-bitrate 4K Export",
                "Browser-based rendering",
                "Bulk processing ready"
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-zinc-400">
                  <Check className="w-5 h-5 text-orange-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button className="w-full py-4 rounded-xl bg-white text-black font-bold shadow-lg shadow-white/5 hover:scale-[1.02] transition-transform">
              Start Editing
            </button>
          </div>
        </div>

        {/* Trust Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 text-zinc-500 max-w-4xl">
          <div className="flex flex-col items-center gap-4">
            <Shield className="w-8 h-8 text-zinc-400" />
            <p className="text-sm">Secure Stripe Payments</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Zap className="w-8 h-8 text-zinc-400" />
            <p className="text-sm">Instant Processing</p>
          </div>
          <div className="flex flex-col items-center gap-4">
             <div className="flex gap-0.5">
               {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-primary text-primary" />)}
             </div>
             <p className="text-sm">Loved by 10k+ Creators</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-zinc-500 text-sm">
        <p>© 2026 SilenceAI Editor. All rights reserved.</p>
        <div className="flex gap-8">
           <Link href="/about" className="hover:text-white transition-colors">About</Link>
           <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
           <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
