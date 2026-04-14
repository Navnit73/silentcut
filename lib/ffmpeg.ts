import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

export async function getFFmpeg(): Promise<FFmpeg> {
  // Return existing loaded instance
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  // Deduplicate concurrent calls
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    try {
      await ff.load({
        coreURL: await toBlobURL(
          `${BASE_URL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${BASE_URL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      ffmpegInstance = ff;
      return ff;
    } catch (e) {
      loadPromise = null; // allow retry
      throw e;
    }
  })();

  return loadPromise;
}

export function resetFFmpeg(): void {
  ffmpegInstance = null;
  loadPromise = null;
}