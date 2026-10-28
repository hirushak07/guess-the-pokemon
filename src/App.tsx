import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelSprite } from './PixelSprite';
import { POKEMON, pickRounds, pickOptions, normalizeGuess, type Pokemon } from './pokemon';

const ROUND_SECONDS = 20;
type Mode = 'regular' | 'hard';
type Stage = 'home' | 'playing' | 'reveal' | 'finished';
type Outcome = { pokemon: Pokemon; correct: boolean; points: number; guess: string };

function App() {
  const [mode, setMode] = useState<Mode>('regular');
  const [choices, setChoices] = useState<Pokemon[][]>([]);
  const [stage, setStage] = useState<Stage>('home');
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
    const selected = pickRounds();
    setRounds(selected);
    setChoices(selected.map(answer => {
      const distractors = pickOptions(answer, POKEMON);
      return [...distractors, answer].sort(() => Math.random() - 0.5);
    }));
    setResults([]); setIndex(0); setSeconds(ROUND_SECONDS);
    setGuess(''); setNotice(''); resolved.current = false; setStage('playing');
  }

  function finishRound(correct: boolean, attempted: string) {
    if (resolved.current || !current) return;
    resolved.current = true;
    const points = correct ? (seconds > ROUND_SECONDS * .7 ? 3 : seconds > ROUND_SECONDS * .35 ? 2 : 1) : 0;
    setResults(old => [...old, {pokemon: current, correct, points, guess: attempted}]);
    setStage('reveal');
  }

  function submit(value = guess) {
    if (stage !== 'playing' || mode !== 'hard') return;
    const normalized = normalizeGuess(value);
    if (!normalized) return;
    if (normalized === normalizeGuess(current.name)) { finishRound(true, value); return; }
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
    if (index === rounds.length - 1) { setStage('finished'); return; }
    resolved.current = false;
    setIndex(old => old + 1); setSeconds(ROUND_SECONDS);
    setGuess(''); setNotice(''); setStage('playing');
  }

  useEffect(() => {
    if (stage !== 'playing') return;
    input.current?.focus();
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
    if (stage === 'playing' && seconds <= 0 && !resolved.current) finishRound(false, guess);
  });

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
        <div className="shell-head"><div>◈ POKÉPIXEL <span> / ARCADE</span></div><div><i className="led"/> ONLINE</div></div>
        {stage === 'home' && <div className="home-screen">
          <div className="scene home-scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className="question">?</div><div className="scene-caption">A NEW CHALLENGE AWAITS...</div></div>
          <div className="panel home-panel"><div className="micro">READY, TRAINER?</div><h2>TEST YOUR POKÉMON KNOWLEDGE!</h2><p>GUESS 5 RANDOM POKÉMON AS THEIR SPRITES COME INTO FOCUS. GUESS EARLY TO EARN MORE POINTS!</p><div className="features"><span>◷ 20 SEC / ROUND</span><span>★ 15 MAX POINTS</span><span>◈ GEN 5 ANIMATIONS</span></div><div className="mode-picker" role="group" aria-label="Choose a game mode"><button className={mode === 'regular' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('regular')} aria-pressed={mode === 'regular'}><strong>⚡ REGULAR</strong><span>4 CHOICES · KAHOOT STYLE</span></button><button className={mode === 'hard' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('hard')} aria-pressed={mode === 'hard'}><strong>★ HARD</strong><span>TYPE THE NAME YOURSELF</span></button></div><button className="primary" onClick={start}>▶ START {mode.toUpperCase()} CHALLENGE</button></div>
        </div>}
        {(stage === 'playing' || stage === 'reveal') && current && <>
          <div className="status"><span>{mode.toUpperCase()} · ROUND <b>{String(index+1).padStart(2,'0')}</b> / 05</span><span>★ SCORE <b>{score.toString().padStart(2,'0')}</b></span><span>◷ <b className={seconds < 5 && stage === 'playing'?'danger':''}>{Math.ceil(seconds).toString().padStart(2,'0')}s</b></span></div>
          <div className="scene"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="grass ground"/><div className="arena"/><div className="sprite-wrap"><PixelSprite id={current.id} reveal={progress} clear={stage === 'reveal'}/></div><div className="scene-caption">{stage === 'reveal' ? `IT'S ${current.name.toUpperCase()}!` : 'WHO COULD IT BE?'}</div></div>
          <div className="panel">
            {stage === 'playing' ? <>
              <div className="panel-row"><span>IDENTIFICATION IN PROGRESS...</span><b>{Math.floor(progress*100)}%</b></div>
              <div className="progress-track"><div style={{width:`${progress*100}%`}}/></div>
              {mode === 'regular' ? <div className="choice-grid" role="group" aria-label="Choose the Pokémon">
                {(choices[index] ?? []).map((option, i) => <button key={option.id} type="button" className={`choice choice-${i}`} onClick={() => choose(option.id)}><span className="choice-symbol">{['◆','▲','●','■'][i]}</span><span>{option.name}</span></button>)}
              </div> : <>
                <form onSubmit={e=>{e.preventDefault();submit();}} className="guess-form"><label htmlFor="guess">YOUR GUESS</label><div className="input-row"><input ref={input} id="guess" autoComplete="off" spellCheck={false} placeholder="Type Pokémon name..." value={guess} onChange={e=>{setGuess(e.target.value);setNotice('')}}/><button type="submit" className="primary">GUESS ▶</button></div></form>
                {suggestions.length>0 && <div className="suggestions">{suggestions.map(p=><button key={p.id} onClick={()=>submit(p.name)}>{p.name}</button>)}</div>}
              </>}
              <div className="footnote"><span>{notice || (mode === 'regular' ? 'ONE PICK PER ROUND — CHOOSE CAREFULLY!' : 'TIP: GUESS EARLY FOR MORE POINTS!')}</span><button className="skip" onClick={()=>finishRound(false,guess)}>SKIP →</button></div>
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
