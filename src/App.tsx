import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimerBar, pointsForTime } from './TimerBar';
import { SpawnEffect } from './SpawnEffect';
import { playSound, setSoundEnabled, stopSounds, unlockSound, setMusicEnabled, setMusicActive, stopAllAudio, handleAudioVisibility } from './sound';
import { PixelSprite } from './PixelSprite';
import { POKEMON, pickRounds, pickOptions, normalizeGuess, type Pokemon } from './pokemon';

const ROUND_SECONDS = 10;
type Mode = 'regular' | 'hard';
type Stage = 'home' | 'spawning' | 'playing' | 'reveal' | 'finished';
type Outcome = { pokemon: Pokemon; correct: boolean; points: number; guess: string };

function App() {
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
  const onSpriteReady = useCallback(() => setSpriteReady(true), []);
  const completeSpawn = useCallback(() => {
    setStage(old => old === 'spawning' ? 'playing' : old);
  }, []);
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
  const lastTier = useRef(3);
  const [rounds, setRounds] = useState<Pokemon[]>([]);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [guess, setGuess] = useState('');
  const [results, setResults] = useState<Outcome[]>([]);
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const resolved = useRef(false);
  const current = rounds[index];
  const score = results.reduce((sum, x) => sum + x.points, 0);
  const progress = 1 - seconds / ROUND_SECONDS;
  const suggestions = useMemo(() => {
    const typed = normalizeGuess(guess);
    if (!typed) return [];
    return POKEMON.filter(p => normalizeGuess(p.name).startsWith(typed)).slice(0, 5);
  }, [guess]);

  function start() {
    unlockSound();
    stopSounds();
    setSpriteReady(false);
    const selected = pickRounds();
    setRounds(selected);
    setChoices(selected.map(answer => {
      const distractors = pickOptions(answer, POKEMON);
      return [...distractors, answer].sort(() => Math.random() - 0.5);
    }));
    setResults([]); setIndex(0); setSeconds(ROUND_SECONDS);
    setGuess(''); setNotice(''); resolved.current = false; setStage('spawning');
  }

  function finishRound(correct: boolean, attempted: string, cue: 'incorrect' | 'skip' | 'timeout' = 'incorrect') {
    if (stage !== 'playing' || resolved.current || !current) return;
    resolved.current = true;
    playSound(correct ? 'correct' : cue);
    const points = correct ? pointsForTime(seconds, ROUND_SECONDS) : 0;
    setResults(old => [...old, {pokemon: current, correct, points, guess: attempted}]);
    setStage('reveal');
  }

  function submit(value = guess) {
    if (stage !== 'playing' || mode !== 'hard') return;
    const normalized = normalizeGuess(value);
    if (!normalized) return;
    if (normalized === normalizeGuess(current.name)) { finishRound(true, value); return; }
    playSound('incorrect');
    setNotice('Not quite! Try again.');
    setGuess('');
    if (mode === 'hard') input.current?.focus();
  }

  function choose(id: number) {
    if (mode !== 'regular' || stage !== 'playing' || resolved.current) return;
    const option = POKEMON.find(p => p.id === id);
    finishRound(id === current.id, option?.name ?? '');
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
    if (stage !== 'playing') return;
    input.current?.focus();
    lastTick.current = 0;
    lastTier.current = 3;
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - previous) / 1000;
      previous = now;
      setSeconds(old => Math.max(0, old - delta));
    }, 50);
    return () => clearInterval(interval);
  }, [stage, index, mode]);

  useEffect(() => {
    if (stage === 'playing' && seconds <= 0 && !resolved.current) finishRound(false, guess, 'timeout');
  });

  useEffect(() => {
    if (stage !== 'playing' || seconds <= 0) return;
    const tick = Math.ceil(seconds);
    const tier = pointsForTime(seconds, ROUND_SECONDS);
    if (tick <= 3 && tick !== lastTick.current) { playSound('tick'); lastTick.current = tick; }
    else if (tier !== lastTier.current) playSound('tier');
    lastTier.current = tier;
  }, [stage, seconds]);

  return <div className="site">
    <div className="stars" aria-hidden="true"/>
    <header className="topbar"><span className="brand-dot"/> <span>POKÉPIXEL</span><span className="top-right">A PIXEL GUESSING GAME <span className="live-dot"/></span></header>
    <main className="layout">
      <section className="heading">
        <div className="eyebrow">✦ THE ULTIMATE TRAINER TEST ✦</div>
        <h1>WHO'S THAT<br/><span>POKÉMON?</span></h1>
        <p>FIVE MYSTERIES. ONE TRAINER. HOW FAST CAN YOU GUESS?</p>
      </section>
      <section className="game-shell">
        <div className="shell-head"><div>◈ POKÉPIXEL <span> / ARCADE</span></div><div className="audio-controls"><button className="sound-toggle" aria-pressed={sound} aria-label="Sound effects" onClick={() => { const value = !sound; setSoundEnabled(value); if (value) unlockSound(); setSound(value); }}>SOUND {sound ? 'ON ♪' : 'OFF'}</button><button className="sound-toggle" aria-pressed={music} aria-label="Music" onClick={() => { const value = !music; setMusicEnabled(value); if (value) unlockSound(); setMusic(value); }}>MUSIC {music ? 'ON ♫' : 'OFF'}</button></div></div>
        {stage === 'home' && <div className="home-screen">
          <div className="scene home-scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className="question">?</div><div className="scene-caption">A NEW CHALLENGE AWAITS...</div></div>
          <div className="panel home-panel"><div className="micro">READY, TRAINER?</div><h2>TEST YOUR POKÉMON KNOWLEDGE!</h2><p>GUESS 5 RANDOM POKÉMON AS THEIR SPRITES COME INTO FOCUS. GUESS EARLY TO EARN MORE POINTS!</p><div className="features"><span>◷ {ROUND_SECONDS} SEC / ROUND</span><span>★ 15 MAX POINTS</span><span>◈ GEN 5 ANIMATIONS</span></div><div className="mode-picker" role="group" aria-label="Choose a game mode"><button className={mode === 'regular' ? 'mode-option selected' : 'mode-option'} onClick={() => { unlockSound(); playSound('select'); setMode('regular'); }} aria-pressed={mode === 'regular'}><strong>⚡ REGULAR</strong><span>4 CHOICES · KAHOOT STYLE</span></button><button className={mode === 'hard' ? 'mode-option selected' : 'mode-option'} onClick={() => { unlockSound(); playSound('select'); setMode('hard'); }} aria-pressed={mode === 'hard'}><strong>★ HARD</strong><span>TYPE THE NAME YOURSELF</span></button></div><button className="primary" onClick={start}>▶ START {mode.toUpperCase()} CHALLENGE</button></div>
        </div>}
        {(stage === 'spawning' || stage === 'playing' || stage === 'reveal') && current && <>
          <div className="status"><span>{mode.toUpperCase()} · ROUND <b>{String(index+1).padStart(2,'0')}</b> / 05</span><span>★ SCORE <b>{score.toString().padStart(2,'0')}</b></span><span>◷ <b className={seconds < 5 && stage === 'playing'?'danger':''}>{Math.ceil(seconds).toString().padStart(2,'0')}s</b></span></div>
          <div className="scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className={`sprite-wrap ${stage === 'spawning' ? (spriteReady ? 'sprite-emerging' : 'sprite-waiting') : ''}`}><PixelSprite key={current.id} id={current.id} reveal={progress} clear={stage === 'reveal'} onReady={onSpriteReady}/></div>{stage === 'spawning' && <SpawnEffect ready={spriteReady} onComplete={completeSpawn}/>} <div className="scene-caption">{stage === 'reveal' ? `IT'S ${current.name.toUpperCase()}!` : stage === 'spawning' ? (spriteReady ? 'A WILD MYSTERY APPEARS!' : 'PREPARING YOUR ENCOUNTER...') : 'WHO COULD IT BE?'}</div></div>
          <div className="panel">
            {stage !== 'reveal' && <TimerBar seconds={seconds} duration={ROUND_SECONDS} waiting={stage === 'spawning'}/>}
            {stage === 'spawning' ? <div className="spawn-panel"><span role="status">{spriteReady ? 'GET READY, TRAINER!' : 'LOADING POKÉMON...'}</span><button className="skip" disabled={!spriteReady} onClick={() => { stopSounds(); completeSpawn(); }}>SKIP INTRO →</button></div> : stage === 'playing' ? <>
              {mode === 'regular' ? <div className="choice-grid" role="group" aria-label="Choose the Pokémon">
                {(choices[index] ?? []).map((option, i) => <button key={option.id} type="button" className={`choice choice-${i}`} onClick={() => choose(option.id)}><span className="choice-symbol">{['◆','▲','●','■'][i]}</span><span>{option.name}</span></button>)}
              </div> : <>
                <form onSubmit={e=>{e.preventDefault();submit();}} className="guess-form"><label htmlFor="guess">YOUR GUESS</label><div className="input-row"><input ref={input} id="guess" autoComplete="off" spellCheck={false} placeholder="Type Pokémon name..." value={guess} onChange={e=>{setGuess(e.target.value);setNotice('')}}/><button type="submit" className="primary">GUESS ▶</button></div></form>
                {suggestions.length>0 && <div className="suggestions">{suggestions.map(p=><button key={p.id} onClick={()=>submit(p.name)}>{p.name}</button>)}</div>}
              </>}
              <div className="footnote"><span>{notice || (mode === 'regular' ? 'ONE PICK PER ROUND — CHOOSE CAREFULLY!' : 'TIP: GUESS EARLY FOR MORE POINTS!')}</span><button className="skip" onClick={()=>finishRound(false,guess,'skip')}>SKIP →</button></div>
            </> : <div className="reveal-panel"><div className="micro">{results.at(-1)?.correct?'★ CORRECT ANSWER!':'✕ TIME UP / SKIPPED'}</div><h2>{current.name.toUpperCase()}</h2><p>{results.at(-1)?.correct?`GREAT WORK! +${results.at(-1)?.points} POINT${results.at(-1)?.points===1?'':'S'}!`:'NO POINTS THIS ROUND. YOU’VE GOT THE NEXT ONE!'}</p><button className="primary" onClick={next}>{index === 4?'VIEW RESULTS ▶':'NEXT ROUND ▶'}</button></div>}
          </div>
        </>}
        {stage === 'finished' && <div className="panel end-panel"><div className="eyebrow">✦ CHALLENGE COMPLETE ✦</div><div className="trophy">★</div><h2>{mode.toUpperCase()} RESULTS</h2><div className="final-score">{score}<span> / 15</span></div><p>{score>=12?'INCREDIBLE! YOU KNOW YOUR POKÉMON!':score>=7?'NICE WORK, TRAINER! KEEP PRACTICING!':'EVERY MASTER STARTS SOMEWHERE!'}</p><div className="result-list">{results.map((r,i)=><div key={i}><span>ROUND {i+1}</span><strong>{r.pokemon.name}</strong><b className={r.correct?'good':'bad'}>+{r.points}</b></div>)}</div><button className="primary" onClick={start}>↻ PLAY AGAIN</button><button className="return-button" onClick={()=>setStage('home')}>⇦ CHANGE MODE</button></div>}
        <div className="shell-foot">© FAN-MADE GAME <span>POWERED BY POKÉAPI SPRITES</span></div>
      </section>
      <div className="below">NO ACCOUNT NEEDED · 5 RANDOM ROUNDS · PLAY AGAIN INSTANTLY</div>
    </main>
  </div>;
}
export default App;
