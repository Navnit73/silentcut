import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS } from "@/lib/blog-data";
import { Calendar, ArrowLeft, Clock, Share2, Tag } from "lucide-react";

// Types for dynamic routes in Next.js 13+ App Router
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  // Simple Markdown-to-JSX converter for basic tags (#, ##, -)
  const renderContent = (content: string) => {
    return content.trim().split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-4xl md:text-5xl font-bold mt-12 mb-8 tracking-tighter">{line.replace("# ", "")}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-2xl md:text-3xl font-bold mt-10 mb-6 tracking-tight text-white/90">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-xl font-bold mt-8 mb-4 text-white/80">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-6 mb-2 list-disc text-zinc-300">{line.replace("- ", "")}</li>;
      }
      if (line.startsWith("1. ")) {
        return <li key={i} className="ml-6 mb-2 list-decimal text-zinc-300">{line.replace(/^\d+\. /, "")}</li>;
      }
      if (line.trim() === "") {
        return <div key={i} className="h-4" />;
      }
      return <p key={i} className="text-lg leading-relaxed text-zinc-400 mb-6">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <main className="max-w-4xl mx-auto px-8 py-20">
        {/* Back Link */}
        <Link 
          href="/blog" 
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Blog
        </Link>

        {/* Article Header */}
        <header className="mb-16 space-y-6">
          <div className="flex gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                {tag}
              </span>
            ))}
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-[1.1]">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-zinc-500 text-sm pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              8 min read
            </div>
            <button className="flex items-center gap-2 hover:text-white transition-colors">
              <Share2 className="w-4 h-4" />
              Share Article
            </button>
          </div>
        </header>

        {/* Article Body */}
        <article className="prose prose-invert max-w-none">
          {renderContent(post.content)}
        </article>

        {/* Subscribe Section */}
        <div className="mt-20 p-8 rounded-3xl bg-white/5 border border-white/10 glass text-center space-y-6">
          <h3 className="text-2xl font-bold">Never miss a post</h3>
          <p className="text-zinc-400">Join 10,000+ creators getting the latest AI video tips.</p>
          <div className="flex max-w-md mx-auto gap-3">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-white/10 focus:outline-none focus:border-primary transition-colors"
            />
            <button className="px-6 py-3 rounded-xl bg-white text-black font-bold hover:scale-105 transition-transform">
              Join Now
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-zinc-500 text-sm mt-12">
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
