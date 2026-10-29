import { useEffect, useState } from 'react';
import { spriteUrl, fallbackSpriteUrl, staticSpriteUrl } from './pokemon';

type Props = { id: number; reveal: number; clear?: boolean };

const DISPLAY_SIZE = 220;
const MIN_RESOLUTION = 20;

/**
 * Keep the GIF in a real <img> element so the browser can play it natively.
 *
 * A GIF drawn to canvas is not a dependable animation source: the browser may
 * expose only its first frame to drawImage(). Instead, render the <img> at a
 * low CSS resolution, then enlarge it with nearest-neighbor scaling.
 *
 * Crucially, changing reveal does NOT recreate the image or change its src,
 * so the animation clock keeps running throughout the round.
 */
export function PixelSprite({ id, reveal, clear = false }: Props) {
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [id]);

  const candidates = [spriteUrl(id), fallbackSpriteUrl(id), staticSpriteUrl(id)];
  const amount = clear ? 1 : Math.min(1, Math.max(0, reveal));
  const resolution = Math.round(
    MIN_RESOLUTION + Math.pow(amount, 1.6) * (DISPLAY_SIZE - MIN_RESOLUTION)
  );
  const scale = DISPLAY_SIZE / resolution;
  // Strong blur initially, easing out as the timer advances.
  // CSS filters preserve native GIF playback (unlike Canvas frame capture).
  const blurPx = clear ? 0 : 15 * Math.pow(1 - amount, 1.5);

  return (
    <div
      className="pokemon-sprite-stage"
      style={{
        width: DISPLAY_SIZE,
        height: DISPLAY_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      <img
        key={id}
        src={candidates[sourceIndex]}
        alt={clear ? 'Revealed Pokémon' : 'Mystery Pokémon'}
        draggable={false}
        onError={() => setSourceIndex(i => Math.min(i + 1, candidates.length - 1))}
        style={{
          width: resolution,
          height: resolution,
          flexShrink: 0,
          maxWidth: 'none',
          objectFit: 'contain',
          imageRendering: 'pixelated',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          filter: `blur(${blurPx.toFixed(2)}px) drop-shadow(0px 5px 1px #3c5d6040)`,
        }}
      />
    </div>
  );
}
