import React from "react";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-data";
import { Calendar, Tag, ChevronRight, Zap } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 sm:py-6 max-w-7xl mx-auto border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Silence<span className="text-primary">AI</span></span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 md:gap-8 text-sm font-medium text-zinc-400">
          {process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && (
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          )}
          <Link href="/blog" className="text-white">Blog</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="max-w-3xl mb-10 sm:mb-16">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tighter mb-4 sm:mb-6">
            Latest from the <span className="gradient-text">Blog</span>
          </h1>
          <p className="text-base sm:text-xl text-zinc-400 leading-relaxed">
            Tips, tutorials, and deep dives into the world of AI-powered video editing and content creation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS.map((post) => (
            <Link 
              key={post.slug} 
              href={`/blog/${post.slug}`}
              className="group flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="flex items-center gap-2 mb-4">
                {post.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
              
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
                {post.title}
              </h3>
              
              <p className="text-zinc-400 text-sm mb-6 line-clamp-3">
                {post.description}
              </p>
              
              <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-1 text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  Read More <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 text-zinc-500 text-sm mt-12 bg-black text-center">
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
