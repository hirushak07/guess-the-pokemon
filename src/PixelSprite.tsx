import { useEffect, useRef, useState } from 'react';
import { decompressFrames, parseGIF } from 'gifuct-js';
import { spriteUrl, fallbackSpriteUrl, staticSpriteUrl } from './pokemon';

type Props = { id: number; reveal: number; clear?: boolean; onReady?: () => void };
type AnimationFrame = { canvas: HTMLCanvasElement; duration: number };

const DISPLAY_SIZE = 220;
// Number of virtual pixels across the sprite at the START of a round.
// At 12, a 220px sprite has roughly 18px-wide blocks.
const MIN_RESOLUTION = 8;
// Larger values keep pixels chunkier until later in the round.
const PIXEL_REVEAL_POWER = 2.2;
const MAX_RESOLUTION = 220;

function decodeFrames(buffer: ArrayBuffer): AnimationFrame[] {
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  if (!width || !height || !frames.length) throw new Error('Empty GIF');

  // GIF frame patches must be composited; many frames only update a small area.
  const composed = document.createElement('canvas');
  composed.width = width;
  composed.height = height;
  const ctx = composed.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  let previous: typeof frames[number] | undefined;
  let restoreSnapshot: ImageData | undefined;
  const animation: AnimationFrame[] = [];

  for (const frame of frames) {
    // Apply the previous frame's disposal BEFORE drawing the current patch.
    if (previous?.disposalType === 2) {
      const d = previous.dims;
      ctx.clearRect(d.left, d.top, d.width, d.height);
    } else if (previous?.disposalType === 3 && restoreSnapshot) {
      ctx.putImageData(restoreSnapshot, 0, 0);
    }

    // Disposal 3 means restore the canvas to its state BEFORE this frame.
    restoreSnapshot = frame.disposalType === 3
      ? ctx.getImageData(0, 0, width, height)
      : undefined;

    const { left, top, width: patchWidth, height: patchHeight } = frame.dims;
    const patch = document.createElement('canvas');
    patch.width = patchWidth;
    patch.height = patchHeight;
    const patchCtx = patch.getContext('2d');
    if (!patchCtx) throw new Error('Canvas not supported');
    patchCtx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), patchWidth, patchHeight), 0, 0);
    // drawImage blends transparent pixels; putImageData directly would erase
    // unchanged parts of the previous frame.
    ctx.drawImage(patch, left, top);

    const snapshot = document.createElement('canvas');
    snapshot.width = width;
    snapshot.height = height;
    snapshot.getContext('2d')!.drawImage(composed, 0, 0);

    animation.push({
      canvas: snapshot,
      // GIF delays are in milliseconds. Avoid spinning on zero-delay frames.
      duration: Math.max(40, frame.delay || 100),
    });
    previous = frame;
  }
  return animation;
}

/**
 * True animated GIF pixelation:
 * decode the individual GIF frames, then downsample each frame into a tiny
 * canvas and enlarge it with nearest-neighbor sampling (hard square blocks).
 * This avoids the soft smudge produced by CSS blur/transform tricks.
 */
export function PixelSprite({ id, reveal, clear = false, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const revealRef = useRef(reveal);
  const clearRef = useRef(clear);
  const [loadFailed, setLoadFailed] = useState(false);
  revealRef.current = reveal;
  clearRef.current = clear;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let raf = 0;
    let animation: AnimationFrame[] = [];
    let currentFrame = 0;
    let frameDeadline = 0;

    const output = canvasRef.current;
    const outputCtx = output?.getContext('2d');
    const small = document.createElement('canvas');
    const smallCtx = small.getContext('2d');
    setLoadFailed(false);

    function draw() {
      if (!output || !outputCtx || !smallCtx || !animation.length) return;
      const amount = clearRef.current ? 1 : Math.min(1, Math.max(0, revealRef.current));
      const resolution = Math.round(
        MIN_RESOLUTION + Math.pow(amount, PIXEL_REVEAL_POWER) *
          (MAX_RESOLUTION - MIN_RESOLUTION)
      );
      if (small.width !== resolution || small.height !== resolution) {
        small.width = resolution;
        small.height = resolution;
      }
      smallCtx.clearRect(0, 0, resolution, resolution);
      // Use averaging for downsampling; use NEAREST NEIGHBOR for enlargement.
      smallCtx.imageSmoothingEnabled = true;
      smallCtx.drawImage(animation[currentFrame].canvas, 0, 0, resolution, resolution);
      outputCtx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
      outputCtx.imageSmoothingEnabled = false;
      outputCtx.drawImage(small, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    }

    function tick(now: number) {
      if (cancelled) return;
      if (animation.length) {
        if (frameDeadline === 0) frameDeadline = now + animation[0].duration;
        // Advance frames based on each GIF frame's own delay.
        let steps = 0;
        while (now >= frameDeadline && steps < animation.length) {
          currentFrame = (currentFrame + 1) % animation.length;
          frameDeadline += animation[currentFrame].duration;
          steps++;
        }
        // Avoid long catch-up loops when returning to a background tab.
        if (now - frameDeadline > 1000) frameDeadline = now + animation[currentFrame].duration;
        draw();
      }
      raf = requestAnimationFrame(tick);
    }

    async function load() {
      for (const url of [spriteUrl(id), fallbackSpriteUrl(id)]) {
        if (cancelled) return;
        try {
          const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
          if (!response.ok) throw new Error(`Sprite HTTP ${response.status}`);
          const decoded = decodeFrames(await response.arrayBuffer());
          if (cancelled) return;
          animation = decoded;
          currentFrame = 0;
          frameDeadline = 0;
          draw();
          readyRef.current?.();
          raf = requestAnimationFrame(tick);
          return;
        } catch (error) {
          if (cancelled || controller.signal.aborted) return;
          console.warn('Could not decode animated sprite:', url, error);
        }
      }
      // Keep the PNG fallback pixelated too; never expose a clear answer early.
      try {
        const response = await fetch(staticSpriteUrl(id), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error('Static sprite unavailable');
        const bitmap = await createImageBitmap(await response.blob());
        if (cancelled) { bitmap.close(); return; }
        const frame = document.createElement('canvas');
        frame.width = bitmap.width;
        frame.height = bitmap.height;
        frame.getContext('2d')!.drawImage(bitmap, 0, 0);
        bitmap.close();
        animation = [{ canvas: frame, duration: 100 }];
        draw();
        readyRef.current?.();
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          readyRef.current?.();
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      cancelAnimationFrame(raf);
    };
  }, [id]);

  return (
    <>
    {loadFailed && <span className="sprite-error" role="status">SPRITE UNAVAILABLE<br/>TRY SKIPPING THIS ROUND</span>}
    <canvas
      hidden={loadFailed}
      ref={canvasRef}
      width={DISPLAY_SIZE}
      height={DISPLAY_SIZE}
      className="pokemon-canvas"
      role="img"
      aria-label={clear ? 'Revealed Pokémon' : 'Pixelated mystery Pokémon'}
    />
    </>
  );
}
