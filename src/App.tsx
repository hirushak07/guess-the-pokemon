import { VerifiedGame } from './VerifiedGame';
import { PlayerProfile } from './PlayerProfile';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { TimerBar } from './TimerBar';
import { GAME_MAX_POINTS, pointsForTime, ROUND_COUNT, ROUND_MAX_POINTS, ROUND_SECONDS } from './scoring';
import { SpawnEffect } from './SpawnEffect';
import { playSound, setSoundEnabled, stopSounds, unlockSound, setMusicEnabled, setMusicActive, stopAllAudio, handleAudioVisibility } from './sound';
import { PixelSprite } from './PixelSprite';
import { POKEMON, pickRounds, pickOptions, normalizeGuess, type Pokemon } from './pokemon';

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/react';

type Mode = 'regular' | 'hard';
type Stage = 'home' | 'spawning' | 'ready' | 'playing' | 'reveal' | 'finished';
type RoundResult = 'correct' | 'incorrect' | 'skip' | 'timeout';
type Outcome = { pokemon: Pokemon; result: RoundResult; points: number };
const resultLabels: Record<RoundResult, string> = {
  correct: '★ CORRECT ANSWER!', incorrect: '✕ INCORRECT ANSWER',
  skip: '↪ ROUND SKIPPED', timeout: '◷ TIME UP',
};

function App() {
  const { user, isSignedIn } = useUser();
  const [verifiedPlayer, setVerifiedPlayer] = useState<string | null>(null);
  const verified = Boolean(isSignedIn && user && verifiedPlayer === user.id);
  useEffect(() => {
    if (!isSignedIn || verifiedPlayer !== user?.id) setVerifiedPlayer(null);
  }, [isSignedIn, user?.id, verifiedPlayer]);
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem('pokepixel-sound') !== 'off'; } catch { return true; }
  });
  const [music, setMusic] = useState(() => {
    try { return localStorage.getItem('pokepixel-music') !== 'off'; } catch { return true; }
  });
  useEffect(() => {
    setMusicEnabled(music);
    try { localStorage.setItem('pokepixel-music', music ? 'on' : 'off'); } catch { /* Optional storage. */ }
  }, [music]);
  const [spriteReady, setSpriteReady] = useState(false);
  const [audioReady, setAudioReady] = useState(true);
  const encounterReady = spriteReady && audioReady;
  const onSpriteReady = useCallback(() => setSpriteReady(true), []);
  useEffect(() => {
    setSoundEnabled(sound);
    try { localStorage.setItem('pokepixel-sound', sound ? 'on' : 'off'); } catch { /* Storage may be blocked. */ }
  }, [sound]);
  useEffect(() => {
    setMusicActive(true);
    document.addEventListener('click', unlockSound);
    document.addEventListener('keydown', unlockSound);
    document.addEventListener('visibilitychange', handleAudioVisibility);
    return () => {
      document.removeEventListener('click', unlockSound);
      document.removeEventListener('keydown', unlockSound);
      document.removeEventListener('visibilitychange', handleAudioVisibility);
      stopAllAudio();
    };
  }, []);
  const [mode, setMode] = useState<Mode>('regular');
  const [choices, setChoices] = useState<Pokemon[][]>([]);
  const [stage, setStage] = useState<Stage>('home');
  const lastTick = useRef(0);
  const deadline = useRef(0);
  const touchInput = useRef(false);
  const gameStatus = useRef<HTMLDivElement>(null);
  const [rounds, setRounds] = useState<Pokemon[]>([]);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [guess, setGuess] = useState('');
  const [results, setResults] = useState<Outcome[]>([]);
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const resolved = useRef(false);
  const current = rounds[index];
  const latest = results.at(-1);
  const correctCount = results.filter(round => round.result === 'correct').length;
  const score = results.reduce((sum, x) => sum + x.points, 0);
  const progress = 1 - seconds / ROUND_SECONDS;
  const suggestions = useMemo(() => {
    const typed = normalizeGuess(guess);
    if (!typed) return [];
    return POKEMON.filter(p => normalizeGuess(p.name).startsWith(typed)).slice(0, 5);
  }, [guess]);

  const beginRound = useCallback(() => {
    deadline.current = performance.now() + ROUND_SECONDS * 1000;
    setStage('playing');
  }, []);

  const completeSpawn = useCallback(() => {
    if (touchInput.current) setStage('ready');
    else beginRound();
  }, [beginRound]);

  function startTyping() {
    // Commit the input inside the tap so mobile Safari can open its keyboard.
    flushSync(beginRound);
    input.current?.focus();
  }

  function timeLeft() {
    return Math.max(0, (deadline.current - performance.now()) / 1000);
  }

  function start() {
    if (isSignedIn && user) {
      unlockSound();
      setStage('home');
      setVerifiedPlayer(user.id);
      return;
    }
    setAudioReady(false);
    // Give the first throw a chance to decode, without letting failed audio
    // stall the game. Later rounds reuse the decoded buffers.
    void Promise.race([unlockSound(), new Promise<void>(resolve => window.setTimeout(resolve, 500))])
      .then(() => setAudioReady(true));
    stopSounds();
    setSpriteReady(false);
    touchInput.current = mode === 'hard' && window.matchMedia('(pointer: coarse)').matches;
    const selected = pickRounds(ROUND_COUNT);
    setRounds(selected);
    setChoices(selected.map(answer => {
      const distractors = pickOptions(answer, POKEMON);
      return [...distractors, answer].sort(() => Math.random() - 0.5);
    }));
    setResults([]); setIndex(0); setSeconds(ROUND_SECONDS);
    setGuess(''); setNotice(''); resolved.current = false; setStage('spawning');
  }

  function finishRound(result: RoundResult) {
    if (stage !== 'playing' || resolved.current || !current) return;
    resolved.current = true;
    const remaining = timeLeft();
    const outcome = remaining > 0 ? result : 'timeout';
    playSound(outcome);
    const points = outcome === 'correct' ? pointsForTime(remaining) : 0;
    setSeconds(remaining);
    setResults(old => [...old, { pokemon: current, result: outcome, points }]);
    setStage('reveal');
  }

  function submit(value = guess) {
    if (stage !== 'playing' || mode !== 'hard' || resolved.current) return;
    if (timeLeft() <= 0) { finishRound('timeout'); return; }
    const normalized = normalizeGuess(value);
    if (!normalized) return;
    if (normalized === normalizeGuess(current.name)) { finishRound('correct'); return; }
    playSound('incorrect');
    setNotice('Not quite! Try again.');
    setGuess('');
    input.current?.focus();
  }

  function choose(id: number) {
    finishRound(id === current.id ? 'correct' : 'incorrect');
  }

  function next() {
    unlockSound();
    if (index === rounds.length - 1) { playSound('complete'); setStage('finished'); return; }
    setSpriteReady(false);
    resolved.current = false;
    setIndex(old => old + 1); setSeconds(ROUND_SECONDS);
    setGuess(''); setNotice(''); setStage('spawning');
  }

  useEffect(() => {
    if (stage === 'spawning' && window.matchMedia('(max-width: 560px)').matches) {
      gameStatus.current?.scrollIntoView({ block: 'start' });
    }
    if (stage !== 'playing') return;
    if (!touchInput.current) input.current?.focus();
    lastTick.current = 0;
    const interval = window.setInterval(() => setSeconds(timeLeft()), 50);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'playing' || !touchInput.current) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    function keepInputVisible() {
      const field = input.current;
      if (!viewport || !field || document.activeElement !== field) return;
      const bounds = field.getBoundingClientRect();
      const top = viewport.offsetTop;
      const bottom = top + viewport.height;
      if (bounds.top < top || bounds.bottom + 12 > bottom) {
        window.scrollBy(0, bounds.top < top ? bounds.top - top - 12 : bounds.bottom + 12 - bottom);
      }
    }

    viewport.addEventListener('resize', keepInputVisible);
    return () => viewport.removeEventListener('resize', keepInputVisible);
  }, [stage]);

  useEffect(() => {
    if (stage === 'playing' && seconds <= 0) finishRound('timeout');
  });

  useEffect(() => {
    if (stage !== 'playing' || seconds <= 0) return;
    const tick = Math.ceil(seconds);
    if (tick <= 3 && tick !== lastTick.current) { playSound('tick'); lastTick.current = tick; }
  }, [stage, seconds]);

  return <div className="site">
    <div className="stars" aria-hidden="true"/>
    
    <header className="topbar">
      <span className="brand-dot" />
      <span>POKÉPIXEL</span>
      
      <div className="auth-controls">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button">LOG IN</button>
          </SignInButton>

          <SignUpButton mode="modal">
            <button type="button">SIGN UP</button>
          </SignUpButton>
        </Show>

        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>

    </header>

    <PlayerProfile />

    <main className="layout">
      <section className="heading">
        <div className="eyebrow">✦ THE ULTIMATE TRAINER TEST ✦</div>
        <h1>WHO'S THAT<br/><span>POKÉMON?</span></h1>
        <p>FIVE MYSTERIES. ONE TRAINER. HOW FAST CAN YOU GUESS?</p>
      </section>
      <section className="game-shell">
        <div className="shell-head"><div>◈ POKÉPIXEL <span> / ARCADE</span></div><div className="audio-controls"><button className="sound-toggle" aria-pressed={sound} aria-label="Sound effects" onClick={() => { const value = !sound; setSoundEnabled(value); if (value) unlockSound(); setSound(value); }}>SOUND {sound ? 'ON ♪' : 'OFF'}</button><button className="sound-toggle" aria-pressed={music} aria-label="Music" onClick={() => { const value = !music; setMusicEnabled(value); if (value) unlockSound(); setMusic(value); }}>MUSIC {music ? 'ON ♫' : 'OFF'}</button></div></div>
        {verified && <VerifiedGame key={verifiedPlayer} mode={mode} onExit={() => setVerifiedPlayer(null)}/>}
        {!verified && stage === 'home' && <div className="home-screen">
          <div className="scene home-scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className="question">?</div><div className="scene-caption">A NEW CHALLENGE AWAITS...</div></div>
          <div className="panel home-panel"><div className="micro">READY, TRAINER?</div><h2>TEST YOUR POKÉMON KNOWLEDGE!</h2><p>GUESS {ROUND_COUNT} RANDOM POKÉMON AS THEIR SPRITES COME INTO FOCUS. CORRECT GUESSES EARN UP TO {ROUND_MAX_POINTS.toLocaleString()} POINTS. GUESS FASTER TO SCORE MORE!</p><div className="features"><span>◷ {ROUND_SECONDS} SEC / ROUND</span><span>★ {GAME_MAX_POINTS.toLocaleString()} MAX POINTS</span><span>◈ GEN 5 ANIMATIONS</span></div><div className="mode-picker" role="group" aria-label="Choose a game mode"><button className={mode === 'regular' ? 'mode-option selected' : 'mode-option'} onClick={() => { unlockSound(); playSound('select'); setMode('regular'); }} aria-pressed={mode === 'regular'}><strong>⚡ REGULAR</strong><span>4 CHOICES · KAHOOT STYLE</span></button><button className={mode === 'hard' ? 'mode-option selected' : 'mode-option'} onClick={() => { unlockSound(); playSound('select'); setMode('hard'); }} aria-pressed={mode === 'hard'}><strong>★ HARD</strong><span>TYPE THE NAME YOURSELF</span></button></div><button className="primary" onClick={start}>▶ START {mode.toUpperCase()} CHALLENGE</button></div>
        </div>}
        {(stage === 'spawning' || stage === 'ready' || stage === 'playing' || stage === 'reveal') && current && <>
          <div className="status" ref={gameStatus}><span>{mode.toUpperCase()} · ROUND <b>{String(index+1).padStart(2,'0')}</b> / {String(ROUND_COUNT).padStart(2,'0')}</span><span>★ SCORE <b>{score.toLocaleString()}</b></span><span>◷ <b className={seconds < 5 && stage === 'playing'?'danger':''}>{Math.ceil(seconds).toString().padStart(2,'0')}s</b></span></div>
          <div className="scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className={`sprite-wrap ${stage === 'spawning' && !touchInput.current ? (encounterReady ? 'sprite-emerging' : 'sprite-waiting') : (stage === 'ready' || stage === 'spawning') ? 'sprite-waiting' : ''}`}><PixelSprite key={current.id} id={current.id} reveal={progress} clear={stage === 'reveal'} onReady={onSpriteReady}/></div>{stage === 'spawning' && <SpawnEffect ready={encounterReady} onComplete={completeSpawn}/>} <div className="scene-caption">{stage === 'reveal' ? `IT'S ${current.name.toUpperCase()}!` : stage === 'spawning' ? (encounterReady ? 'A WILD MYSTERY APPEARS!' : 'PREPARING YOUR ENCOUNTER...') : stage === 'ready' ? 'READY WHEN YOU ARE' : 'WHO COULD IT BE?'}</div></div>
          <div className="panel">
            {stage !== 'reveal' && <TimerBar seconds={seconds} duration={ROUND_SECONDS} waiting={stage !== 'playing'}/>}
            {stage === 'spawning' ? <div className="spawn-panel"><span role="status">{encounterReady ? 'GET READY, TRAINER!' : 'LOADING POKÉMON...'}</span><button className="skip" disabled={!encounterReady} onClick={() => { stopSounds(); completeSpawn(); }}>SKIP INTRO →</button></div> : stage === 'ready' ? <button className="primary typing-start" onClick={startTyping}>TAP TO TYPE &amp; START TIMER</button> : stage === 'playing' ? <>
              {mode === 'regular' ? <div className="choice-grid" role="group" aria-label="Choose the Pokémon">
                {(choices[index] ?? []).map((option, i) => <button key={option.id} type="button" className={`choice choice-${i}`} onClick={() => choose(option.id)}><span className="choice-symbol">{['◆','▲','●','■'][i]}</span><span>{option.name}</span></button>)}
              </div> : <>
                <form onSubmit={e=>{e.preventDefault();submit();}} className="guess-form"><label htmlFor="guess">YOUR GUESS</label><div className="input-row"><input ref={input} id="guess" autoComplete="off" autoCapitalize="none" autoCorrect="off" enterKeyHint="go" spellCheck={false} placeholder="Type Pokémon name..." value={guess} onChange={e=>{setGuess(e.target.value);setNotice('')}}/><button type="submit" className="primary" onPointerDown={e => e.preventDefault()}>GUESS ▶</button></div></form>
                {suggestions.length>0 && <div className="suggestions">{suggestions.map(p=><button key={p.id} onPointerDown={e => e.preventDefault()} onClick={()=>submit(p.name)}>{p.name}</button>)}</div>}
              </>}
              <div className="footnote"><span role="status">{notice || (mode === 'regular' ? 'ONE PICK PER ROUND — CHOOSE CAREFULLY!' : 'TIP: GUESS EARLY FOR MORE POINTS!')}</span><button className="skip" onClick={()=>finishRound('skip')}>SKIP →</button></div>
            </> : <div className="reveal-panel"><div className="micro">{latest && resultLabels[latest.result]}</div><h2>{current.name.toUpperCase()}</h2><p>{latest?.result === 'correct' ? `+${latest.points.toLocaleString()} POINT${latest.points === 1 ? '' : 'S'}`:'NO POINTS THIS ROUND. YOU’VE GOT THE NEXT ONE!'}</p><button className="primary" onClick={next}>{index === ROUND_COUNT - 1?'VIEW RESULTS ▶':'NEXT ROUND ▶'}</button></div>}
          </div>
        </>}
        {stage === 'finished' && <div className="panel end-panel"><div className="eyebrow">✦ CHALLENGE COMPLETE ✦</div><div className="trophy">★</div><h2>{mode.toUpperCase()} RESULTS</h2><div className="final-score">{score.toLocaleString()}<span> / {GAME_MAX_POINTS.toLocaleString()} POINTS</span></div><p>{correctCount} OF {ROUND_COUNT} CORRECT</p><div className="result-list">{results.map((r,i)=><div key={i}><span>ROUND {i+1}</span><strong>{r.pokemon.name}</strong><b className={r.result === 'correct' ? 'good' : 'bad'}>+{r.points.toLocaleString()}</b></div>)}</div><button className="primary" onClick={start}>↻ PLAY AGAIN</button><button className="return-button" onClick={()=>setStage('home')}>⇦ CHANGE MODE</button></div>}
        <div className="shell-foot">© FAN-MADE GAME <span>POWERED BY POKÉAPI SPRITES</span></div>
      </section>
      <div className="below">NO ACCOUNT NEEDED · 5 RANDOM ROUNDS · PLAY AGAIN INSTANTLY</div>
    </main>
  </div>;
}
export default App;
