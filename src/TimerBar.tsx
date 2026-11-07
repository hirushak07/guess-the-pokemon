import { pointsForTime } from './scoring';

export function TimerBar({ seconds, duration, waiting }: { seconds: number; duration: number; waiting: boolean }) {
  const remaining = Math.max(0, Math.min(1, seconds / duration));
  const points = pointsForTime(seconds);
  const urgency = remaining > .5 ? 'normal' : remaining > .3 ? 'warning' : 'critical';
  return <div className={`round-timer timer-${urgency}`}>
    <div className="timer-heading">
      <span>{waiting ? 'GET READY' : `${Math.ceil(seconds)}s LEFT`}</span>
      <span className="timer-points"><b>{points.toLocaleString()}</b> PTS IF CORRECT</span>
    </div>
    <div className="hp-frame">
      <span className="hp-label" aria-hidden="true">HP</span>
      <div className="hp-track" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.ceil(seconds)}>
        <div className="hp-fill" style={{ transform: `scaleX(${remaining})` }}/>
      </div>
    </div>
  </div>;
}
