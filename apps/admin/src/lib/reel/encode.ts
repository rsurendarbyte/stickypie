// Turns a draw(t) function into an MP4 in the browser: each frame is drawn on a
// 1080 × 1920 canvas, encoded to H.264 with WebCodecs and written by mp4-muxer.
// Chrome / Edge only (Safari and Firefox lack an H.264 VideoEncoder here).
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export const REEL_W = 1080;
export const REEL_H = 1920;
export const REEL_FPS = 30;

export function canEncode(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

/** Renders `duration` seconds of `draw` into an MP4 blob, reporting progress 0..1. */
export async function encodeReel(
  draw: (ctx: CanvasRenderingContext2D, t: number) => void,
  duration: number,
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  if (!canEncode()) throw new Error("This browser can't make videos. Use Chrome or Edge on a computer.");
  const canvas = document.createElement("canvas");
  canvas.width = REEL_W;
  canvas.height = REEL_H;
  const ctx = canvas.getContext("2d")!;

  const codec = await pickCodec();
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: REEL_W, height: REEL_H, frameRate: REEL_FPS },
    fastStart: "in-memory",
  });
  let failed: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failed = e instanceof Error ? e : new Error(String(e))),
  });
  encoder.configure({ codec, width: REEL_W, height: REEL_H, bitrate: 8_000_000, framerate: REEL_FPS });

  const frames = Math.round(duration * REEL_FPS);
  const step = 1_000_000 / REEL_FPS;
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException("Stopped", "AbortError");
    }
    if (failed) throw failed;
    draw(ctx, i / REEL_FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
    encoder.encode(frame, { keyFrame: i % (REEL_FPS * 2) === 0 });
    frame.close();
    // keep the encoder's queue short and the page responsive
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2));
    if (i % 10 === 0) {
      onProgress?.(i / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  encoder.close();
  if (failed) throw failed;
  muxer.finalize();
  onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

/** High profile when the browser supports it at 1080 × 1920, else Main, else Baseline. */
async function pickCodec(): Promise<string> {
  for (const codec of ["avc1.640032", "avc1.640028", "avc1.4d0032", "avc1.42003e"]) {
    const { supported } = await VideoEncoder.isConfigSupported({ codec, width: REEL_W, height: REEL_H, bitrate: 8_000_000, framerate: REEL_FPS });
    if (supported) return codec;
  }
  throw new Error("This browser can't encode H.264 video at 1080 × 1920.");
}
