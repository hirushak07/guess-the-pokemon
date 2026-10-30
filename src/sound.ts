// Original synthesized arcade cues: no recordings, samples, or game audio.
type Cue = 'land' | 'release' | 'correct' | 'incorrect' | 'complete';
let context: AudioContext | undefined;
let master: GainNode | undefined;
let enabled = true;
const voices = new Set<OscillatorNode>();

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
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (!master) {
      master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
    }
    void context.resume().catch(() => {});
  } catch { /* Audio is optional; gameplay works without Web Audio. */ }
}

export function playSound(cue: Cue) {
  if (!enabled || !context || !master || context.state !== 'running') return;
  stopSounds();
  const ctx = context;
  const notes: [number, number, number, number][] = {
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
