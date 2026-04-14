"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Scissors,
  Pause,
  RotateCcw,
  Loader2,
  Download,
  AlertCircle,
  Undo2,
  Redo2,
  Eye,
  FastForward,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Film,
  Layers,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import {
  analyzeAudio,
  extractWaveform,
  SilenceChunk,
  ProcessingProgress,
  mergeChunks,
} from "@/lib/audio-processor";
import { processVideo } from "@/lib/ffmpeg-processor";
import { useHistory } from "@/hooks/useHistory";
import { useSession } from "next-auth/react";

interface EditorProps {
  files: File[];
  onBack: () => void;
  isPro: boolean;
  onTogglePro: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type MobileTab = "controls" | "settings" | "export";

export default function Editor({ files, onBack, isPro, onTogglePro }: EditorProps) {
  const { data: session } = useSession();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const file = files[activeFileIndex];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // containerRef → outer wrapper div (for resize observation)
  const containerRef = useRef<HTMLDivElement>(null);
  // scrollRef → the overflow-x:auto div (for scroll sync)
  const scrollRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string>("");
  const processedUrlRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const waveformRef = useRef<Float32Array | null>(null);
  const isPlayingRef = useRef(false);
  const lastPlaybackRate = useRef(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>("controls");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [threshold, setThreshold] = useState(-30);
  const [minDuration, setMinDuration] = useState(0.3);
  const [padding, setPadding] = useState(0.1);

  const {
    state: silenceChunks,
    set: setSilenceChunks,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<SilenceChunk[]>([]);

  useEffect(() => {
    setProcessedVideoUrl(null);
    setCurrentTime(0);
    setSilenceChunks([]);
  }, [activeFileIndex, setSilenceChunks]);

  const dragStartRef = useRef<number | null>(null);
  const hoverTimeRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [silenceAction, setSilenceAction] = useState<"cut" | "speed">("cut");
  const [rampSpeed, setRampSpeed] = useState<number>(2);

  const [exportFormat, setExportFormat] = useState<"original" | "16:9" | "9:16" | "1:1">("original");
  const [exportRes, setExportRes] = useState<"720p" | "1080p" | "4k">("720p");
  const [hasPaidForExport, setHasPaidForExport] = useState(false);
  const [pricing, setPricing] = useState<{ symbol: string; short: { display: string }; long: { display: string } } | null>(null);

  useEffect(() => {
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    fetch("/api/geo").then((r) => r.json()).then(setPricing).catch(console.error);
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const debouncedThreshold = useDebounce(threshold, 400);
  const debouncedMinDuration = useDebounce(minDuration, 400);
  const debouncedPadding = useDebounce(padding, 400);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlayingRef.current) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => { });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, undo, redo]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    if (videoRef.current) videoRef.current.src = url;
    return () => {
      URL.revokeObjectURL(url);
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
      abortRef.current?.abort();
    };
  }, [file]);

  useEffect(() => {
    extractWaveform(file, 1600).then((env) => { waveformRef.current = env; }).catch(console.error);
  }, [file]);

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsAnalyzing(true);
    setError(null);
    setProgress(null);
    try {
      const chunks = await analyzeAudio(
        file,
        debouncedThreshold,
        debouncedMinDuration,
        debouncedPadding,
        setProgress,
        controller.signal
      );
      setSilenceChunks(chunks);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setError("Audio analysis failed. Try a different file or settings.");
        console.error(e);
      }
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  }, [file, debouncedThreshold, debouncedMinDuration, debouncedPadding, setSilenceChunks]);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  // ─── DRAW CANVAS ─────────────────────────────────────────────────────────────
  // FIX: canvas.width is always the physical pixel size of the *visible* viewport.
  // We derive logical CSS pixels = canvas.width / dpr, then scale time → x using
  // (zoom × logicalWidth) and subtract the current scroll offset so that drawn
  // regions always line up with what is visible.
  const drawCanvas = useCallback(
    (chunks: SilenceChunk[], time: number, dur: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      // Logical width of the *visible* canvas area (CSS pixels)
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const mid = H / 2;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;

      // Helpers: convert a timeline time to a canvas x coordinate.
      // The full timeline is (W * zoom) pixels wide; we subtract scrollLeft to
      // get the position within the currently visible canvas.
      const timeToX = (t: number) =>
        dur > 0 ? (t / dur) * W * zoom - scrollLeft : 0;
      const durToW = (d: number) =>
        dur > 0 ? (d / dur) * W * zoom : 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Scale ctx so we can draw in CSS pixels
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, W, H);

      // ── Silence / speed regions
      if (dur > 0) {
        for (const chunk of chunks) {
          const x = timeToX(chunk.start);
          const w = durToW(chunk.end - chunk.start);
          if (chunk.action === "speed") {
            ctx.fillStyle = "rgba(16,185,129,0.12)";
            ctx.fillRect(x, 0, w, H);
            ctx.fillStyle = "rgba(16,185,129,0.5)";
            ctx.fillRect(x, 0, 1.5, H);
            ctx.fillRect(x + w - 1.5, 0, 1.5, H);
            ctx.font = "bold 9px monospace";
            ctx.fillStyle = "rgba(16,185,129,0.9)";
            ctx.fillText(`${chunk.speed}x`, x + 5, H - 6);
          } else {
            ctx.fillStyle = "rgba(239,68,68,0.12)";
            ctx.fillRect(x, 0, w, H);
            ctx.fillStyle = "rgba(239,68,68,0.5)";
            ctx.fillRect(x, 0, 1.5, H);
            ctx.fillRect(x + w - 1.5, 0, 1.5, H);
          }
        }
      }

      // ── Drag selection preview
      const dStart = dragStartRef.current;
      const hTime = hoverTimeRef.current;
      if (dur > 0 && dStart !== null && hTime !== null) {
        const s = Math.min(dStart, hTime);
        const e = Math.max(dStart, hTime);
        const x = timeToX(s);
        const w = durToW(e - s);
        ctx.fillStyle =
          silenceAction === "speed"
            ? "rgba(16,185,129,0.25)"
            : "rgba(239,68,68,0.25)";
        ctx.fillRect(x, 0, w, H);
        ctx.strokeStyle = silenceAction === "speed" ? "#10b981" : "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + 0.5, 0.5, w - 1, H - 1);
        ctx.setLineDash([]);
      }

      // ── Waveform bars
      const env = waveformRef.current;
      if (env && env.length > 0) {
        // Each bar maps to a fraction of the full zoomed timeline width
        const totalLogicalW = W * zoom;
        const barWidth = totalLogicalW / env.length;
        for (let i = 0; i < env.length; i++) {
          const barX = i * barWidth - scrollLeft;
          // Skip bars that are entirely outside the visible area
          if (barX + barWidth < 0 || barX > W) continue;
          const barH = Math.max(1, env[i] * H * 0.82);
          const progress_ratio = i / env.length;
          const r = Math.round(99 + (139 - 99) * progress_ratio);
          const g = Math.round(102 + (92 - 102) * progress_ratio);
          const b = Math.round(241 + (246 - 241) * progress_ratio);
          ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
          ctx.fillRect(
            barX,
            mid - barH / 2,
            Math.max(barWidth - 0.5, 1),
            barH
          );
        }
        // Dim silence/cut regions over the waveform
        if (dur > 0) {
          for (const chunk of chunks) {
            const x = timeToX(chunk.start);
            const w = durToW(chunk.end - chunk.start);
            ctx.fillStyle = "rgba(8,8,10,0.6)";
            ctx.fillRect(x, 0, w, H);
          }
        }
      } else {
        // Placeholder bars when waveform isn't ready
        const totalLogicalW = W * zoom;
        for (let i = 0; i < 200; i++) {
          const barX = (i / 200) * totalLogicalW - scrollLeft;
          if (barX + totalLogicalW / 200 < 0 || barX > W) continue;
          const h = 4 + Math.sin(i * 0.4) * 10 + 14;
          ctx.fillStyle = "#1e1e22";
          ctx.fillRect(barX, mid - h / 2, totalLogicalW / 200 - 1, h);
        }
      }

      // ── Playhead
      if (dur > 0 && time > 0) {
        const px = timeToX(time);
        // Played region tint
        ctx.fillStyle = "rgba(167,139,250,0.06)";
        ctx.fillRect(0, 0, px, H);
        // Playhead line
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, H);
        ctx.stroke();
        // Playhead handle
        ctx.fillStyle = "#a78bfa";
        ctx.beginPath();
        ctx.arc(px, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    [silenceAction, zoom]
  );

  // ─── RESIZE ──────────────────────────────────────────────────────────────────
  // FIX: The canvas physical pixel size = visible scroll container × dpr (never
  // multiplied by zoom). Zoom only affects the *scrollable inner width*, not the
  // canvas element itself.
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const scroll = scrollRef.current;
    if (!canvas || !scroll) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.floor(scroll.clientWidth * dpr);
    const H = Math.floor(scroll.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    drawCanvas(silenceChunks, currentTime, duration);
  }, [silenceChunks, currentTime, duration, drawCanvas]);

  useEffect(() => {
    const ro = new ResizeObserver(() => handleResize());
    if (scrollRef.current) ro.observe(scrollRef.current);
    handleResize();
    return () => ro.disconnect();
  }, [handleResize]);

  // Re-draw whenever zoom changes (scroll container width stays the same, but
  // we need to re-compute bar positions against the new zoom scale)
  useEffect(() => {
    handleResize();
  }, [zoom, handleResize]);

  useEffect(() => {
    drawCanvas(silenceChunks, currentTime, duration);
  }, [silenceChunks, currentTime, duration, drawCanvas]);

  // Re-draw when scroll position changes so regions track correctly
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => drawCanvas(silenceChunks, currentTime, duration);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [silenceChunks, currentTime, duration, drawCanvas]);

  // ─── TIME → CANVAS X (accounts for zoom + scroll) ────────────────────────────
  // FIX: The canvas element is always sized to the *visible* viewport. To convert
  // a clientX mouse position into a timeline time we must:
  //   1. Add the current horizontal scroll offset (so we know where in the full
  //      zoomed timeline the click landed).
  //   2. Divide by (visibleWidth × zoom) to normalise to [0, 1].
  //   3. Multiply by duration.
  const canvasTimeFromClientX = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      const scroll = scrollRef.current;
      if (!canvas || !scroll || duration === 0) return 0;
      const rect = canvas.getBoundingClientRect();
      const scrolledX = clientX - rect.left + scroll.scrollLeft;
      const fullLogicalWidth = rect.width * zoom;
      return Math.max(
        0,
        Math.min(duration, (scrolledX / fullLogicalWidth) * duration)
      );
    },
    [duration, zoom]
  );

  // ─── PROCESS VIDEO ────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (silenceChunks.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setProgress(null);
    try {
      const blob = await processVideo(
        file,
        silenceChunks,
        (p: { message: string; percent: number }) => {
          setProgress({ message: p.message, progress: p.percent });
        },
        {
          format: exportFormat,
          res: exportRes,
          watermark: !isPro && exportRes === "720p",
        }
      );
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
      const url = URL.createObjectURL(blob);
      processedUrlRef.current = url;
      setProcessedVideoUrl(url);
      if (videoRef.current) {
        const savedDuration = duration;
        videoRef.current.src = url;
        videoRef.current.load();
        videoRef.current.onloadedmetadata = () => {
          setDuration(videoRef.current?.duration ?? savedDuration);
        };
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Processing failed. Please try again."
      );
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const isPremiumExport = exportRes !== "720p";
  const needsPayment = isPremiumExport && !isPro && !hasPaidForExport;
  const priceToDisplay =
    duration <= 600 ? pricing?.short.display : pricing?.long.display;

  const handleRenderClick = async () => {
    if (needsPayment) {
      setIsProcessing(true);
      setError(null);
      setProgress({ message: "Initializing secure gateway…", progress: 0 });
      try {
        const res = await fetch("/api/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds: duration }),
        });
        const order = await res.json();
        if (order.error) throw new Error(order.error);
        const options = {
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: "SilenceAI Pro",
          description: exportRes.toUpperCase() + " Master Output",
          order_id: order.id,
          handler: function () {
            setHasPaidForExport(true);
            handleProcess();
          },
          theme: { color: "#7c3aed" },
        };
        const rzp1 = new (window as any).Razorpay(options);
        rzp1.on("payment.failed", function (response: any) {
          setError(response.error.description || "Payment failed");
        });
        rzp1.open();
        setIsProcessing(false);
        setProgress(null);
      } catch (e: any) {
        setError(e.message || "Could not contact billing server.");
        setIsProcessing(false);
        setProgress(null);
      }
    } else {
      if (!session && !hasPaidForExport) {
        setShowEmailModal(true);
      } else {
        handleProcess();
      }
    }
  };

  const submitLeadAndExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail) return;
    setIsSubmittingLead(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: leadEmail, source: "free_export_720p" }),
      });
    } catch (err) {
      console.error("Lead capture failed, but letting export proceed", err);
    } finally {
      setIsSubmittingLead(false);
      setShowEmailModal(false);
      setHasPaidForExport(true);
      handleProcess();
    }
  };

  const handleExport = () => {
    if (!processedVideoUrl) { handleProcess(); return; }
    const a = document.createElement("a");
    a.href = processedVideoUrl;
    a.download = `edited_${file.name.replace(/\.[^.]+$/, "")}.mp4`;
    a.click();
  };

  // ─── TIME UPDATE ─────────────────────────────────────────────────────────────
  // FIX: Auto-scroll to keep playhead in view when zoomed in.
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    // ── Auto-scroll to follow playhead when zoom > 1
    if (scrollRef.current && duration > 0 && zoom > 1) {
      const scroll = scrollRef.current;
      const totalWidth = scroll.clientWidth * zoom;
      const playheadX = (t / duration) * totalWidth;
      const viewLeft = scroll.scrollLeft;
      const viewRight = viewLeft + scroll.clientWidth;
      const margin = scroll.clientWidth * 0.2;
      if (playheadX < viewLeft + margin || playheadX > viewRight - margin) {
        scroll.scrollLeft = Math.max(0, playheadX - scroll.clientWidth * 0.4);
      }
    }

    if (!isPreviewMode || isProcessing) return;
    const activeChunk = silenceChunks.find((c) => t >= c.start && t < c.end);
    if (activeChunk) {
      if (activeChunk.action === "cut") {
        const target = Math.min(
          activeChunk.end,
          videoRef.current.duration - 0.05
        );
        videoRef.current.currentTime = target;
      } else if (activeChunk.action === "speed") {
        const rate = activeChunk.speed ?? 2;
        if (lastPlaybackRate.current !== rate) {
          videoRef.current.playbackRate = rate;
          lastPlaybackRate.current = rate;
        }
      }
    } else if (lastPlaybackRate.current !== 1) {
      videoRef.current.playbackRate = 1;
      lastPlaybackRate.current = 1;
    }
  }, [silenceChunks, isPreviewMode, isProcessing, duration, zoom]);

  // ─── CANVAS MOUSE HANDLERS ───────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration === 0) return;
    const time = canvasTimeFromClientX(e.clientX);
    dragStartRef.current = time;
    hoverTimeRef.current = time;
    if (videoRef.current) videoRef.current.currentTime = time;
    requestAnimationFrame(() => drawCanvas(silenceChunks, time, duration));
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration === 0) return;
    const time = canvasTimeFromClientX(e.clientX);
    hoverTimeRef.current = time;
    requestAnimationFrame(() =>
      drawCanvas(silenceChunks, videoRef.current?.currentTime ?? 0, duration)
    );
  };

  const handleCanvasMouseUp = () => {
    const dStart = dragStartRef.current;
    const hTime = hoverTimeRef.current;
    if (dStart !== null && hTime !== null) {
      const start = Math.min(dStart, hTime);
      const end = Math.max(dStart, hTime);
      if (end - start > 0.05) {
        const newChunk: SilenceChunk = {
          start,
          end,
          action: silenceAction,
          speed: silenceAction === "speed" ? rampSpeed : undefined,
        };
        setSilenceChunks(mergeChunks([...silenceChunks, newChunk]));
      }
    }
    dragStartRef.current = null;
    hoverTimeRef.current = null;
    requestAnimationFrame(() =>
      drawCanvas(silenceChunks, videoRef.current?.currentTime ?? 0, duration)
    );
  };

  const handleCanvasMouseLeave = () => {
    dragStartRef.current = null;
    hoverTimeRef.current = null;
    requestAnimationFrame(() =>
      drawCanvas(silenceChunks, videoRef.current?.currentTime ?? 0, duration)
    );
  };

  // ─── CANVAS TOUCH HANDLERS ───────────────────────────────────────────────────
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration === 0) return;
    const time = canvasTimeFromClientX(e.touches[0].clientX);
    dragStartRef.current = time;
    hoverTimeRef.current = time;
    if (videoRef.current) videoRef.current.currentTime = time;
    requestAnimationFrame(() => drawCanvas(silenceChunks, time, duration));
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || duration === 0) return;
    const time = canvasTimeFromClientX(e.touches[0].clientX);
    hoverTimeRef.current = time;
    requestAnimationFrame(() =>
      drawCanvas(silenceChunks, videoRef.current?.currentTime ?? 0, duration)
    );
  };

  const handleCanvasTouchEnd = () => { handleCanvasMouseUp(); };

  const timeSaved = useMemo(
    () => silenceChunks.reduce((acc, c) => acc + (c.end - c.start), 0),
    [silenceChunks]
  );

  // ─── SIDEBAR CONTENT ─────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="space-y-6 pb-6">
      <section>
        <SectionLabel>Edit Mode</SectionLabel>
        <div className="flex p-1 rounded-xl bg-black/50 border border-white/[0.06] gap-1">
          <ModeBtn
            active={silenceAction === "cut"}
            onClick={() => setSilenceAction("cut")}
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Cut"
            color="red"
          />
          <ModeBtn
            active={silenceAction === "speed"}
            onClick={() => setSilenceAction("speed")}
            icon={<FastForward className="w-3.5 h-3.5" />}
            label="Speed"
            color="green"
          />
        </div>
        {silenceAction === "speed" && (
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-[11px] text-zinc-500">Speed multiplier</span>
            <div className="flex gap-1.5">
              {[2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setRampSpeed(s)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-xs font-bold border transition-all",
                    rampSpeed === s
                      ? "bg-emerald-600 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      : "bg-zinc-800/80 border-white/5 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionLabel>AI Scanner</SectionLabel>
        <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/[0.06]">
          <SliderRow
            label="Threshold"
            unit="dB"
            value={threshold}
            min={-60}
            max={-10}
            step={1}
            onChange={setThreshold}
          />
          <SliderRow
            label="Min Duration"
            unit="s"
            value={minDuration}
            min={0.1}
            max={3}
            step={0.1}
            onChange={setMinDuration}
          />
          <SliderRow
            label="Padding"
            unit="s"
            value={padding}
            min={0}
            max={0.5}
            step={0.05}
            onChange={setPadding}
          />
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing || isProcessing}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all disabled:opacity-40"
          >
            <RotateCcw className={cn("w-3 h-3", isAnalyzing && "animate-spin")} />
            Re-analyze
          </button>
        </div>
      </section>

      <section>
        <SectionLabel>Stats</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Cuts" value={silenceChunks.length.toString()} />
          <StatCard label="Time Saved" value={`${timeSaved.toFixed(1)}s`} accent />
        </div>
      </section>
    </div>
  );

  const ExportContent = () => (
    <div className="space-y-6 pb-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="mb-0">Output</SectionLabel>
          {isPro ? (
            <span className="text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-emerald-500/10">
              PRO
            </span>
          ) : (
            <button
              onClick={onTogglePro}
              className="text-zinc-300 hover:text-white border border-white/10 px-2 py-0.5 rounded-md text-[10px] bg-white/5 hover:bg-white/10 transition font-semibold"
            >
              Test Pro
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-[11px] text-zinc-500 font-medium">Aspect Ratio</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: "original", label: "Original" },
                { val: "16:9", label: "YouTube 16:9" },
                { val: "9:16", label: "Reel 9:16" },
                { val: "1:1", label: "Square 1:1" },
              ].map((f) => (
                <button
                  key={f.val}
                  onClick={() => setExportFormat(f.val as any)}
                  className={cn(
                    "py-2 text-[11px] rounded-lg border transition-all font-medium",
                    exportFormat === f.val
                      ? "bg-violet-600/30 border-violet-500/60 text-violet-300"
                      : "bg-black/30 border-white/[0.06] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] text-zinc-500 font-medium">Resolution</span>
            <div className="flex gap-1.5">
              {[
                { val: "720p", label: "720p" },
                { val: "1080p", label: "1080p" },
                { val: "4k", label: "4K" },
              ].map((r) => (
                <button
                  key={r.val}
                  onClick={() => setExportRes(r.val as any)}
                  className={cn(
                    "flex-1 py-2 text-[11px] rounded-lg border transition-all font-bold relative",
                    exportRes === r.val
                      ? "bg-violet-600/50 border-violet-500/60 text-white"
                      : "bg-black/30 border-white/[0.06] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  {r.label}
                  {r.val !== "720p" && !isPro && !hasPaidForExport && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[7px] text-black font-black">
                      $
                    </span>
                  )}
                  {r.val !== "720p" && hasPaidForExport && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-black" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        {!isPro && exportRes === "720p" && (
          <p className="mb-3 text-center text-[11px] text-zinc-600 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" /> Watermark applied on free exports
          </p>
        )}
        <button
          onClick={handleRenderClick}
          disabled={isAnalyzing || isProcessing || silenceChunks.length === 0}
          className={cn(
            "w-full py-3.5 rounded-xl font-black tracking-wide text-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            needsPayment
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(124,58,237,0.2)]"
          )}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Working…
            </span>
          ) : needsPayment ? (
            `Pay ${pricing ? pricing.symbol + priceToDisplay : "..."} · Render HD`
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Film className="w-4 h-4" /> Render & Export
            </span>
          )}
        </button>

        {processedVideoUrl && (
          <button
            onClick={handleExport}
            className="mt-2 w-full py-2.5 rounded-xl font-bold text-sm border border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/30 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download MP4
          </button>
        )}
      </section>
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#08080a] text-white overflow-hidden select-none">

      {/* ── TOP HEADER ── */}
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.07] bg-zinc-900/70 backdrop-blur-xl flex-shrink-0 z-30">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="min-w-0">
            <h1 className="text-xs font-semibold truncate text-zinc-100 leading-tight">
              {files.length > 1 ? `${activeFileIndex + 1}/${files.length} · ` : ""}
              {file.name}
            </h1>
            <p className="text-[10px] text-zinc-600 leading-tight">
              {(file.size / 1024 / 1024).toFixed(1)} MB · {duration.toFixed(1)}s
            </p>
          </div>

          {files.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setActiveFileIndex((i) => Math.max(0, i - 1))}
                disabled={activeFileIndex === 0}
                className="w-6 h-6 flex items-center justify-center rounded bg-white/5 border border-white/[0.06] text-zinc-400 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => setActiveFileIndex((i) => Math.min(files.length - 1, i + 1))}
                disabled={activeFileIndex === files.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded bg-white/5 border border-white/[0.06] text-zinc-400 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          <IconBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </IconBtn>
          <div className="w-px h-4 bg-white/[0.08] mx-1" />
          <IconBtn onClick={() => setShowHelpModal(true)} title="Help">
            <HelpCircle className="w-4 h-4 text-violet-400" />
          </IconBtn>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isProcessing && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-violet-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing…
            </span>
          )}
          {processedVideoUrl && (
            <button
              onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}
          <button
            onClick={handleRenderClick}
            disabled={isProcessing || isAnalyzing || silenceChunks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-[0_0_16px_rgba(124,58,237,0.25)]"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export MP4</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      {/* ── MAIN BODY ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside
          className={cn(
            "hidden md:flex flex-col flex-shrink-0 bg-zinc-900/50 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 overflow-hidden",
            sidebarOpen ? "w-72" : "w-0"
          )}
        >
          <div className="flex-1 overflow-y-auto px-4 pt-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <SidebarContent />
            <ExportContent />
          </div>
        </aside>

        {/* Sidebar toggle (desktop) */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-12 items-center justify-center bg-zinc-800 border border-white/[0.06] rounded-r-lg text-zinc-500 hover:text-white transition-all"
          style={{ left: sidebarOpen ? "272px" : "0" }}
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {/* ── VIDEO + TIMELINE column ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Video area */}
          <div className="flex-1 relative flex items-center justify-center p-3 md:p-5 pb-2 min-h-0">
            <div className="w-full h-full relative rounded-xl overflow-hidden ring-1 ring-white/[0.08] shadow-2xl bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (videoRef.current) videoRef.current.playbackRate = 1;
                  lastPlaybackRate.current = 1;
                }}
              />

              <button
                onClick={() => setIsPreviewMode((p) => !p)}
                className={cn(
                  "absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all border",
                  isPreviewMode
                    ? "bg-violet-600/90 border-violet-400/50 text-white"
                    : "bg-black/60 border-white/10 text-zinc-400 hover:bg-black/80"
                )}
              >
                <Eye className="w-3 h-3" />
                {isPreviewMode ? "Preview On" : "Preview Off"}
              </button>

              {(isAnalyzing || isProcessing) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
                  <div className="w-[260px] sm:w-[300px] space-y-4 p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-violet-400 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-200">
                          {progress?.message ?? "Processing…"}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {progress?.progress ?? 0}% complete
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full transition-all duration-300"
                        style={{ width: `${progress?.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-30 flex items-start gap-3 p-4 rounded-xl bg-red-950/90 border border-red-700/50 shadow-2xl backdrop-blur-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-red-200 mb-0.5">Error</p>
                  <p className="text-red-300 text-xs leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-300 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── PLAYBACK CONTROLS BAR ── */}
          <div className="flex-shrink-0 flex items-center gap-3 px-3 md:px-5 py-2.5 border-t border-white/[0.06] bg-zinc-950/80">
            {/* Time display */}
            <div className="flex items-center gap-1 text-xs font-mono flex-shrink-0">
              <span className="text-violet-400 font-bold">{formatTime(currentTime)}</span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-500">{formatTime(duration)}</span>
            </div>

            {/* Zoom + Play */}
            <div className="flex-1 flex items-center justify-center gap-4">
              {/* Zoom control */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                <button
                  onClick={() => setZoom((z) => Math.max(1, +(z - 1).toFixed(1)))}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
                  title="Zoom Out"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-20 sm:w-32 relative flex items-center">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400"
                  />
                </div>
                <button
                  onClick={() => setZoom((z) => Math.min(20, +(z + 1).toFixed(1)))}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
                  title="Zoom In"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                  {zoom}x
                </span>
              </div>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.12)] flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
            </div>

            {/* Right: mode indicator + mobile undo/redo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-md hidden sm:block",
                  silenceAction === "cut"
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                )}
              >
                {silenceAction === "cut" ? "✂ Cut" : "⚡ Speed"}
              </span>
              <div className="flex items-center gap-1 sm:hidden">
                <IconBtn onClick={undo} disabled={!canUndo}>
                  <Undo2 className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn onClick={redo} disabled={!canRedo}>
                  <Redo2 className="w-3.5 h-3.5" />
                </IconBtn>
              </div>
            </div>
          </div>

          {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
          {/*
            Layout:
              containerRef  ← outer wrapper, used by ResizeObserver
              └── track header (fixed 24px)
              └── scrollRef  ← overflow-x:auto, sized to full remaining height
                    └── inner div  ← width = 100% × zoom  (drives the scrollable area)
                          └── canvas  ← always sized to the *scroll container* viewport
                                         (canvas.width = scrollRef.clientWidth × dpr)
                                         Drawing uses (time/dur × logicalW × zoom − scrollLeft)
                                         so rendered positions match the scroll offset.
          */}
          <div
            ref={containerRef}
            className="flex-shrink-0 bg-[#08080a] border-t border-white/[0.06]"
            style={{ height: "clamp(72px, 15vw, 120px)" }}
          >
            {/* Track header */}
            <div className="h-6 px-3 flex items-center justify-between bg-zinc-900/60 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  V1 Master
                </span>
                {zoom > 1 && (
                  <span className="text-[9px] font-mono text-violet-500 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
                    {zoom}×
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Legend color="bg-[#6366f1]" label="Audio" />
                <Legend color="bg-red-500/70" label="Cut" />
                <Legend color="bg-emerald-500/70" label="Speed" />
              </div>
            </div>

            {/* Scrollable timeline area */}
            <div
              ref={scrollRef}
              className="relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
              style={{ height: "calc(100% - 24px)" }}
            >
              {/* Inner div whose width drives the scrollbar */}
              <div
                style={{
                  width: `${100 * zoom}%`,
                  height: "100%",
                  position: "relative",
                  minWidth: "100%",
                }}
              >
                {/*
                  The canvas is position:absolute and fills the *visible* scroll
                  viewport (not the full inner div). We keep it pinned to the
                  left/top of the scroll container via sticky-left behaviour so it
                  always covers the visible area. drawCanvas offsets all draw calls
                  by -scrollLeft so the waveform & regions track correctly.
                */}
                <canvas
                  ref={canvasRef}
                  className="sticky left-0 top-0 block cursor-crosshair touch-none"
                  style={{
                    height: "100%",
                    // Width is controlled by JS (canvas.width / dpr = scroll container width)
                    // We set it explicitly so the element doesn't collapse
                    width: "100%",
                    maxWidth: "100vw",
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                />
              </div>
            </div>
          </div>

          {/* ── MOBILE BOTTOM TABS ── */}
          <div className="md:hidden flex-shrink-0 border-t border-white/[0.06] bg-zinc-900/90">
            <div className="flex border-b border-white/[0.06]">
              {(
                [
                  { id: "controls", label: "Controls", icon: <Layers className="w-3.5 h-3.5" /> },
                  { id: "settings", label: "Scanner", icon: <Wand2 className="w-3.5 h-3.5" /> },
                  { id: "export", label: "Export", icon: <Film className="w-3.5 h-3.5" /> },
                ] as { id: MobileTab; label: string; icon: React.ReactNode }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobileTab(tab.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
                    mobileTab === tab.id
                      ? "text-violet-400 border-b-2 border-violet-500"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setShowHelpModal(true)}
                className="flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold text-zinc-600 hover:text-violet-400 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </button>
            </div>

            <div className="overflow-y-auto px-4 pt-4" style={{ maxHeight: "38vh" }}>
              {mobileTab === "controls" && (
                <div className="space-y-4 pb-4">
                  <div className="flex p-1 rounded-xl bg-black/50 border border-white/[0.06] gap-1">
                    <ModeBtn
                      active={silenceAction === "cut"}
                      onClick={() => setSilenceAction("cut")}
                      icon={<Scissors className="w-3.5 h-3.5" />}
                      label="Cut"
                      color="red"
                    />
                    <ModeBtn
                      active={silenceAction === "speed"}
                      onClick={() => setSilenceAction("speed")}
                      icon={<FastForward className="w-3.5 h-3.5" />}
                      label="Speed"
                      color="green"
                    />
                  </div>
                  {silenceAction === "speed" && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Speed</span>
                      <div className="flex gap-2">
                        {[2, 4].map((s) => (
                          <button
                            key={s}
                            onClick={() => setRampSpeed(s)}
                            className={cn(
                              "w-9 h-9 rounded-lg text-xs font-bold border transition-all",
                              rampSpeed === s
                                ? "bg-emerald-600 border-emerald-500/50 text-white"
                                : "bg-zinc-800/80 border-white/5 text-zinc-400"
                            )}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Cuts" value={silenceChunks.length.toString()} />
                    <StatCard label="Saved" value={`${timeSaved.toFixed(1)}s`} accent />
                  </div>
                </div>
              )}
              {mobileTab === "settings" && (
                <div className="space-y-4 pb-4">
                  <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <SliderRow
                      label="Threshold"
                      unit="dB"
                      value={threshold}
                      min={-60}
                      max={-10}
                      step={1}
                      onChange={setThreshold}
                    />
                    <SliderRow
                      label="Min Duration"
                      unit="s"
                      value={minDuration}
                      min={0.1}
                      max={3}
                      step={0.1}
                      onChange={setMinDuration}
                    />
                    <SliderRow
                      label="Padding"
                      unit="s"
                      value={padding}
                      min={0}
                      max={0.5}
                      step={0.05}
                      onChange={setPadding}
                    />
                  </div>
                  <button
                    onClick={runAnalysis}
                    disabled={isAnalyzing || isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs text-zinc-400 border border-white/[0.06] hover:bg-white/[0.04] transition disabled:opacity-40"
                  >
                    <RotateCcw className={cn("w-3 h-3", isAnalyzing && "animate-spin")} />
                    Re-analyze Audio
                  </button>
                </div>
              )}
              {mobileTab === "export" && (
                <div className="pb-4">
                  <ExportContent />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── HELP MODAL ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-violet-400" /> Editor Guide
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Master silence editing in seconds
                </p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <GuideSection title="1. AI Silence Detection" icon={<Wand2 className="w-4 h-4" />}>
                The AI scans your video on load. Fine-tune with three sliders:{" "}
                <strong className="text-zinc-300">Threshold</strong> (sensitivity),{" "}
                <strong className="text-zinc-300">Min Duration</strong> (shortest silence to
                catch), and <strong className="text-zinc-300">Padding</strong> (breathing room
                around speech). Hit Re-analyze after changes.
              </GuideSection>
              <GuideSection
                title="2. Manual Waveform Editor"
                icon={<Scissors className="w-4 h-4" />}
              >
                Drag on the waveform to draw custom regions.{" "}
                <span className="text-red-400 font-medium">Red = Cut</span> removes sections
                entirely. <span className="text-emerald-400 font-medium">Green = Speed</span>{" "}
                fast-forwards through them. Switch modes in the Controls panel. Use the zoom
                slider to get precise cuts on short silences.
              </GuideSection>
              <GuideSection title="3. Zoom & Scroll" icon={<Eye className="w-4 h-4" />}>
                Use the zoom slider (or +/− buttons) to expand the timeline up to 20×. The
                timeline scrolls horizontally — drag left/right or use your trackpad/mouse
                wheel. When playing with zoom active, the playhead auto-scrolls to stay visible.
              </GuideSection>
              <GuideSection title="4. Live Preview" icon={<Eye className="w-4 h-4" />}>
                Preview mode lets you feel the final edit in real-time — cuts are skipped, speed
                regions are fast-forwarded as you play. Toggle it off to watch the raw original.
              </GuideSection>
              <GuideSection title="5. Export" icon={<Download className="w-4 h-4" />}>
                Pick aspect ratio and resolution. Free exports are 720p with watermark. Pay once
                to unlock 1080p or 4K for the session.
              </GuideSection>
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-3">
                  Keyboard Shortcuts
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Space", "Play/Pause"],
                    ["Ctrl+Z", "Undo"],
                    ["Ctrl+Y", "Redo"],
                  ].map(([key, desc]) => (
                    <div
                      key={key}
                      className="flex flex-col items-center gap-1 bg-zinc-800/60 border border-white/[0.06] rounded-lg p-2"
                    >
                      <kbd className="text-[11px] font-mono font-bold text-violet-300 bg-violet-950/40 px-2 py-0.5 rounded">
                        {key}
                      </kbd>
                      <span className="text-[10px] text-zinc-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/[0.07]">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2.5 bg-white text-zinc-950 font-bold text-sm rounded-xl hover:bg-zinc-100 transition"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL LEAD CAPTURE MODAL ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 text-center">
            <div className="w-12 h-12 bg-violet-600/20 text-violet-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-500/30">
              <Download className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2 text-white">
              Your fast 720p draft is ready!
            </h2>
            <p className="text-sm text-zinc-400 mb-6 font-medium">
              To download this free watermarked output, simply enter your email where we should
              send your receipt/updates.
            </p>

            <form onSubmit={submitLeadAndExport} className="space-y-4">
              <input
                type="email"
                required
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-white placeholder-zinc-600"
              />
              <button
                type="submit"
                disabled={isSubmittingLead || !leadEmail}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingLead ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Download Video & Unlock Draft"
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
              >
                Cancel & go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3",
        className
      )}
    >
      {children}
    </h3>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: "red" | "green";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all",
        active
          ? color === "red"
            ? "bg-red-950/60 text-red-400 border border-red-800/40 shadow-sm"
            : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 shadow-sm"
          : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/8 disabled:opacity-25 transition-all"
    >
      {children}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block w-2.5 h-1.5 rounded-sm", color)} />
      <span className="text-[9px] font-medium text-zinc-600">{label}</span>
    </span>
  );
}

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-zinc-500">{label}</span>
        <span className="text-violet-400 font-semibold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-violet-500 cursor-pointer"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border",
        accent
          ? "bg-violet-950/25 border-violet-800/20"
          : "bg-white/[0.03] border-white/[0.06]"
      )}
    >
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          accent ? "text-violet-300" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function GuideSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
        <span className="p-1.5 bg-white/5 rounded-lg text-violet-400">{icon}</span>
        {title}
      </h3>
      <p className="text-xs text-zinc-400 leading-relaxed pl-9">{children}</p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}