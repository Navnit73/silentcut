"use client";

import React, { useState } from "react";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import Editor from "@/components/Editor";
import { Zap, ShieldCheck, Timer, Code2, Layers, LayoutDashboard, FastForward, Play, Download, Scissors, Plus } from "lucide-react";
import { useSession, signIn } from "next-auth/react";

// Utility for class merging (simple version)
const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default function Home() {
  const { data: session } = useSession();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const isPro = isDemo || (session?.user as any)?.isPro === true;

  if (selectedFiles.length > 0) {
    return (
      <Editor
        files={selectedFiles}
        onBack={() => setSelectedFiles([])}
        isPro={isPro}
        onTogglePro={() => signIn("google")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full -z-10 pointer-events-none" />
      
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 md:px-8 py-5 md:py-6 max-w-7xl mx-auto flex-wrap gap-4 relative z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-primary/20 hover:rotate-12 transition-transform cursor-pointer">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter">Silence<span className="text-primary italic">AI</span></span>
        </div>
        
        {!isDemo && (
          <div className="hidden lg:flex items-center gap-10 text-sm font-bold text-zinc-500 uppercase tracking-widest">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
        )}

        <div className="flex flex-1 md:flex-none items-center justify-end gap-3 md:gap-4">
          <a href="https://github.com" target="_blank" className="hidden sm:flex p-2 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-full border border-white/5">
            <Code2 className="w-5 h-5" />
          </a>
          {session ? (
            <Link href="/dashboard" className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-black shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group">
              Dashboard
              <LayoutDashboard className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-black shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              Get Started
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-12 md:pt-24 pb-20 flex flex-col items-center text-center relative z-10">
        {/* Hero Section */}
        <div className="space-y-8 max-w-4xl mb-20 animate-in fade-in slide-in-from-bottom-5 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] shadow-inner">
            <Zap className="w-3 h-3" />
            Hardware Accelerated • 100% In-Browser
          </div>
          
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-4">
              Kill the Dead Air. <br />
              <span className="gradient-text tracking-tighter italic">Keep the Flow.</span>
            </h1>
            
            <h2 className="text-lg md:text-2xl text-zinc-400 font-medium leading-relaxed max-w-2xl mx-auto">
              Professional AI-powered video editing for creators. Automatically remove silences, ramp speed, and export 4K video—all without uploading a single byte to any server.
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
             <div className="flex items-center -space-x-3">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center overflow-hidden">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="User" className="w-full h-full object-cover" />
                 </div>
               ))}
             </div>
             <p className="text-xs font-bold text-zinc-500 tracking-wide uppercase">Trusted by 12,000+ Creators</p>
          </div>
        </div>

        {/* Upload Container */}
        <div className="w-full max-w-3xl relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[32px] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative">
            <Dropzone onFileSelect={setSelectedFiles} isPro={isPro} />
          </div>
          
          {/* Trust Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <TrustItem icon={<ShieldCheck className="w-5 h-5" />} title="Private" desc="100% Local Processing" color="text-emerald-400" />
            <TrustItem icon={<Zap className="w-5 h-5" />} title="GPU Fast" desc="Uses WebCodecs API" color="text-amber-400" />
            <TrustItem icon={<Timer className="w-5 h-5" />} title="Scale" desc="Supports 60+ Min Files" color="text-pink-400" />
            <TrustItem icon={<Layers className="w-5 h-5" />} title="Hybrid" desc="AI Scan + Manual NLE" color="text-violet-400" />
          </div>
        </div>

        {/* FEATURE SECTIONS */}
        <section className="mt-32 space-y-32 text-left w-full">
          <div className="text-center space-y-6 max-w-3xl mx-auto mb-20 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-300">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
              Professional Editing. <br/>
              <span className="text-zinc-500">Zero Server Latency.</span>
            </h2>
            <p className="text-lg text-zinc-400">SilenceAI brings desktop-grade performance to your browser window. By leveraging WebWorkers and FFmpeg WASM, we've eliminated the need for cloud rendering entirely.</p>
          </div>

          <FeatureCard 
            badge="Advanced NLE"
            title="Desktop-Class Timeline"
            desc="Experience a fluid, frame-accurate editor built with hardware-accelerated Canvas. Scrub through waveforms at 60FPS, zoom into milliseconds for precise cuts, and use the same workflow as professional desktop software."
            features={[
              "Retina-ready waveform rendering",
              "Multi-track visual hierarchy",
              "Instant zoom & scroll performance"
            ]}
            icon={<Layers className="w-6 h-6" />}
            color="violet"
            image={
              <div className="space-y-4">
                <div className="w-full h-8 bg-black/40 rounded-lg border border-white/5 flex items-center px-4"><div className="w-1/3 h-2 bg-violet-500/50 rounded-full" /></div>
                <div className="w-full h-32 bg-black/40 rounded-lg border border-white/5 flex items-end px-4 gap-1.5 pb-3">
                   <div className="w-10 h-10 bg-[#6366f1]/40 rounded-sm" />
                   <div className="w-10 h-16 bg-[#6366f1]/40 rounded-sm" />
                   <div className="w-10 h-24 bg-[#6366f1]/80 rounded-sm border-t border-indigo-400" />
                   <div className="w-10 h-8 bg-black/60 rounded-sm border border-red-500/20 relative overflow-hidden">
                     <div className="absolute inset-0 bg-red-500/10" />
                   </div>
                   <div className="w-10 h-12 bg-[#6366f1]/40 rounded-sm" />
                </div>
              </div>
            }
          />

          <FeatureCard 
            badge="Dynamic Audio"
            title="Intelligent Speed Ramping"
            desc="Hard cuts aren't always the answer. For tutorials and coding walkthroughs, use Speed Mode to fast-forward through silences at 2x or 4x. Maintain the visual flow while respecting your viewer's time."
            features={[
              "Customizable ramp speeds",
              "Lossless audio preservation",
              "Visual speed-zone markers"
            ]}
            reversed
            icon={<FastForward className="w-6 h-6" />}
            color="emerald"
            image={
               <div className="w-full h-40 bg-black/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute inset-0 bg-emerald-500/10 striped-bg opacity-30" />
                  <span className="text-emerald-400 font-mono font-bold text-3xl relative z-10 flex items-center gap-3 drop-shadow-md italic">
                    <FastForward className="w-8 h-8" /> 2x SPEED
                  </span>
               </div>
            }
          />

          <FeatureCard 
            badge="Live Engine"
            title="No-Render Live Preview"
            desc="Stop waiting for progress bars just to check an edit. Our real-time engine physically skips cut regions as you play back, giving you an immediate preview of the final export without a single second of rendering."
            features={[
              "Instant playback feedback",
              "Skip/Speed toggle in real-time",
              "Zero CPU overhead during seek"
            ]}
            icon={<Play className="w-6 h-6" />}
            color="amber"
            image={
              <div className="aspect-video bg-black/60 rounded-2xl border border-white/5 flex items-center justify-center relative shadow-inner overflow-hidden">
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-violet-600 rounded-md text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg shadow-violet-900/40">Preview Active</div>
                <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform duration-300">
                  <Play className="w-8 h-8 ml-1 fill-current" />
                </div>
              </div>
            }
          />

          <section className="py-20">
             <div className="text-center space-y-4 mb-20">
               <h2 className="text-4xl font-black tracking-tight">How it <span className="text-primary italic">Works.</span></h2>
               <p className="text-zinc-500 font-medium">From raw file to polished output in three simple steps.</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                <div className="hidden md:block absolute top-1/3 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <StepItem num="01" title="Import Locally" desc="Drag your files into the browser. We support massive 4K files with zero upload time." />
                <StepItem num="02" title="AI Analysis" desc="The AI scans your audio peaks to identify every silent moment with millisecond precision." />
                <StepItem num="03" title="Export 4K" desc="Download your master MP4. Every cut is rendered locally using FFmpeg for peak quality." />
             </div>
          </section>

          <section className="py-20 border-t border-white/5">
             <div className="flex flex-col md:flex-row gap-16 md:gap-32">
                <div className="md:w-1/3 space-y-4 text-left">
                   <h2 className="text-4xl font-black tracking-tight leading-none italic">Common questions.</h2>
                   <p className="text-zinc-500 font-medium">Can&apos;t find what you&apos;re looking for? Reach out to our technical team.</p>
                   <button className="text-sm font-bold text-violet-400 hover:text-violet-300 transition-colors">Contact Support &rarr;</button>
                </div>
                <div className="md:w-2/3 space-y-6">
                   <FAQItem q="Is my video uploaded to your servers?" a="Never. SilenceAI is a local-first application. We use FFmpeg.wasm and WebCodecs to process your files entirely inside your browser's memory." />
                   <FAQItem q="What resolutions are supported for export?" a="Our free tier supports 720p drafts. Pro users can export in uncompressed 1080p and 4K UHD resolutions with zero watermarks." />
                   <FAQItem q="Does it work on mobile?" a="While you can preview files on modern mobile browsers, we recommend a desktop with at least 8GB of RAM for the best editing experience." />
                   <FAQItem q="Can I use multiple files at once?" a="Yes, Pro users can batch process multiple files in a single session, perfect for long podcast episodes or series." />
                </div>
             </div>
          </section>

          <section className="pb-32">
             <div className="p-12 md:p-20 rounded-[40px] gradient-bg text-center space-y-8 relative overflow-hidden shadow-[0_0_80px_rgba(124,58,237,0.3)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight text-white mb-2">
                  Ready to edit <br/>
                  <span className="opacity-60">without the grind?</span>
                </h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="px-10 py-4 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10">
                    Get Started Free
                  </button>
                  <Link href="/pricing" className="px-10 py-4 rounded-2xl bg-black/20 text-white font-black text-lg hover:bg-black/30 transition-all border border-white/10">
                    View Pro Pricing
                  </Link>
                </div>
                <p className="text-sm font-bold text-white/50 tracking-widest uppercase">No Credit Card Required • Start Instantly</p>
             </div>
          </section>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-zinc-600 text-[11px] font-bold uppercase tracking-[0.2em] bg-black relative z-10">
        <p className="text-center md:text-left">© 2026 SilenceAI Editor. Built local-first for peak performance.</p>
        <div className="flex flex-wrap justify-center gap-6 md:gap-12">
          {["Pricing", "Blog", "About", "FAQ", "Privacy"].map((link) => (
             <Link key={link} href={`/${link.toLowerCase()}`} className="hover:text-white transition-colors">{link}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function TrustItem({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="space-y-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group overflow-hidden relative text-left">
      <div className={cn("inline-flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-500", color)}>
        {icon}
      </div>
      <h3 className="font-black text-xs tracking-wide uppercase text-zinc-100">{title}</h3>
      <p className="text-[10px] text-zinc-500 font-bold leading-tight">{desc}</p>
      <div className={cn("absolute bottom-0 left-0 w-full h-0.5 bg-current opacity-20", color)} />
    </div>
  );
}

function FeatureCard({ 
  badge, title, desc, features, icon, image, reversed, color 
}: { 
  badge: string; title: string; desc: string; features: string[]; icon: React.ReactNode; image: React.ReactNode; reversed?: boolean; color: "violet" | "emerald" | "amber" 
}) {
  const colorMap = {
    violet: "bg-violet-500/10 text-violet-400 shadow-violet-900/20",
    emerald: "bg-emerald-500/10 text-emerald-400 shadow-emerald-900/20",
    amber: "bg-amber-500/10 text-amber-400 shadow-amber-900/20"
  };

  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-16 md:gap-24", reversed && "md:flex-row-reverse")}>
      <div className="flex-1 space-y-8">
        <div className="space-y-4">
          <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest", colorMap[color])}>
            {icon}
            {badge}
          </div>
          <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">{title}</h3>
          <p className="text-xl text-zinc-400 leading-relaxed font-medium">
            {desc}
          </p>
        </div>
        <ul className="space-y-4 text-zinc-500 font-bold text-sm tracking-wide">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className={cn("w-1.5 h-1.5 rounded-full", color === "violet" ? "bg-violet-400" : color === "emerald" ? "bg-emerald-400" : "bg-amber-400")} />
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 w-full bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
         <div className={cn("absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-10 transition-opacity duration-700", 
           color === "violet" ? "from-violet-500" : color === "emerald" ? "from-emerald-500" : "from-amber-500"
         )} />
         {image}
      </div>
    </div>
  );
}

function StepItem({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="space-y-6 relative z-10 text-left">
       <span className="text-8xl font-black text-white/5 absolute -top-12 -left-4 select-none">{num}</span>
       <h3 className="text-2xl font-black tracking-tight pt-4">{title}</h3>
       <p className="text-zinc-500 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all group cursor-pointer text-left w-full">
      <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center justify-between">
        {q}
        <Plus className="w-5 h-5 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
      </h3>
      <p className="text-zinc-500 text-sm leading-relaxed font-medium opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-40 transition-all duration-500 overflow-hidden">
        {a}
      </p>
    </div>
  );
}
