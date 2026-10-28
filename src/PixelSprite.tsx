import { useEffect, useRef, useState } from 'react';
import { spriteUrl, fallbackSpriteUrl, staticSpriteUrl } from './pokemon';

type Props = { id: number; reveal: number; clear?: boolean };

/** Offscreen low-resolution sampling makes an animated GIF progressively less pixelated. */
export function PixelSprite({ id, reveal, clear = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const revealRef = useRef(reveal);
  const clearRef = useRef(clear);
  revealRef.current = reveal;
  clearRef.current = clear;
  const src = spriteUrl(id);
  useEffect(() => {
    setFallback(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const candidates = [src, fallbackSpriteUrl(id), staticSpriteUrl(id)];
    let candidate = 0;
    img.onerror = () => {
      if (stopped) return;
      candidate++;
      if (candidate < candidates.length) img.src = candidates[candidate];
      else setFallback(true);
    };
    img.src = candidates[candidate];
    const temp = document.createElement('canvas');
    const tctx = temp.getContext('2d');
    let frame = 0;
    let stopped = false;
    let loaded = false;
    img.onload = () => { loaded = true; };

    const render = () => {
      if (stopped) return;
      const canvas = canvasRef.current;
      if (canvas && loaded) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Reveal 0..1 -> sample from 7px to 160px.
          const amount = clearRef.current ? 1 : Math.min(1, Math.max(0, revealRef.current));
          const resolution = Math.max(7, Math.round(7 + Math.pow(amount, 2.0) * 153));
          temp.width = resolution;
          temp.height = resolution;
          if (tctx) {
            try {
              tctx.clearRect(0, 0, resolution, resolution);
              tctx.imageSmoothingEnabled = true;
              const size = Math.max(img.naturalWidth, img.naturalHeight, 1);
              const scale = 0.91 * resolution / size;
              const width = img.naturalWidth * scale;
              const height = img.naturalHeight * scale;
              tctx.drawImage(img, (resolution - width)/2, (resolution - height)/2, width, height);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(temp, 0, 0, canvas.width, canvas.height);
            } catch {
              setFallback(true);
              stopped = true;
              return;
            }
          }
        }
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { stopped = true; cancelAnimationFrame(frame); img.onload = null; img.onerror = null; };
  }, [src, id]);
  if (fallback) return <img className="sprite-fallback" src={staticSpriteUrl(id)} alt="Mystery Pokémon" style={{filter: clear ? 'none' : `blur(${Math.round((1-reveal)*22)}px)`}}/>;
  return <canvas ref={canvasRef} width={256} height={256} className="pokemon-canvas" aria-label="Mystery Pokémon sprite" role="img"/>;
}
