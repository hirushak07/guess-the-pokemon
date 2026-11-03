import { useEffect } from 'react';
import { playSound, stopSounds } from './sound';

export const SPAWN_DURATION = 1600;

export function SpawnEffect({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let completed = false;
    // Throw leads the visuals by 200ms; its full tail ends before the pop.
    const throwing = window.setTimeout(() => playSound('throw'), 0);
    const release = window.setTimeout(() => playSound('release'), reduced ? 40 : 760);
    const finish = window.setTimeout(() => { completed = true; onComplete(); }, reduced ? 100 : SPAWN_DURATION);
    return () => {
      clearTimeout(throwing);
      clearTimeout(release);
      clearTimeout(finish);
      if (!completed) stopSounds();
    };
  }, [ready, onComplete]);

  return <div className={`spawn-effect ${ready ? 'spawn-running' : ''}`} aria-hidden="true">
    <div className="spawn-ball"><div className="ball-top"/><div className="ball-bottom"/><div className="ball-button"/></div>
    <div className="spawn-flash"/><div className="spawn-ring"/>
    {Array.from({ length: 8 }, (_, i) => <i className="spawn-spark" key={i} style={{ rotate: `${i * 45}deg` }}/>) }
  </div>;
}
