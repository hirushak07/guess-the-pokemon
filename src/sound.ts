// Original synthesized arcade cues plus the attributed release recording.
type Cue = 'land' | 'release' | 'correct' | 'incorrect' | 'complete' | 'select' | 'tick' | 'tier' | 'timeout' | 'skip';
let context: AudioContext | undefined;
let master: GainNode | undefined;
let enabled = true;
const voices = new Set<AudioScheduledSourceNode>();
let releaseBuffer: AudioBuffer | undefined;
let releaseLoad: Promise<void> | undefined;

function loadReleaseSound(ctx: AudioContext) {
  releaseLoad ??= fetch(new URL('./assets/pokeball-release.mp3', import.meta.url), { signal: AbortSignal.timeout(8000) })
    .then(response => { if (!response.ok) throw new Error('Release audio unavailable'); return response.arrayBuffer(); })
    .then(bytes => ctx.decodeAudioData(bytes))
    .then(buffer => { releaseBuffer = buffer; })
    .catch(() => { releaseLoad = undefined; }); // Keep the synthesized fallback; retry on interaction.
}
let musicEnabled = true;
let musicActive = false;
let musicBus: GainNode | undefined;
let musicTimer: number | undefined;
let step = 0;
let nextBeat = 0;
const musicVoices = new Set<OscillatorNode>();

// Original 8-bar loop, 120 BPM: a quiet pulse lead, bass, and soft kick.
// MIDI pitches and rhythm were composed for this game, not transcribed.
const melody = [72, 0, 79, 76, 0, 74, 76, 0, 81, 79, 0, 76, 74, 0, 71, 0,
  69, 0, 76, 72, 0, 74, 77, 0, 76, 72, 0, 69, 71, 0, 74, 0,
  65, 0, 72, 77, 0, 76, 74, 0, 72, 69, 0, 72, 76, 0, 74, 0,
  67, 0, 74, 79, 0, 77, 76, 0, 74, 71, 0, 67, 71, 74, 0, 79];
const bass = [48, 45, 41, 43];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = undefined;
  for (const voice of musicVoices) {
    try { voice.stop(); } catch { /* Already ended. */ }
  }
  musicVoices.clear();
}

function musicNote(frequency: number, time: number, duration: number, volume: number, type: OscillatorType, kick = false) {
  if (!context || !musicBus) return;
  const voice = context.createOscillator();
  const gain = context.createGain();
  voice.type = type;
  voice.frequency.setValueAtTime(frequency, time);
  if (kick) voice.frequency.exponentialRampToValueAtTime(45, time + duration);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + .008);
  gain.gain.exponentialRampToValueAtTime(.001, time + duration);
  voice.connect(gain);
  gain.connect(musicBus);
  musicVoices.add(voice);
  voice.onended = () => { musicVoices.delete(voice); voice.disconnect(); gain.disconnect(); };
  voice.start(time);
  voice.stop(time + duration + .02);
}

function syncMusic() {
  if (!musicEnabled || !musicActive || context?.state !== 'running') {
    stopMusic();
    return;
  }
  if (musicTimer !== undefined) return;
  step = 0;
  nextBeat = context.currentTime + .04;
  const schedule = () => {
    if (!context || context.state !== 'running') return;
    // Never dump missed notes on return from a throttled/background tab.
    if (nextBeat < context.currentTime) nextBeat = context.currentTime + .04;
    // Buffer through ordinary background-tab timer throttling. Muting stops
    // scheduled voices immediately, including notes that have not started.
    while (nextBeat < context.currentTime + 1.25) {
      const note = melody[step % melody.length];
      if (note) musicNote(hz(note), nextBeat, .19, .12, 'square');
      if (step % 2 === 0) musicNote(hz(bass[Math.floor(step / 16) % 4] + (step % 4 === 2 ? 12 : 0)), nextBeat, .35, .28, 'triangle');
      if (step % 4 === 0) musicNote(110, nextBeat, .13, .3, 'sine', true);
      nextBeat += .25;
      step++;
    }
  };
  schedule();
  musicTimer = window.setInterval(schedule, 25);
}

export function setMusicEnabled(value: boolean) { musicEnabled = value; syncMusic(); }
export function setMusicActive(value: boolean) { musicActive = value; syncMusic(); }
export function handleAudioVisibility() { if (document.hidden) stopSounds(); syncMusic(); }
export function stopAllAudio() { stopSounds(); musicActive = false; stopMusic(); }

export function stopSounds() {
  for (const voice of voices) {
    try { voice.stop(); } catch { /* Already ended. */ }
  }
  voices.clear();
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  if (!value) stopSounds();
}

// Call synchronously from a click/keyboard handler to respect autoplay policy.
export function unlockSound() {
  try {
    context ??= new AudioContext();
    if (!master) {
      master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
      musicBus = context.createGain();
      musicBus.gain.value = .16;
      musicBus.connect(context.destination);
    }
    loadReleaseSound(context);
    void context.resume().then(syncMusic).catch(() => {});
  } catch { /* Audio is optional; gameplay works without Web Audio. */ }
}

export function playSound(cue: Cue) {
  if (!enabled || document.hidden || !context || !master || context.state !== 'running') return;
  stopSounds();
  const ctx = context;
  if (cue === 'release' && releaseBuffer) {
    const source = ctx.createBufferSource();
    source.buffer = releaseBuffer;
    source.connect(master);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); };
    source.start();
    return;
  }
  const notes: [number, number, number, number][] = {
    select: [[740, 990, 0, .065]],
    tick: [[880, 660, 0, .07]],
    tier: [[660, 440, 0, .09], [440, 330, .09, .1]],
    timeout: [[330, 220, 0, .17], [220, 110, .18, .3], [110, 55, .42, .22]],
    skip: [[440, 220, 0, .12]],
    land: [[130, 55, 0, .14]],
    release: [[260, 1040, 0, .24], [1040, 1560, .12, .28], [1560, 2080, .24, .22]],
    correct: [[523.25, 523.25, 0, .12], [659.25, 659.25, .11, .12], [783.99, 783.99, .22, .24]],
    incorrect: [[220, 185, 0, .14], [165, 110, .13, .22]],
    complete: [[523.25, 523.25, 0, .14], [659.25, 659.25, .14, .14], [783.99, 783.99, .28, .14], [1046.5, 1046.5, .42, .35]],
  }[cue] as [number, number, number, number][];
  for (const [from, to, delay, duration] of notes) {
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = cue === 'land' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(.7, start + .008);
    envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    voices.add(oscillator);
    oscillator.onended = () => {
      voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }
}
