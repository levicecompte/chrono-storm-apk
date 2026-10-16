import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  BUMPERS,
  CLOCK,
  FLIPPERS,
  FLIPPER_LEN,
  FLIPPER_R,
  FLIPPER_REST,
  PORTAL,
  TABLE,
  TARGETS,
  WALLS,
  createSim,
  flipperTip,
  newBallInLane,
  nudge,
  releasePlunger,
  stepSim,
  type GameEvent,
  type SimState,
} from "../../game/physics";
import { useGameStore } from "../../game/store";
import { usePinballInput } from "../../game/input";
import {
  setSoundEnabled,
  sfxBumper,
  sfxDrain,
  sfxFlipper,
  sfxJackpot,
  sfxPortal,
  sfxTarget,
  sfxZap,
} from "../../game/audio";
import { type Arc } from "./Lightning";
import playfieldArt from "../../assets/mansion-playfield.jpg";
import { VintageRails } from "./VintageRails";
import { BonusTunnels } from "./BonusTunnels";
import { makeSurfaceTexture, type SurfaceTextures } from "./surfaceTextures";

const COPPER = "#a5a7a9";
const BRASS = "#e2bd2a";
const DARKWOOD = "#1a0d06";
const IRON = "#2a2a30";
const TESLA = "#ffb15c";
const VORTEX = "#c99b69";

export function Scene() {
  const sim = useRef<SimState>(createSim());
  const arcs = useRef<Arc[]>([]);
  const events: GameEvent[] = [];
  const ballRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flipperRefs = useRef<(THREE.Group | null)[]>([]);
  const portalRef = useRef<THREE.Mesh>(null);
  const vortexMat = useRef<THREE.MeshBasicMaterial>(null);
  const clockHand = useRef<THREE.Group>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const bumperRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shake = useRef(0);
  const modeTimer = useRef(0);
  const ballSaveTimer = useRef(8);
  const prevFlip = useRef([false, false]);

  const input = usePinballInput({
    onNudge: (dirX) => {
      const s = useGameStore.getState();
      if (s.phase !== "playing" || s.tilted) return;
      nudge(sim.current, dirX);
      s.warnTilt();
      shake.current = Math.max(shake.current, 0.35);
    },
    onAnyKey: () => {
      const s = useGameStore.getState();
      if (s.phase === "menu" || s.phase === "gameover") s.start();
    },
  });

  const woodTex = useMemo(() => makeWoodTexture(), []);
  const surfaces = useMemo(() => ({ metal: makeSurfaceTexture("metal"), rubber: makeSurfaceTexture("rubber"), stone: makeSurfaceTexture("stone") }), []);
  useEffect(() => () => { Object.values(surfaces).forEach((t) => t.dispose()); woodTex.dispose(); }, [surfaces, woodTex]);
  const engravingTex = useTexture(playfieldArt, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (state.camera instanceof THREE.PerspectiveCamera) {
      const fov = Math.min(85, Math.max(27, 27 * state.camera.aspect / 0.71));
      if (Math.abs(state.camera.fov - fov) > 0.01) { state.camera.fov = fov; state.camera.updateProjectionMatrix(); }
    }
    const g = useGameStore.getState();
    const s = sim.current;

    if (g.phase === "playing") {
      // input → flippers
      s.flippers.forEach((flipper, i) => {
        flipper.pressed = (i === 0 ? input.current.left : input.current.right) && !g.tilted;
        if (flipper.pressed && !prevFlip.current[i]) sfxFlipper();
        prevFlip.current[i] = flipper.pressed;
      });

      // plunger — launch on release edge
      const wasHeld = s.plungerHeld;
      s.plungerHeld = input.current.plunger;
      if (wasHeld && !input.current.plunger && releasePlunger(s)) {
        g.flash("LAUNCH!", 900);
      }

      events.length = 0;
      stepSim(s, dt, events);
      (window as unknown as { __sim: SimState }).__sim = s;

      // ball save countdown
      ballSaveTimer.current = Math.max(0, ballSaveTimer.current - dt);
      g.setBallSave(ballSaveTimer.current > 0);

      // multiball timer
      if (g.multiball) {
        modeTimer.current -= dt;
        if (modeTimer.current <= 0) {
          g.setMultiball(false);
          // keep one ball
          s.balls = s.balls.filter((b) => b.active).slice(0, 1);
          if (s.balls.length === 0) s.balls = [newBallInLane()];
          g.flash("STORM SURGE OVER", 1800);
        }
      }

      for (const ev of events) {
        switch (ev.type) {
          case "tunnel":
            g.addScore(ev.bonus);
            g.flash(`TUNNEL BONUS +${ev.bonus.toLocaleString("fr-FR")}`, 1400);
            sfxTarget();
            break;
          case "bumper": {
            g.addScore(1000);
            g.setCharge(g.teslaCharge + 8);
            sfxBumper();
            if (Math.random() < 0.6) sfxZap();
            spawnArc(ev.x, ev.z);
            shake.current = Math.max(shake.current, 0.18);
            const bm = bumperRefs.current[ev.index];
            if (bm) bm.scale.setScalar(1.25);
            break;
          }
          case "sling":
            g.addScore(350);
            g.setCharge(g.teslaCharge + 3);
            sfxTarget();
            break;
          case "target": {
            g.addScore(2500);
            g.setCharge(g.teslaCharge + 5);
            sfxTarget();
            break;
          }
          case "clock": {
            const order = ["past", "present", "future"] as const;
            const next = order[(order.indexOf(g.era) + 1) % 3] ?? "present";
            g.setEra(next);
            g.addScore(5000);
            g.flash(`ERA: ${next.toUpperCase()}`, 1500);
            sfxPortal();
            break;
          }
          case "portal": {
            sfxPortal();
            spawnArc(PORTAL.x, PORTAL.z);
            if (g.teslaCharge >= 100 && !g.multiball) {
              g.setCharge(0);
              g.setMultiball(true);
              modeTimer.current = 30;
              if (s.balls.filter((b) => b.active).length < 2) {
                const nb = newBallInLane();
                nb.inLane = false;
                nb.x = 0;
                nb.z = -14;
                nb.vz = 8;
                s.balls.push(nb);
              }
              g.flash("STORM SURGE — MULTIBALL!", 2500);
              sfxJackpot();
              shake.current = 0.6;
            } else if (g.multiball) {
              g.addScore(250000);
              g.flash("SUPER JACKPOT 2.21 GW!", 2200);
              sfxJackpot();
              shake.current = 0.6;
            } else {
              g.addScore(10000);
              g.flash("MANSION BONUS", 1400);
            }
            break;
          }
          case "orbit":
            g.addScore(g.multiball ? 100000 : 5000);
            if (g.multiball) {
              g.flash("JACKPOT!", 1200);
              sfxJackpot();
            }
            break;
          case "drain": {
            sfxDrain();
            const active = s.balls.filter((b) => b.active);
            if (active.length > 0) break; // other balls still in play
            if (g.ballSave) {
              s.balls = [newBallInLane()];
              g.flash("BALL SAVED — SHOOT AGAIN", 1800);
              break;
            }
            const left = g.balls - 1;
            g.setBalls(left);
            g.setTilted(false);
            g.setMultiplier(1);
            if (left <= 0) {
              g.endGame();
            } else {
              s.balls = [newBallInLane()];
              ballSaveTimer.current = 8;
              g.flash(`BALL ${3 - left + 1} — LAUNCH!`, 2000);
            }
            break;
          }
          case "launch":
            break;
        }
      }
    }

    // ---- visual sync ----
    const balls = s.balls.filter((b) => b.active);
    for (let i = 0; i < ballRefs.current.length; i++) {
      const m = ballRefs.current[i];
      if (!m) continue;
      const b = balls[i];
      m.visible = !!b;
      if (b) {
        m.position.set(b.x, TABLE.ballR, b.z);
        m.rotation.x += b.vz * dt * 1.5;
        m.rotation.z -= b.vx * dt * 1.5;
      }
    }
    for (let i = 0; i < 2; i++) {
      const grp = flipperRefs.current[i];
      if (!grp) continue;
      const f = FLIPPERS[i];
      const fs = s.flippers[i];
      if (!f || !fs) continue;
      const a = f.dir === 1 ? -fs.angle : fs.angle;
      grp.rotation.y = f.dir === 1 ? a : Math.PI + a;
    }

    // vortex spin + clock hands
    if (portalRef.current) portalRef.current.rotation.z += dt * 2.2;
    if (vortexMat.current) {
      const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 5) * 0.25;
      vortexMat.current.color.set(VORTEX).multiplyScalar(pulse);
    }
    if (clockHand.current) clockHand.current.rotation.z -= dt * 0.35;

    // bumper relax
    for (const bm of bumperRefs.current) {
      if (bm && bm.scale.x > 1) {
        const k = Math.max(1, bm.scale.x - dt * 1.8);
        bm.scale.setScalar(k);
      }
    }

    // flash light decay
    if (flashLight.current) {
      flashLight.current.intensity = Math.max(0, flashLight.current.intensity - dt * 220);
    }

    // camera shake
    if (shake.current > 0.001) {
      shake.current *= Math.exp(-6 * dt);
      state.camera.position.x = (Math.random() - 0.5) * shake.current;
      state.camera.position.y = 56 + (Math.random() - 0.5) * shake.current;
    } else {
      state.camera.position.x = 0;
      state.camera.position.y = 56;
    }

    // expire arcs
    arcs.current = arcs.current.filter((a) => state.clock.elapsedTime - a.t0 < a.life);
  });

  function spawnArc(x: number, z: number) {
    const s = sim.current;
    const ball = s.balls.find((b) => b.active && !b.inLane);
    const to = ball ? { x: ball.x, z: ball.z } : { x: 0, z: 0 };
    arcs.current.push({
      id: Math.random(),
      from: new THREE.Vector3(x, 1.6, z),
      to: new THREE.Vector3(to.x, TABLE.ballR, to.z),
      t0: performance.now() / 1000,
      life: 0.18,
    });
    if (flashLight.current) {
      flashLight.current.position.set(x, 4, z);
      flashLight.current.intensity = 60;
    }
    if (navigator.vibrate) navigator.vibrate(40);
  }

  const era = useGameStore((s) => s.era);
  const eraColors = { past: "#d8a35c", present: "#4FA8FF", future: "#B37CFF" };

  return (
    <>
      <color attach="background" args={["#07060c"]} />
      <fog attach="fog" args={["#07060c", 55, 110]} />
      <ambientLight intensity={0.5} color="#c3c5ca" />
      <directionalLight position={[-12, 25, -10]} intensity={2.2} color="#e5dbce" />
      <pointLight position={[0, 8, 16]} intensity={14} color="#ffb066" distance={30} />
      <pointLight position={[0, 10, -8]} intensity={10} color="#e6d9c1" distance={34} />
      <pointLight ref={flashLight} intensity={0} color="#ffcc88" distance={40} />
      <pointLight position={[PORTAL.x, 3, PORTAL.z]} intensity={10} color={VORTEX} distance={16} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 8, 0]} scale={[12, 12, 1]} color="#e3e6eb" />
        <Lightformer intensity={1} color="#ffb066" position={[-6, 2, 6]} rotation-y={Math.PI / 2} scale={[14, 1, 1]} />
        <Lightformer intensity={0.7} color="#b8b9bc" position={[6, 3, -6]} rotation-y={-Math.PI / 2} scale={[12, 1, 1]} />
      </Environment>

      {/* Playfield */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, -1]} receiveShadow>
        <planeGeometry args={[20.4, 42.5]} />
        <meshStandardMaterial map={engravingTex} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Cabinet body */}
      <mesh position={[0, -1.2, -1]}>
        <boxGeometry args={[22.5, 2.4, 45]} />
        <meshStandardMaterial map={woodTex} color={DARKWOOD} roughness={0.85} />
      </mesh>

      {/* Walls from physics segments (visual rails) */}
      {WALLS.map((s, i) => {
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
        const ang = Math.atan2(s.bz - s.az, s.bx - s.ax);
        return (
          <mesh key={i} position={[(s.ax + s.bx) / 2, 0.55, (s.az + s.bz) / 2]} rotation-y={-ang} castShadow>
            <boxGeometry args={[len, 1.1, 0.5]} />
            <meshStandardMaterial map={surfaces.metal} color={s.sling ? "#7a1f1f" : COPPER} metalness={0.85} roughness={0.35} />
          </mesh>
        );
      })}

      <VintageRails surfaces={surfaces} />
      <BonusTunnels surfaces={surfaces} sim={sim} />

      {/* Bumpers */}
      {BUMPERS.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh
            ref={(m) => {
              bumperRefs.current[i] = m;
            }}
            position={[0, 0.8, 0]}
            castShadow
          >
            <cylinderGeometry args={[b.r, b.r * 1.1, 1.4, 20]} />
            <meshStandardMaterial map={surfaces.rubber} color="#e7dcc2" emissive={TESLA} emissiveIntensity={0.18} metalness={0.5} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 1.8, 0]} intensity={1.5} color={TESLA} distance={7} />
        </group>
      ))}

      {/* Side targets */}
      {TARGETS.map((t, i) => (
        <mesh key={i} position={[t.x, 0.5, t.z]} castShadow>
          <cylinderGeometry args={[t.r, t.r, 1, 12]} />
          <meshStandardMaterial map={surfaces.metal} color={BRASS} emissive="#ffb300" emissiveIntensity={0.5} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Flippers */}
      {FLIPPERS.map((f, i) => (
        <group
          key={i}
          position={[f.pivotX, TABLE.ballR, f.pivotZ]}
          ref={(g) => {
            flipperRefs.current[i] = g;
          }}
        >
          <mesh position={[FLIPPER_LEN / 2, 0, 0]} rotation-z={Math.PI / 2} castShadow>
            <capsuleGeometry args={[FLIPPER_R, FLIPPER_LEN, 6, 12]} />
            <meshStandardMaterial map={surfaces.metal} color={BRASS} metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Balls */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            ballRefs.current[i] = m;
          }}
          castShadow
        >
          <sphereGeometry args={[TABLE.ballR, 24, 24]} />
          <meshStandardMaterial color="#e8ecf2" metalness={1} roughness={0.08} envMapIntensity={1.6} />
        </mesh>
      ))}

      {/* Plunger */}
      <PlungerVisual sim={sim} surfaces={surfaces} />

      {/* Lightning arcs */}

    </>
  );
}

function PlungerVisual({ sim, surfaces }: { sim: React.RefObject<SimState>; surfaces: SurfaceTextures }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.z = 21.5 - sim.current.plungerPower * 1.6;
    }
  });
  return (
    <group position={[8.8, 0.55, 0]}>
      <mesh ref={ref} position={[0, 0, 21.5]}>
        <cylinderGeometry args={[0.35, 0.35, 2.2, 12]} />
        <meshStandardMaterial map={surfaces.metal} color={BRASS} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 22.8]}>
        <sphereGeometry args={[0.55, 14, 14]} />
        <meshStandardMaterial map={surfaces.rubber} color="#7a1f1f" roughness={0.5} />
      </mesh>
    </group>
  );
}

// Procedural dark-wood texture
function makeWoodTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return new THREE.Texture();
  g.fillStyle = "#241206";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${20 + Math.random() * 40},${10 + Math.random() * 20},5,${0.25 + Math.random() * 0.3})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(0, y);
    g.bezierCurveTo(85, y + (Math.random() - 0.5) * 22, 170, y + (Math.random() - 0.5) * 22, 256, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 4);
  return t;
}

void flipperTip;
void FLIPPER_REST;
