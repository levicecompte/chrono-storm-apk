import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
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
import { LightningArcs, type Arc } from "./Lightning";

const COPPER = "#9a5a2a";
const BRASS = "#c9a227";
const DARKWOOD = "#1a0d06";
const IRON = "#2a2a30";
const TESLA = "#66ccff";
const VORTEX = "#8a4bff";

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
  const engravingTex = useMemo(() => makeEngravingTexture(), []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const g = useGameStore.getState();
    const s = sim.current;

    if (g.phase === "playing") {
      // input → flippers
      s.flippers[0]!.pressed = input.current.left && !g.tilted;
      s.flippers[1]!.pressed = input.current.right && !g.tilted;
      if (s.flippers[0]!.pressed && !prevFlip.current[0]) sfxFlipper();
      if (s.flippers[1]!.pressed && !prevFlip.current[1]) sfxFlipper();
      prevFlip.current = [s.flippers[0]!.pressed, s.flippers[1]!.pressed];

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
            const next = order[(order.indexOf(g.era) + 1) % 3]!;
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
              g.flash(`TESLA COIL ${Math.round(g.teslaCharge)}%`, 1400);
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
      const f = FLIPPERS[i]!;
      const fs = s.flippers[i]!;
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
      <ambientLight intensity={0.5} color="#445" />
      <directionalLight position={[-12, 25, -10]} intensity={1.6} color="#9db8ff" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 8, 16]} intensity={14} color="#ffb066" distance={30} />
      <pointLight position={[0, 10, -8]} intensity={10} color="#8fb8ff" distance={34} />
      <pointLight ref={flashLight} intensity={0} color="#bfe6ff" distance={40} />
      <pointLight position={[PORTAL.x, 3, PORTAL.z]} intensity={10} color={VORTEX} distance={16} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 8, 0]} scale={[12, 12, 1]} color="#8bb8ff" />
        <Lightformer intensity={1} color="#ffb066" position={[-6, 2, 6]} rotation-y={Math.PI / 2} scale={[14, 1, 1]} />
        <Lightformer intensity={0.7} color="#b37cff" position={[6, 3, -6]} rotation-y={-Math.PI / 2} scale={[12, 1, 1]} />
      </Environment>

      {/* Playfield */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -1]} receiveShadow>
        <planeGeometry args={[20.4, 42.5]} />
        <meshStandardMaterial map={engravingTex} color="#e8c88f" roughness={0.75} metalness={0.15} />
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
            <meshStandardMaterial color={s.sling ? "#7a1f1f" : COPPER} metalness={0.85} roughness={0.35} />
          </mesh>
        );
      })}

      {/* Tesla coil (left) */}
      <group position={[-8.2, 0, -14.5]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.9, 1.3, 2.8, 16]} />
          <meshStandardMaterial color={COPPER} metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 3.1, 0]}>
          <torusGeometry args={[0.9, 0.32, 12, 24]} />
          <meshStandardMaterial color={TESLA} emissive={TESLA} emissiveIntensity={1.6} metalness={0.6} roughness={0.2} />
        </mesh>
        <pointLight position={[0, 3.4, 0]} intensity={6} color={TESLA} distance={12} />
      </group>

      {/* Gothic clock (back-left) */}
      <group position={[CLOCK.x, 0, CLOCK.z - 1.2]}>
        <mesh position={[0, 2.6, 0]} castShadow>
          <cylinderGeometry args={[1.5, 1.5, 0.5, 24]} />
            <meshStandardMaterial color={BRASS} emissive={BRASS} emissiveIntensity={0.25} metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, 2.6, 0.28]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[1.25, 24]} />
          <meshStandardMaterial color="#0d0a14" emissive={eraColors[era]} emissiveIntensity={0.5} />
        </mesh>
        <group ref={clockHand} position={[0, 2.6, 0.34]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.1, 0.9, 0.06]} />
            <meshStandardMaterial color={BRASS} emissive={BRASS} emissiveIntensity={0.4} />
          </mesh>
        </group>
      </group>

      {/* Temporal Engine Mk.III (right) */}
      <group position={[5.6, 0, -13.5]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[2.6, 1.8, 3.4]} />
          <meshStandardMaterial color={IRON} metalness={0.85} roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.1, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 2.8, 12]} />
          <meshStandardMaterial color={COPPER} metalness={0.9} roughness={0.3} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.8 + i * 0.8, 2.9, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ff9a3c" emissiveIntensity={1.2} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>

      {/* Portal vortex (back center) */}
      <group position={[PORTAL.x, 0, PORTAL.z]}>
        <mesh position={[0, 1.8, -0.6]} castShadow>
          <torusGeometry args={[1.6, 0.35, 10, 24]} />
          <meshStandardMaterial color="#3a3a44" metalness={0.7} roughness={0.5} />
        </mesh>
        <mesh ref={portalRef} position={[0, 1.8, -0.6]}>
          <circleGeometry args={[1.35, 32]} />
          <meshBasicMaterial ref={vortexMat} color={VORTEX} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.15, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[PORTAL.r, 24]} />
          <meshBasicMaterial color="#050308" />
        </mesh>
      </group>

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
            <meshStandardMaterial color="#8a2be2" emissive={TESLA} emissiveIntensity={0.45} metalness={0.5} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 1.8, 0]} intensity={1.5} color={TESLA} distance={7} />
        </group>
      ))}

      {/* Side targets */}
      {TARGETS.map((t, i) => (
        <mesh key={i} position={[t.x, 0.5, t.z]} castShadow>
          <cylinderGeometry args={[t.r, t.r, 1, 12]} />
          <meshStandardMaterial color={BRASS} emissive="#ffb300" emissiveIntensity={0.5} metalness={0.8} roughness={0.3} />
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
            <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
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
      <PlungerVisual sim={sim} />

      {/* Lightning arcs */}
      <LightningArcs arcs={arcs} />
    </>
  );
}

function PlungerVisual({ sim }: { sim: React.RefObject<SimState> }) {
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
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 22.8]}>
        <sphereGeometry args={[0.55, 14, 14]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.5} />
      </mesh>
    </group>
  );
}

// Procedural dark-wood texture
function makeWoodTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
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

// Playfield engraving: gothic filigree + zone labels
function makeEngravingTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#2b1a0c");
  grad.addColorStop(0.6, "#1e1108");
  grad.addColorStop(1, "#170c05");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  // filigree swirls
  g.strokeStyle = "rgba(201,162,39,0.28)";
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    const r = 18 + Math.random() * 46;
    g.beginPath();
    g.arc(x, y, r, Math.random() * 6, Math.random() * 3 + 2);
    g.stroke();
  }
  // gear motifs
  for (let i = 0; i < 8; i++) {
    const x = 60 + Math.random() * 392;
    const y = 80 + Math.random() * 860;
    const r = 14 + Math.random() * 22;
    g.save();
    g.translate(x, y);
    g.strokeStyle = "rgba(154,90,42,0.5)";
    for (let tooth = 0; tooth < 10; tooth++) {
      g.rotate(Math.PI / 5);
      g.strokeRect(r, -2.5, 7, 5);
    }
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  // labels
  g.fillStyle = "rgba(245,197,24,0.6)";
  g.font = "bold 26px Georgia, serif";
  g.textAlign = "center";
  g.fillText("RIFT LOOP", 90, 830);
  g.fillText("LIGHTNING LANE", 120, 250);
  g.fillText("VOLTAGE", 256, 420);
  g.font = "bold 20px Georgia, serif";
  g.fillText("DANGER · HIGH VOLTAGE · 1885", 256, 990);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// silence unused import warning for flipperTip (kept for debug)
void flipperTip;
void FLIPPER_REST;
