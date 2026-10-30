import { useEffect } from 'react';
import { playSound, stopSounds } from './sound';

export const SPAWN_DURATION = 1400;

export function SpawnEffect({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const landing = window.setTimeout(() => playSound('land'), 260);
    const release = window.setTimeout(() => playSound('release'), 560);
    const finish = window.setTimeout(onComplete, reduced ? 100 : SPAWN_DURATION);
    return () => {
      clearTimeout(landing);
      clearTimeout(release);
      clearTimeout(finish);
      stopSounds();
    };
  }, [ready, onComplete]);

  return <div className={`spawn-effect ${ready ? 'spawn-running' : ''}`} aria-hidden="true">
    <div className="spawn-ball"><div className="ball-top"/><div className="ball-bottom"/><div className="ball-button"/></div>
    <div className="spawn-flash"/><div className="spawn-ring"/>
    {Array.from({ length: 8 }, (_, i) => <i className="spawn-spark" key={i} style={{ rotate: `${i * 45}deg` }}/>) }
  </div>;
}
