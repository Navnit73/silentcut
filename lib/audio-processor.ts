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
      curr.start <= last.end &&
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

let sharedAudioContext: AudioContext | null = null;
let cachedFileStr: string | null = null;
let cachedAudioBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return sharedAudioContext;
}

async function getCachedAudioBuffer(
  file: File,
  signal?: AbortSignal,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<AudioBuffer> {
  const fileStr = `${file.name}-${file.size}-${file.lastModified}`;
  
  // Return cache if file matches
  if (cachedFileStr === fileStr && cachedAudioBuffer) {
    return cachedAudioBuffer;
  }

  onProgress?.({ message: "Reading file…", progress: 5 });
  const arrayBuffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  onProgress?.({ message: "Decoding audio…", progress: 20 });
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  // Decode directly without .slice(0) memory copy
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  cachedFileStr = fileStr;
  cachedAudioBuffer = audioBuffer;
  return audioBuffer;
}

export async function analyzeAudio(
  file: File,
  thresholdDB: number = -30,
  minSilenceDuration: number = 0.3,
  padding: number = 0.1,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<SilenceChunk[]> {
  const audioBuffer = await getCachedAudioBuffer(file, signal, onProgress);

  onProgress?.({ message: "Analyzing waveform…", progress: 40 });

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02));
  const thresholdAmplitude = Math.pow(10, thresholdDB / 20);

  const silenceChunks: SilenceChunk[] = [];
  let isSilent = false;
  let silenceStart = 0;
  const reportEvery = Math.max(1, Math.floor(length / windowSize / 50));
  let windowIndex = 0;

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < length; i += windowSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const end = Math.min(i + windowSize, length);
    const frameCount = end - i;

    let sumSq = 0;
    for (let c = 0; c < numChannels; c++) {
      const ch = channels[c];
      for (let j = i; j < end; j++) {
        sumSq += ch[j] * ch[j];
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
        if (chunkEnd > chunkStart && silenceEnd - silenceStart > minSilenceDuration) {
          silenceChunks.push({ start: chunkStart, end: chunkEnd, action: "cut" });
        }
      }
    }

    if (++windowIndex % reportEvery === 0) {
      const pct = 40 + Math.floor((i / length) * 55);
      onProgress?.({ message: "Scanning for silence…", progress: pct });
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

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

export async function extractWaveform(
  file: File,
  targetPoints: number = 1600
): Promise<Float32Array> {
  const audioBuffer = await getCachedAudioBuffer(file);
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const blockSize = Math.max(1, Math.floor(length / targetPoints));
  const envelope = new Float32Array(targetPoints);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < targetPoints; i++) {
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