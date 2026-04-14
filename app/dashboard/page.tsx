"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, CreditCard, LogOut, Zap, Download } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    // Inject Razorpay
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const isPro = isDemo || (session?.user as any)?.isPro;

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      setError(null);
      
      const res = await fetch("/api/razorpay/subscription", { method: "POST" });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      const options = {
        key: data.key,
        subscription_id: data.subscription_id,
        name: "SilenceAI",
        description: "Unlimited Studio Plan ($49/mo)",
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/razorpay/verify-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              window.location.reload(); // Reload session to get isPro
            } else {
              setError("Subscription verification failed.");
            }
          } catch (e) {
            setError("Failed to verify subscription.");
          }
        },
        theme: { color: "#7c3aed" }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on("payment.failed", function (response: any) {
        setError(response.error.description || "Payment failed");
        setIsSubscribing(false);
      });
      rzp1.open();
    } catch (e: any) {
      setError(e.message);
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-white">Silence<span className="text-violet-400">AI</span></span>
        </Link>
        <button onClick={() => signOut()} className="text-sm font-semibold text-zinc-400 hover:text-white flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Profile Card */}
          <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-white/5 rounded-2xl p-8 shadow-xl flex gap-6 items-center">
            {session?.user?.image ? (
              <img src={session.user.image} alt="Profile" className="w-20 h-20 rounded-full border-2 border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-white/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-zinc-500">{session?.user?.name?.[0]}</span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{session?.user?.name}</h2>
              <p className="text-zinc-500 mb-2">{session?.user?.email}</p>
              {isPro ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider rounded-md border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> Unlimited Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider rounded-md border border-white/5">
                  Free Account
                </span>
              )}
            </div>
          </div>

          {/* Subscription Action Card */}
          {!isDemo && (
            <div className="col-span-1 bg-gradient-to-b from-violet-900/40 to-zinc-900 border border-violet-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(124,58,237,0.1)] flex flex-col justify-center">
              {isPro ? (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg">You are on the Pro Plan!</h3>
                  <p className="text-sm text-zinc-400">Enjoy unlimited 4K uncompressed exports and zero watermarks.</p>
                  <Link href="/" className="block w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg transition-colors mt-4">
                    Go to Editor
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-6 h-6 text-violet-400" />
                    <h3 className="font-bold text-lg">Unlimited Plan</h3>
                  </div>
                  <p className="text-sm text-zinc-400">Upgrade to unlock 4K exports, priority processing, and remove all watermarks across unlimited videos.</p>
                  
                  <div className="pt-2">
                    <span className="text-3xl font-black">$49</span><span className="text-zinc-500"> / month</span>
                  </div>

                  {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                  <button 
                    onClick={handleSubscribe} 
                    disabled={isSubscribing}
                    className="w-full py-3 mt-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] flex items-center justify-center gap-2"
                  >
                    {isSubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe Now"}
                  </button>
                </div>
              )}
            </div>
          )}

          {isDemo && (
            <div className="col-span-1 bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(16,185,129,0.1)] flex flex-col justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg">Demo Mode Active</h3>
              <p className="text-sm text-zinc-400">All features are unlocked for this preview session.</p>
              <Link href="/" className="block w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors mt-4">
                Test 4K Export
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
