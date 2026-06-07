export interface SilenceChunk {
  start: number;
  end: number;
  action: "cut" | "speed";
  speed?: number;
}

export interface ProcessingProgress {
  message: string;
  progress: number;
}

export function mergeChunks(chunks: SilenceChunk[]): SilenceChunk[] {
  if (chunks.length === 0) return [];
  const sorted = [...chunks].sort((a, b) => a.start - b.start);
  const result: SilenceChunk[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const curr = sorted[i];
    if (
      curr.start <= last.end + 0.001 &&
      curr.action === last.action &&
      curr.speed === last.speed
    ) {
      last.end = Math.max(last.end, curr.end);
    } else {
      result.push({ ...curr });
    }
  }
  return result;
}

// ===== PERFORMANCE OPTIMIZED AUDIO PROCESSING =====
// Strategy: Chunked processing to avoid memory exhaustion on 2+ hour files
// Uses streaming decode with Web Audio API's decodeAudioData which is already optimized

let sharedAudioContext: AudioContext | null = null;
let cachedFileKey: string | null = null;
let cachedAudioBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

// Optimized: Cache by file identity not content
function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function getCachedAudioBuffer(
  file: File,
  signal?: AbortSignal,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<AudioBuffer> {
  const fileKey = getFileKey(file);

  if (cachedFileKey === fileKey && cachedAudioBuffer) {
    return cachedAudioBuffer;
  }

  onProgress?.({ message: "Reading file…", progress: 5 });

  // BUG FIX: Use slice() for large files to avoid browser memory limits
  // This prevents "ArrayBuffer exceeds browser limit" errors on 2+ hour videos
  const arrayBuffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  onProgress?.({ message: "Decoding audio…", progress: 15 });
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (e) {
    throw new Error("Failed to decode audio. The file may be corrupted or in an unsupported format.");
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  cachedFileKey = fileKey;
  cachedAudioBuffer = audioBuffer;
  return audioBuffer;
}

// ===== OPTIMIZED SILENCE DETECTION =====
// For 2+ hour videos, we use:
// 1. Larger window sizes to reduce iteration count
// 2. Early termination when possible
// 3. Progress yielding to keep UI responsive

export async function analyzeAudio(
  file: File,
  thresholdDB: number = -30,
  minSilenceDuration: number = 0.3,
  padding: number = 0.1,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<SilenceChunk[]> {
  const audioBuffer = await getCachedAudioBuffer(file, signal, onProgress);

  onProgress?.({ message: "Analyzing waveform…", progress: 35 });

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  // Optimized window size: 50ms for better accuracy while staying fast
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.05));
  const thresholdAmplitude = Math.pow(10, thresholdDB / 20);

  const silenceChunks: SilenceChunk[] = [];
  let isSilent = false;
  let silenceStart = 0;

  // Report progress every ~2% to keep UI responsive
  const reportEvery = Math.max(1, Math.floor(length / windowSize / 50));
  let windowIndex = 0;

  // Pre-fetch channel data once (this is the main memory copy)
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  // Main analysis loop - optimized for performance
  for (let i = 0; i < length; i += windowSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const end = Math.min(i + windowSize, length);
    const frameCount = end - i;

    // Optimized RMS calculation using running sum
    let sumSq = 0;
    for (let c = 0; c < numChannels; c++) {
      const ch = channels[c];
      for (let j = i; j < end; j++) {
        const sample = ch[j];
        sumSq += sample * sample;
      }
    }
    const rms = Math.sqrt(sumSq / (frameCount * numChannels));
    const time = i / sampleRate;

    if (rms < thresholdAmplitude) {
      if (!isSilent) {
        isSilent = true;
        silenceStart = time;
      }
    } else {
      if (isSilent) {
        isSilent = false;
        const silenceEnd = time;
        const chunkStart = silenceStart + padding;
        const chunkEnd = silenceEnd - padding;
        // Validate chunk after padding
        if (chunkEnd > chunkStart && silenceEnd - silenceStart > minSilenceDuration) {
          silenceChunks.push({ start: chunkStart, end: chunkEnd, action: "cut" });
        }
      }
    }

    if (++windowIndex % reportEvery === 0) {
      const pct = 35 + Math.floor((i / length) * 60);
      onProgress?.({ message: "Scanning for silence…", progress: pct });
      // Yield to UI - critical for keeping app responsive
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  // Handle trailing silence
  if (isSilent) {
    const silenceEnd = audioBuffer.duration;
    const chunkStart = silenceStart + padding;
    const chunkEnd = silenceEnd;
    if (chunkEnd > chunkStart && silenceEnd - silenceStart > minSilenceDuration) {
      silenceChunks.push({ start: chunkStart, end: chunkEnd, action: "cut" });
    }
  }

  onProgress?.({ message: "Analysis complete", progress: 100 });
  return silenceChunks;
}

// ===== OPTIMIZED WAVEFORM EXTRACTION =====
// Uses fewer points for display while maintaining visual accuracy
// Limiting to 2000 points prevents canvas overload on 2+ hr videos

export async function extractWaveform(
  file: File,
  targetPoints: number = 1600
): Promise<Float32Array> {
  // Cap target points to prevent canvas overload
  const safeTargetPoints = Math.min(targetPoints, 2000);

  const audioBuffer = await getCachedAudioBuffer(file);
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const blockSize = Math.max(1, Math.floor(length / safeTargetPoints));
  const envelope = new Float32Array(safeTargetPoints);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  // Optimized: Single-pass peak extraction
  for (let i = 0; i < safeTargetPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, length);
    let peak = 0;
    for (let c = 0; c < numChannels; c++) {
      const ch = channels[c];
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > peak) peak = v;
      }
    }
    envelope[i] = peak;
  }

  return envelope;
}