import { useEffect, useRef } from "react";

export interface InputState {
  left: boolean;
  right: boolean;
  plunger: boolean;
}

// Keyboard + touch input for flippers / plunger / nudge.
export function usePinballInput(handlers: {
  onNudge: (dirX: number) => void;
  onAnyKey: () => void;
}) {
  const input = useRef<InputState>({ left: false, right: false, plunger: false });
  const cb = useRef(handlers);
  cb.current = handlers;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      cb.current.onAnyKey();
      switch (e.code) {
        case "ShiftLeft":
        case "KeyZ":
        case "ArrowLeft":
          input.current.left = true;
          break;
        case "ShiftRight":
        case "KeyM":
        case "ArrowRight":
          input.current.right = true;
          break;
        case "Space":
        case "ArrowDown":
          input.current.plunger = true;
          e.preventDefault();
          break;
        case "KeyN":
          cb.current.onNudge(1);
          break;
        case "KeyB":
          cb.current.onNudge(-1);
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ShiftLeft":
        case "KeyZ":
        case "ArrowLeft":
          input.current.left = false;
          break;
        case "ShiftRight":
        case "KeyM":
        case "ArrowRight":
          input.current.right = false;
          break;
        case "Space":
        case "ArrowDown":
          input.current.plunger = false;
          break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return input;
}
