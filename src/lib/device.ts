// Browser APIs the gym floor needs: beep + vibrate, speech in and out, and keeping the screen on.

let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  audio ??= new C();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

/** iOS only plays audio after a tap; call this from the Start button. */
export function unlockAudio(): void {
  try {
    ctx();
  } catch {
    /* no audio */
  }
}

export function beep(): void {
  try {
    const c = ctx();
    if (c) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.2;
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.5);
    }
  } catch {
    /* no audio */
  }
  buzz([200, 100, 200]);
}

export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS Safari has no vibrate */
  }
}

export function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* none */
  }
}

export function say(text: string, enabled: boolean): void {
  if (!enabled || !text.trim() || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
  } catch {
    /* none */
  }
}

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
};

/** "twelve", "12", "twenty two" → "12" / "22". */
export function parseSpokenNumber(t: string): string | null {
  const s = t.toLowerCase().replace(/-/g, " ");
  const d = s.match(/\d+/);
  if (d) {
    const n = parseInt(d[0], 10);
    return n >= 0 && n <= 100 ? String(n) : null;
  }
  let total = 0;
  let hit = false;
  let tens = false;
  for (const w of s.split(/[^a-z]+/).filter(Boolean)) {
    const v = WORDS[w];
    if (v === undefined) continue;
    // "twenty two" → 22; any other number word replaces what came before.
    total = tens && v < 10 ? total + v : v;
    tens = v === 20 || v === 30;
    hit = true;
  }
  return hit && total <= 100 ? String(total) : null;
}

type Rec = {
  lang: string;
  maxAlternatives: number;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

export function canListen(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function listenForNumber(ms = 7000): Promise<string | null> {
  const w = window as unknown as Record<string, new () => Rec>;
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!R) return Promise.resolve(null);
  return new Promise((resolve) => {
    let r: Rec;
    try {
      r = new R();
    } catch {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
      resolve(v);
    };
    const t = setTimeout(() => finish(null), ms);
    r.lang = "en-US";
    r.maxAlternatives = 1;
    r.onresult = (e) => finish(parseSpokenNumber(e.results[0]?.[0]?.transcript ?? ""));
    r.onerror = () => finish(null);
    r.onend = () => finish(null);
    try {
      r.start();
    } catch {
      finish(null);
    }
  });
}

// ---------- Keep the screen on during a run ----------

type Lock = { release(): Promise<void>; addEventListener(t: "release", f: () => void): void };
let lock: Lock | null = null;
let wanted = false;
let video: HTMLVideoElement | null = null;
let bound = false;

/** A muted looping video keeps older iOS awake when the Wake Lock API is missing. */
export function setWakeVideo(v: HTMLVideoElement | null): void {
  video = v;
}

export async function keepAwake(on: boolean): Promise<void> {
  wanted = on;
  if (!bound) {
    bound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && wanted && !lock) void keepAwake(true);
    });
  }
  if (!on) {
    try {
      await lock?.release();
    } catch {
      /* already released */
    }
    lock = null;
    video?.pause();
    return;
  }
  if (lock) return;
  const nav = navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<Lock> } };
  try {
    if (nav.wakeLock) {
      lock = await nav.wakeLock.request("screen");
      lock.addEventListener("release", () => {
        lock = null;
      });
      return;
    }
  } catch {
    /* denied: fall through to the video */
  }
  if (video) {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch {
      /* autoplay refused */
    }
  }
}
