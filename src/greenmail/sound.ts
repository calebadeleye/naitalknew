/*
 * The new-mail chime. Made with Web Audio (no sound file to download), and
 * remembered per device. Browsers only allow sound after the person has
 * interacted with the page, so the audio is unlocked on the first tap/click.
 */
const KEY = "greenmail_sound";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    void audio()?.resume().catch(() => undefined);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Not remembered, but applies for now.
  }
}

/** A soft two-note chime. `force` plays it even when sound is off (the Settings preview). */
export function playNewMailSound(force = false): void {
  if (!force && !soundEnabled()) return;
  const ctx = audio();
  if (!ctx || ctx.state === "suspended") {
    void ctx?.resume().catch(() => undefined);
    if (!ctx || ctx.state === "suspended") return;
  }

  const start = ctx.currentTime + 0.01;
  [
    [880, 0],
    [1318.5, 0.14],
  ].forEach(([frequency, offset]) => {
    const tone = ctx.createOscillator();
    const volume = ctx.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0, start + offset);
    volume.gain.linearRampToValueAtTime(0.18, start + offset + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.45);
    tone.connect(volume).connect(ctx.destination);
    tone.start(start + offset);
    tone.stop(start + offset + 0.5);
  });
}
