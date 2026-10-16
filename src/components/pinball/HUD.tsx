import { useEffect, useState } from "react";
import { useGameStore } from "../../game/store";
import { setSoundEnabled } from "../../game/audio";
import { Button } from "../ui/button";
import { ArrowUp, MoveHorizontal, Volume2, VolumeX } from "lucide-react";

function key(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
}

function TouchZone({ code, className, label }: { code: string; className: string; label: string }) {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      title={label}
      className={`pointer-events-auto touch-none select-none p-0 ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        key("keydown", code);
      }}
      onPointerUp={() => key("keyup", code)}
      onPointerCancel={() => key("keyup", code)}
      onPointerLeave={() => key("keyup", code)}
    >
      {code === "Space" && <ArrowUp aria-hidden="true" className="size-6 text-brass" />}
    </Button>
  );
}

export function HUD() {
  const g = useGameStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => setSoundEnabled(g.soundOn), [g.soundOn]);

  const showMsg = g.message && Date.now() < g.messageUntil;
  const score = g.score.toString().padStart(9, "0");

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
      {/* Backglass score */}
      <header className={`backglass mx-auto mt-3 w-[min(94vw,560px)] px-4 py-2 transition-shadow ${g.multiball ? "shadow-tesla motion-safe:animate-energy" : "shadow-brass"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-xs tracking-[0.25em] text-brass">CHRONO STORM 1885</div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={g.soundOn ? "Couper le son" : "Activer le son"}
            title={g.soundOn ? "Couper le son" : "Activer le son"}
            className="pointer-events-auto text-muted-foreground hover:text-brass"
            onClick={g.toggleSound}
          >
            {g.soundOn ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
        <div key={score} className="nixie score-flash mt-1 text-center text-3xl sm:text-4xl">{score}</div>
        <div className="mt-1 grid grid-cols-4 gap-2 text-center font-display text-[10px] tracking-widest text-muted-foreground">
          <div>
            BALL <span className="text-brass">{Math.max(0, 4 - g.balls) > 3 ? 3 : 4 - g.balls}</span>/3
          </div>
          <div>
            ×<span className="text-brass">{g.multiplier}</span>
          </div>
          <div className={`era-${g.era}`}>{g.era.toUpperCase()}</div>
          <div>HI {g.highScore.toLocaleString()}</div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="tesla-gauge h-full motion-safe:animate-energy transition-all" style={{ width: `${g.teslaCharge}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-display text-[9px] tracking-widest text-muted-foreground">
          <span>TESLA {Math.round(g.teslaCharge)}%</span>
          <span>{g.multiball ? "STORM SURGE" : g.ballSave ? "BALL SAVE" : "BALL IN PLAY"}</span>
        </div>
      </header>

      {showMsg && g.phase === "playing" && (
        <div className="mt-6 text-center">
          <span className="event-banner font-display text-2xl sm:text-4xl">{g.message}</span>
        </div>
      )}

      {/* Touch controls */}
      {g.phase === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex h-[38%]">
          <TouchZone code="ShiftLeft" label="Flipper gauche" className="h-full flex-1" />
          <TouchZone code="ShiftRight" label="Flipper droit" className="h-full flex-1" />
          <TouchZone
            code="Space"
            label="Lanceur"
            className="launch-btn absolute bottom-4 right-4 h-16 w-16 rounded-full shadow-brass hover:shadow-tesla motion-safe:animate-energy"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Secouer la table"
            title="Secouer la table"
            className="nudge-btn pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 shadow-brass hover:shadow-tesla"
            onClick={() => key("keydown", "KeyN")}
          >
            <MoveHorizontal />
          </Button>
        </div>
      )}

      {(g.phase === "menu" || g.phase === "gameover") && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="brass-panel max-w-md p-6 text-center">
            <h1 className="title-copper font-display text-3xl sm:text-5xl">CHRONO STORM</h1>
            <div className="font-display text-xl tracking-[0.6em] text-tesla">1885</div>
            {g.phase === "gameover" && (
              <p className="nixie mt-4 text-2xl">{g.score.toLocaleString()}</p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Stabilisez la faille temporelle. Chargez la bobine Tesla, réglez l'horloge, puis visez le portail.
            </p>
            <Button
              onClick={g.start}
              className="start-btn mt-6 h-12 w-full rounded-md px-6 py-3 font-display text-lg tracking-widest shadow-brass hover:shadow-tesla"
            >
              {g.phase === "gameover" ? "REJOUER" : "JOUER"}
            </Button>
            <div className="mt-5 grid grid-cols-2 gap-1 text-left text-xs text-muted-foreground">
              <span>Flippers</span><span className="text-brass">Shift G / D · touchez gauche / droite</span>
              <span>Lanceur</span><span className="text-brass">Espace (maintenir) · bouton rond</span>
              <span>Secousse</span><span className="text-brass">N / B · ↔</span>
            </div>
            <p className="mt-5 text-[10px] leading-snug text-muted-foreground/70">
              Jeu original inspiré des flippers widebody des années 90. Non affilié à MGM, Bally/Williams,
              Universal ou DeLorean Motor Company. Tous les éléments sont originaux.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
