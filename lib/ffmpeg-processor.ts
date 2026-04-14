import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg, resetFFmpeg } from "./ffmpeg";
import type { SilenceChunk } from "./audio-processor";

export interface ProgressEvent {
  message: string;
  percent: number;
}

export interface ExportOptions {
  format: "original" | "16:9" | "9:16" | "1:1";
  res: "720p" | "1080p" | "4k";
  watermark: boolean;
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read video metadata"));
    };
    video.src = url;
  });
}

const MIN_SEGMENT_DURATION = 0.05;

/**
 * Builds a valid chained atempo filter string.
 * FFmpeg's atempo filter is limited to [0.5, 2.0] per stage, so we chain.
 * e.g. speed=4 → "atempo=2.0,atempo=2.0"
 *      speed=0.25 → "atempo=0.5,atempo=0.5"
 */
function buildAtempo(speed: number): string {
  const stages: number[] = [];
  let remaining = speed;

  if (speed >= 1) {
    while (remaining > 2.0 + 1e-9) {
      stages.push(2.0);
      remaining /= 2.0;
    }
    stages.push(parseFloat(remaining.toFixed(4)));
  } else {
    while (remaining < 0.5 - 1e-9) {
      stages.push(0.5);
      remaining /= 0.5;
    }
    stages.push(parseFloat(remaining.toFixed(4)));
  }

  return stages.map((s) => `atempo=${s}`).join(",");
}

type InternalSegment = {
  start: number;
  end: number;
  speed: number; // 1.0 = normal, >1 = fast-forward
};

export async function processVideo(
  file: File,
  silenceChunks: SilenceChunk[],
  onProgress?: (p: ProgressEvent) => void,
  options?: ExportOptions
): Promise<Blob> {
  onProgress?.({ message: "Reading video metadata…", percent: 2 });
  const duration = await getVideoDuration(file);

  const sorted = [...silenceChunks].sort((a, b) => a.start - b.start);

  // Build flat segment list: keep=1x, speed ramp=Nx, cut=omitted
  const segments: InternalSegment[] = [];
  let cursor = 0;

  for (const chunk of sorted) {
    if (chunk.start > cursor + MIN_SEGMENT_DURATION) {
      segments.push({ start: cursor, end: chunk.start, speed: 1 });
    }
    if (chunk.action === "speed") {
      segments.push({ start: chunk.start, end: chunk.end, speed: chunk.speed ?? 2 });
    }
    cursor = Math.max(cursor, chunk.end);
  }
  if (duration - cursor > MIN_SEGMENT_DURATION) {
    segments.push({ start: cursor, end: duration, speed: 1 });
  }

  if (segments.length === 0) return file;

  onProgress?.({ message: "Loading FFmpeg…", percent: 5 });
  let ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>;
  try {
    ffmpeg = await getFFmpeg();
  } catch {
    resetFFmpeg();
    throw new Error("Failed to load FFmpeg. Please refresh and try again.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const inputName = `input.${ext}`;
  const outputName = "output.mp4";

  onProgress?.({ message: "Writing video to memory…", percent: 10 });
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.({ message: "Building filter graph…", percent: 15 });

  // BUG FIX: was `keeps.reduce(...)` — `keeps` was never defined. Use segments instead.
  const totalOutputDuration = segments.reduce(
    (acc, s) => acc + (s.end - s.start) / s.speed,
    0
  );

  let filterParts = "";
  segments.forEach((seg, i) => {
    const s = seg.start.toFixed(4);
    const e = seg.end.toFixed(4);

    if (seg.speed === 1) {
      filterParts += `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}];`;
      filterParts += `[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}];`;
    } else {
      // BUG FIX: correct ptsScale and properly chained atempo
      const ptsScale = (1 / seg.speed).toFixed(6);
      const atempo = buildAtempo(seg.speed);
      filterParts += `[0:v]trim=start=${s}:end=${e},setpts=${ptsScale}*PTS-STARTPTS[v${i}];`;
      filterParts += `[0:a]atrim=start=${s}:end=${e},${atempo},asetpts=PTS-STARTPTS[a${i}];`;
    }
  });

  const interleaved = segments.flatMap((_, i) => [`[v${i}]`, `[a${i}]`]).join("");
  filterParts += `${interleaved}concat=n=${segments.length}:v=1:a=1[conc_v][outa];`;

  // --- Apply Export Presets ---
  let currentV = "[conc_v]";

  // Format (Crop)
  if (options?.format && options.format !== "original") {
    let cropStr = "";
    if (options.format === "16:9") {
      cropStr = `crop='min(iw,ih*16/9)':'min(iw*9/16,ih)'`;
    } else if (options.format === "9:16") {
      cropStr = `crop='min(iw,ih*9/16)':'min(iw*16/9,ih)'`;
    } else if (options.format === "1:1") {
      cropStr = `crop='min(iw,ih)':'min(iw,ih)'`;
    }
    if (cropStr) {
      filterParts += `${currentV}${cropStr}[crop_v];`;
      currentV = "[crop_v]";
    }
  }

  // Resolution (Scale)
  if (options?.res) {
    let maxSide = 1280; // 720p (1280x720 max bounds)
    if (options.res === "1080p") maxSide = 1920;
    if (options.res === "4k") maxSide = 3840;
    
    // Scale correctly preserving the original/cropped aspect ratio, applying maximum bounds, and ensuring even dimensions for x264.
    const scaleStr = `scale='min(${maxSide},iw)':'min(${maxSide},ih)':force_original_aspect_ratio=decrease,pad='ceil(iw/2)*2':'ceil(ih/2)*2'`;
    filterParts += `${currentV}${scaleStr}[scale_v];`;
    currentV = "[scale_v]";
  }

  // Watermark
  if (options?.watermark) {
    onProgress?.({ message: "Generating watermark…", percent: 18 });
    
    // Create an image using Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.roundRect(10, 10, 360, 60, 15);
      ctx.fill();
      
      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText("SilenceAI Free", 30, 50);
    }
    
    // Convert to Blob and then Uint8Array
    const wmBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (wmBlob) {
      const wmArrayBuffer = await wmBlob.arrayBuffer();
      await ffmpeg.writeFile("watermark.png", new Uint8Array(wmArrayBuffer));
      
      // Overlay filter (bottom right corner with padding)
      filterParts += `${currentV}[1:v]overlay=main_w-overlay_w-20:main_h-overlay_h-20[outv]`;
    } else {
      filterParts += `${currentV}copy[outv]`;
    }
  } else {
    // End of video chain
    filterParts += `${currentV}copy[outv]`;
  }

  onProgress?.({ message: "Rendering video…", percent: 20 });

  ffmpeg.on("log", ({ message: msg }) => {
    const match = msg.match(/time=(\d+):(\d+):([\d.]+)/);
    if (match && onProgress && totalOutputDuration > 0) {
      const secs =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseFloat(match[3]);
      const pct = 20 + Math.min(74, Math.floor((secs / totalOutputDuration) * 74));
      onProgress({ message: "Encoding…", percent: pct });
    }
  });

  try {
    const ffmpegArgs = [
      "-i", inputName,
    ];
    
    if (options?.watermark) {
      ffmpegArgs.push("-i", "watermark.png");
    }

    ffmpegArgs.push(
      "-filter_complex", filterParts,
      "-map", "[outv]",
      "-map", "[outa]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      outputName
    );

    await ffmpeg.exec(ffmpegArgs);
  } finally {
    try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
    if (options?.watermark) {
      try { await ffmpeg.deleteFile("watermark.png"); } catch { /* ignore */ }
    }
  }

  onProgress?.({ message: "Packaging output…", percent: 96 });
  const data = await ffmpeg.readFile(outputName);
  try { await ffmpeg.deleteFile(outputName); } catch { /* ignore */ }

  onProgress?.({ message: "Done!", percent: 100 });
  return new Blob([(data as Uint8Array).slice(0)], { type: "video/mp4" });
}