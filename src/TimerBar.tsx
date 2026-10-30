export function pointsForTime(seconds: number, duration: number) {
  return seconds > duration * .7 ? 3 : seconds > duration * .35 ? 2 : 1;
}

export function TimerBar({ seconds, duration, waiting }: { seconds: number; duration: number; waiting: boolean }) {
  const remaining = Math.max(0, Math.min(1, seconds / duration));
  const points = pointsForTime(seconds, duration);
  return <div className={`round-timer tier-${points}`}>
    <div className="timer-heading"><span>{waiting ? 'GET READY' : 'TIME LEFT'}</span><span>{Math.ceil(seconds)}s</span></div>
    <div className="hp-frame">
      <span className="hp-label" aria-hidden="true">HP</span>
      <div className="hp-track" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.ceil(seconds)} aria-valuetext={`${Math.ceil(seconds)} seconds remaining; ${points} ${points === 1 ? 'point' : 'points'} available`}>
        <div className="hp-fill" style={{ transform: `scaleX(${remaining})` }}/>
        <div className="hp-dividers" aria-hidden="true"/>
      </div>
    </div>
    <div className="timer-points">{points} {points === 1 ? 'PT.' : 'PTS.'}<span>AVAILABLE</span></div>
  </div>;
}
