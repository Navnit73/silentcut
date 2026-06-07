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
const SEGMENT_MAX_DURATION = 120; // Split into 2 minute chunks to prevent FFmpeg timeout

function buildAtempo(speed: number): string {
  if (speed <= 0) return "atempo=0.5";

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
  speed: number;
};

async function processSegment(
  ffmpeg: any,
  inputName: string,
  segments: InternalSegment[],
  totalDuration: number,
  startIndex: number,
  endIndex: number,
  onProgress?: (progress: ProgressEvent) => void
): Promise<Blob> {
  onProgress?.({ message: "Processing segment…", percent: 20 });

  const segmentSegments = segments.slice(startIndex, endIndex);
  if (segmentSegments.length === 0) {
    throw new Error("No segments to process");
  }

  let filterParts = "";
  segmentSegments.forEach((seg, i) => {
    const s = seg.start.toFixed(4);
    const e = seg.end.toFixed(4);

    if (seg.speed === 1) {
      filterParts += `[${startIndex + i}:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}];`;
      filterParts += `[${startIndex + i}:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}];`;
    } else {
      const ptsScale = (1 / seg.speed).toFixed(6);
      const atempo = buildAtempo(seg.speed);
      filterParts += `[${startIndex + i}:v]trim=start=${s}:end=${e},setpts=${ptsScale}*PTS-STARTPTS[v${i}];`;
      filterParts += `[${startIndex + i}:a]atrim=start=${s}:end=${e},${atempo},asetpts=PTS-STARTPTS[a${i}];`;
    }
  });

  const interleaved = segmentSegments.flatMap((_, i) => [`[v${i}]`, `[a${i}]`]).join("");
  filterParts += `${interleaved}concat=n=${segmentSegments.length}:v=1:a=1[conc_v][outa];`;
  filterParts += `[conc_v]copy[v]`;

  const outputName = `segment_${startIndex}_${endIndex}.mp4`;

  ffmpeg.on("log", ({ message: msg }: any) => {
    const match = msg.match(/time=(\d+):(\d+):([\d.]+)/);
    if (match) {
      const secs = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
      const segmentDuration = segments.reduce((acc, s) => acc + (s.end - s.start) / s.speed, 0);
      const pct = 20 + Math.min(70, Math.floor((secs / segmentDuration) * 70));
      onProgress?.({ message: "Encoding segment…", percent: pct });
    }
  });

  try {
    await ffmpeg.exec([
      "-i", inputName,
      "-filter_complex", filterParts,
      "-map", "[v]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(outputName);
    return new Blob([(data as Uint8Array).slice(0)], { type: "video/mp4" });
  } finally {
    try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
  }
}

export async function processVideo(
  file: File,
  silenceChunks: SilenceChunk[],
  onProgress?: (p: ProgressEvent) => void,
  options?: ExportOptions
): Promise<Blob> {
  onProgress?.({ message: "Reading video metadata…", percent: 2 });
  const duration = await getVideoDuration(file);

  if (duration <= 0) {
    throw new Error("Invalid video duration");
  }

  const sorted = [...silenceChunks].sort((a, b) => a.start - b.start);

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

  if (segments.length === 0) {
    throw new Error("No valid segments found");
  }

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

  onProgress?.({ message: "Writing video to memory…", percent: 10 });
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // === APPLY EXPORT PRESETS ===
  let filterChain = "";

  if (options?.format && options.format !== "original") {
    let cropStr = "";
    switch (options.format) {
      case "16:9":
        cropStr = `crop='min(iw,ih*16/9)':'min(iw*9/16,ih)'`;
        break;
      case "9:16":
        cropStr = `crop='min(iw,ih*9/16)':'min(iw*16/9,ih)'`;
        break;
      case "1:1":
        cropStr = `crop='min(iw,ih)':'min(iw,ih)'`;
        break;
    }
    if (cropStr) {
      filterChain += `${cropStr}[crop_v];`;
    }
  }

  if (options?.res) {
    let scaleStr;
    switch (options.res) {
      case "720p":
        scaleStr = "scale=1280:720";
        break;
      case "1080p":
        scaleStr = "scale=1920:1080";
        break;
      case "4k":
        scaleStr = "scale=3840:2160";
        break;
    }
    if (scaleStr) {
      filterChain += `${scaleStr}[scale_v];`;
    }
  }

  if (options?.watermark && !filterChain.includes("crop_v") && !filterChain.includes("scale_v")) {
    onProgress?.({ message: "Generating watermark…", percent: 15 });

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

    const wmBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (wmBlob) {
      const wmArrayBuffer = await wmBlob.arrayBuffer();
      await ffmpeg.writeFile("watermark.png", new Uint8Array(wmArrayBuffer));
      filterChain += "overlay=main_w-overlay_w-20:main_h-overlay_h-20[outv]";
    }
  }

  const totalDurationValue = segments.reduce((acc, s) => acc + (s.end - s.start) / s.speed, 0);

  // Process in chunks if too large
  if (totalDurationValue > SEGMENT_MAX_DURATION) {
    onProgress?.({ message: "Processing in chunks…", percent: 20 });

    const chunkDuration = SEGMENT_MAX_DURATION;
    let chunks: InternalSegment[][] = [];
    let currentChunk: InternalSegment[] = [];
    let currentChunkDuration = 0;
    let currentSegmentIndex = 0;

    for (const seg of segments) {
      const segmentDuration = (seg.end - seg.start) / seg.speed;

      if (currentChunkDuration + segmentDuration > chunkDuration && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkDuration = 0;
        currentSegmentIndex = segments.indexOf(seg);
      }

      currentChunk.push(seg);
      currentChunkDuration += segmentDuration;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const processedBlobs: Blob[] = [];
    let currentProgress = 20;

    for (let i = 0; i < chunks.length; i++) {
      const chunkProgress = 20 + (i / chunks.length) * 70;
      const onChunkProgress = (p: ProgressEvent) => {
        onProgress?.({
          message: p.message,
          percent: currentProgress + (p.percent - 20) * (1 / chunks.length)
        });
      };

      const chunkBlob = await processSegment(
        ffmpeg,
        inputName,
        chunks[i],
        totalDurationValue,
        0,
        chunks[i].length,
        onChunkProgress
      );

      processedBlobs.push(chunkBlob);
      currentProgress = chunkProgress;
    }

    onProgress?.({ message: "Concatenating segments…", percent: 95 });

    if (processedBlobs.length === 1) {
      return processedBlobs[0];
    }

    // Concatenate multiple chunks
    const concatInputs = processedBlobs.map((_, i) => `segment_${i}.mp4`);

    for (const input of concatInputs) {
      const arrayBuffer = await processedBlobs[parseInt(input.split('_')[1])].arrayBuffer();
      await ffmpeg.writeFile(input, new Uint8Array(arrayBuffer));
    }

    const concatFilter = concatInputs.flatMap((_, i) => `[${i}:v]`).join("") + `concat=n=${concatInputs.length}:v=1:unsafe=1[conc_v];[conc_v]copy[outv]`;

    await ffmpeg.exec([
      "-i", concatInputs[0],
      "-filter_complex", concatFilter,
      "-map", "[outv]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "22",
      "-movflags", "+faststart",
      "-y",
      "final.mp4"
    ]);

    const finalData = await ffmpeg.readFile("final.mp4");
    return new Blob([(finalData as Uint8Array).slice(0)], { type: "video/mp4" });
  }

  // Simple case - no chunking
  onProgress?.({ message: "Rendering video…", percent: 20 });
  ffmpeg.on("log", ({ message: msg }: any) => {
    const match = msg.match(/time=(\d+):(\d+):([\d.]+)/);
    if (match && onProgress && totalDurationValue > 0) {
      const secs = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
      const pct = 20 + Math.min(74, Math.floor((secs / totalDurationValue) * 74));
      onProgress({ message: "Encoding…", percent: pct });
    }
  });

  const ffmpegArgs = ["-i", inputName];

  if (options?.watermark) {
    ffmpegArgs.push("-i", "watermark.png");
  }

  ffmpegArgs.push(
    "-filter_complex", filterChain,
    "-map", filterChain.includes("outv") ? "[outv]" : "0:v",
    "-map", filterChain.includes("outa") ? "[outa]" : "0:a",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    "output.mp4"
  );

  await ffmpeg.exec(ffmpegArgs);

  onProgress?.({ message: "Packaging output…", percent: 96 });
  const data = await ffmpeg.readFile("output.mp4");

  try {
    await ffmpeg.deleteFile(inputName);
    if (options?.watermark) {
      await ffmpeg.deleteFile("watermark.png");
    }
  } catch { /* ignore */ }

  onProgress?.({ message: "Done!", percent: 100 });
  return new Blob([(data as Uint8Array).slice(0)], { type: "video/mp4" });
}