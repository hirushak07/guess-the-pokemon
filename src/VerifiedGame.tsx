import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { PixelSprite } from './PixelSprite';
import { TimerBar } from './TimerBar';
import { normalizeGuess, POKEMON } from './pokemon';
import { GAME_MAX_POINTS, ROUND_COUNT, ROUND_SECONDS } from './scoring';
import { playSound } from './sound';
import { SpawnEffect } from './SpawnEffect';

type Mode = 'regular' | 'hard';
type Outcome = 'correct' | 'incorrect' | 'skipped' | 'timeout';
type Action = 'start' | 'open' | 'guess' | 'skip' | 'next' | 'status';
type Request = { p_action: Action; p_mode?: Mode; p_run_id?: string; p_round?: number; p_guess?: string };
type RoundResult = { round: number; answer: string; outcome: Outcome; points: number };
type Snapshot = {
  runId: string;
  mode: Mode;
  round: number;
  spriteId: number | null;
  choices: number[] | null;
  deadline: string | null;
  serverTime: string;
  outcome: Outcome | null;
  roundPoints: number | null;
  answer: string | null;
  feedback: 'try_again' | null;
  score: number;
  correctCount: number;
  completed: boolean;
  results: RoundResult[] | null;
};

const noop = () => {};

const labels: Record<Outcome, string> = {
  correct: '★ CORRECT ANSWER!', incorrect: '✕ INCORRECT ANSWER',
  skipped: '↪ ROUND SKIPPED', timeout: '◷ TIME UP',
};

export function VerifiedGame({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const supabase = useSupabase();
  const [game, setGame] = useState<Snapshot | null>(null);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [guess, setGuess] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Request | null>(null);
  const [showResults, setShowResults] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const deadline = useRef(0);
  // The server sets each deadline 1.6 s past the 10 s answer window; that extra time is the Poké Ball intro.
  const introEnds = useRef(0);
  const [intro, setIntro] = useState(false);
  const lastTick = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLDivElement>(null);

  const send = useCallback(async (request: Request) => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    setFailed(null);
    try {
      const { data, error } = await supabase.rpc('play_verified_game', request).abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      if (error || !data) throw error ?? new Error('Missing round state');
      const next = data as Snapshot;
      const remaining = next.deadline
        ? Math.max(0, Date.parse(next.deadline) - Date.parse(next.serverTime)) : ROUND_SECONDS * 1000;
      const introMs = next.deadline && !next.outcome ? Math.max(0, remaining - ROUND_SECONDS * 1000) : 0;
      const now = performance.now();
      deadline.current = now + remaining;
      introEnds.current = now + introMs;
      setIntro(introMs > 0);
      setSeconds(Math.min(ROUND_SECONDS, remaining / 1000));
      setGame(next);
      if (request.p_action !== 'open') setGuess('');
      setNotice(next.feedback === 'try_again' ? 'Not quite! Try again.' : '');
      if (next.feedback) playSound('incorrect');
      if (next.outcome && request.p_action !== 'start') {
        playSound(next.outcome === 'skipped' ? 'skip' : next.outcome);
      }
    } catch {
      if (!controller.signal.aborted) setFailed(request);
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    void send({ p_action: 'start', p_mode: mode });
    return () => {
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [mode, send]);

  const runId = game?.runId;
  const round = game?.round;
  const playing = Boolean(game?.deadline && !game.outcome);
  const answering = playing && !intro;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setSeconds(Math.min(ROUND_SECONDS, Math.max(0, (deadline.current - now) / 1000)));
      if (now >= introEnds.current) setIntro(false);
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => { lastTick.current = 0; }, [round]);
  useEffect(() => {
    if (!answering || seconds <= 0) return;
    const tick = Math.ceil(seconds);
    if (tick <= 3 && tick !== lastTick.current) { playSound('tick'); lastTick.current = tick; }
  }, [answering, seconds]);

  useEffect(() => {
    if (playing && seconds <= 0 && !busy && !failed) {
      void send({ p_action: 'status', p_run_id: runId, p_round: round });
    }
  }, [playing, seconds, busy, failed, runId, round, send]);

  useEffect(() => {
    if (round && window.matchMedia('(max-width: 560px)').matches) status.current?.scrollIntoView();
  }, [round]);

  useEffect(() => {
    const viewport = window.visualViewport;
    function keepInputVisible() {
      if (viewport && input.current && document.activeElement === input.current) {
        const bottom = input.current.getBoundingClientRect().bottom + 12;
        const visibleBottom = viewport.offsetTop + viewport.height;
        if (bottom > visibleBottom) window.scrollBy(0, bottom - visibleBottom);
      }
    }
    viewport?.addEventListener('resize', keepInputVisible);
    return () => viewport?.removeEventListener('resize', keepInputVisible);
  }, []);

  function act(action: Action, value?: string) {
    if (!game || failed) return;
    void send({ p_action: action, p_run_id: game.runId, p_round: game.round, p_guess: value });
  }

  const disabled = busy || Boolean(failed) || seconds <= 0;
  const typed = normalizeGuess(guess);
  const suggestions = typed ? POKEMON.filter(p => normalizeGuess(p.name).startsWith(typed)).slice(0, 5) : [];

  if (game?.completed && showResults) return <div className="panel end-panel">
    <div className="eyebrow">✦ VERIFIED RESULT SAVED ✦</div>
    <h2>{game.mode.toUpperCase()} RESULTS</h2>
    <div className="final-score">{game.score.toLocaleString()}<span> / {GAME_MAX_POINTS.toLocaleString()} POINTS</span></div>
    <p>{game.correctCount} OF {ROUND_COUNT} CORRECT</p>
    <div className="result-list">{game.results?.map(result => <div key={result.round}>
      <span>ROUND {result.round}</span><strong>{result.answer}</strong><b>+{result.points.toLocaleString()}</b>
    </div>)}</div>
    <button className="primary" onClick={onExit}>⇦ RETURN TO GAME MENU</button>
  </div>;

  return <>
    {game && <>
      <div className="status" ref={status}><span>{game.mode.toUpperCase()} · ROUND <b>{game.round}</b> / {ROUND_COUNT}</span><span>★ SCORE <b>{game.score.toLocaleString()}</b></span></div>
      <div className="scene">
        <div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/>
        {game.spriteId && <div className={`sprite-wrap ${intro ? 'sprite-emerging' : ''}`}><PixelSprite key={game.round} id={game.spriteId} reveal={1 - seconds / ROUND_SECONDS} clear={Boolean(game.outcome)}/></div>}
        {intro && <SpawnEffect ready onComplete={noop}/>}
        <div className="scene-caption">{game.answer ? `IT'S ${game.answer.toUpperCase()}!` : intro ? 'A WILD MYSTERY APPEARS!' : playing ? 'WHO COULD IT BE?' : 'READY WHEN YOU ARE'}</div>
      </div>
    </>}
    <div className="panel">
      {!game && !failed && <p role="status">CONNECTING TO VERIFIED PLAY…</p>}
      {game && !game.outcome && <>
        <TimerBar seconds={seconds} duration={ROUND_SECONDS} waiting={!answering}/>
        {!playing && <button className="primary typing-start" disabled={disabled} onClick={() => {
          input.current?.focus();
          act('open');
        }}>{game.mode === 'hard' ? 'TAP TO TYPE & START TIMER' : 'START ROUND ▶'}</button>}
        {game.mode === 'regular' && intro && <div className="spawn-panel"><span role="status">GET READY, TRAINER!</span></div>}
        {game.mode === 'regular' && answering && <div className="choice-grid" role="group" aria-label="Choose the Pokémon">
          {game.choices?.map((id, i) => <button key={id} type="button" disabled={disabled} className={`choice choice-${i}`} onClick={() => act('guess', String(id))}>
            <span className="choice-symbol" aria-hidden="true">{['◆','▲','●','■'][i]}</span><span>{POKEMON.find(p => p.id === id)?.name}</span>
          </button>)}
        </div>}
        {game.mode === 'hard' && <form className="guess-form verified-guess" onSubmit={event => {
          event.preventDefault();
          if (answering && !disabled && typed) act('guess', guess);
        }}>
          <label htmlFor="verified-guess">YOUR GUESS</label>
          <div className="input-row">
            <input id="verified-guess" ref={input} value={guess} onChange={event => setGuess(event.target.value)} maxLength={100}
              autoComplete="off" autoCapitalize="none" autoCorrect="off" enterKeyHint="go" spellCheck={false} placeholder="Type Pokémon name…"/>
            <button className="primary" disabled={!answering || disabled || !typed} onPointerDown={e => e.preventDefault()}>GUESS ▶</button>
          </div>
          {answering && suggestions.length > 0 && <div className="suggestions">{suggestions.map(p => <button key={p.id} type="button" disabled={disabled} onPointerDown={e => e.preventDefault()} onClick={() => act('guess', p.name)}>{p.name}</button>)}</div>}
        </form>}
        {answering && <div className="footnote"><span role="status">{notice}</span><button className="skip" disabled={disabled} onClick={() => act('skip')}>SKIP →</button></div>}
      </>}
      {game?.outcome && <div className="reveal-panel">
        <div className="micro">{labels[game.outcome]}</div>
        <h2>{game.answer}</h2><p>+{game.roundPoints?.toLocaleString()} POINTS</p>
        <button className="primary" disabled={busy || Boolean(failed)} onClick={() => {
          if (!game.completed) { act('next'); return; }
          playSound('complete');
          setShowResults(true);
        }}>
          {game.completed ? 'VIEW RESULTS ▶' : 'NEXT ROUND ▶'}
        </button>
      </div>}
      {failed && <div role="alert">
        <p>Couldn’t reach verified play. Retry to check the server’s current result.</p>
        <button className="primary" onClick={() => void send(failed)}>RETRY</button>
      </div>}
      <button className="return-button" onClick={onExit}>⇦ RETURN TO GAME MENU</button>
    </div>
  </>;
}
