import { create } from "zustand";

export type GamePhase = "menu" | "playing" | "gameover";
export type Era = "past" | "present" | "future";

interface GameStore {
  phase: GamePhase;
  score: number;
  highScore: number;
  balls: number;
  multiplier: number;
  teslaCharge: number; // 0..100
  era: Era;
  multiball: boolean;
  ballSave: boolean;
  tiltWarnings: number;
  tilted: boolean;
  message: string;
  messageUntil: number;
  soundOn: boolean;
  start: () => void;
  endGame: () => void;
  addScore: (pts: number) => void;
  setCharge: (c: number) => void;
  setEra: (e: Era) => void;
  setMultiball: (b: boolean) => void;
  setBallSave: (b: boolean) => void;
  setBalls: (n: number) => void;
  setMultiplier: (m: number) => void;
  warnTilt: () => void;
  setTilted: (b: boolean) => void;
  flash: (msg: string, ms?: number) => void;
  toggleSound: () => void;
}

const HS_KEY = "chrono-storm-1885-highscore";

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HS_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "menu",
  score: 0,
  highScore: loadHighScore(),
  balls: 3,
  multiplier: 1,
  teslaCharge: 0,
  era: "present",
  multiball: false,
  ballSave: false,
  tiltWarnings: 0,
  tilted: false,
  message: "",
  messageUntil: 0,
  soundOn: true,
  start: () =>
    set({
      phase: "playing",
      score: 0,
      balls: 3,
      multiplier: 1,
      teslaCharge: 0,
      era: "present",
      multiball: false,
      ballSave: true,
      tiltWarnings: 0,
      tilted: false,
      message: "BALL 1 — LAUNCH!",
      messageUntil: Date.now() + 2500,
    }),
  endGame: () => {
    const { score, highScore } = get();
    const hs = Math.max(score, highScore);
    try {
      localStorage.setItem(HS_KEY, String(hs));
    } catch {
      /* ignore */
    }
    set({ phase: "gameover", highScore: hs, multiball: false });
  },
  addScore: (pts) =>
    set((s) => ({ score: s.score + Math.round(pts * s.multiplier) })),
  setCharge: (c) => set({ teslaCharge: Math.min(100, Math.max(0, c)) }),
  setEra: (e) => set({ era: e }),
  setMultiball: (b) => set({ multiball: b }),
  setBallSave: (b) => set({ ballSave: b }),
  setBalls: (n) => set({ balls: n }),
  setMultiplier: (m) => set({ multiplier: m }),
  warnTilt: () => {
    const w = get().tiltWarnings + 1;
    if (w >= 3) {
      set({ tilted: true, tiltWarnings: w, message: "TILT!", messageUntil: Date.now() + 2500 });
    } else {
      set({ tiltWarnings: w, message: `DANGER — TILT WARNING ${w}/3`, messageUntil: Date.now() + 1800 });
    }
  },
  setTilted: (b) => set({ tilted: b, tiltWarnings: 0 }),
  flash: (msg, ms = 2000) => set({ message: msg, messageUntil: Date.now() + ms }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
}));
