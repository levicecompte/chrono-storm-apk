// Chrono Storm 1885 — pinball physics core.
// 2D simulation on the playfield plane (x right, z down toward player).
// Fixed 240Hz substeps, continuous segment collision — no tunneling.

export interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  active: boolean;
  inLane: boolean; // plunger lane
  tunnel?: { index: number; elapsed: number };
  tunnelCooldown?: number;
}

export interface FlipperState {
  angle: number; // current angle (rad)
  omega: number; // angular velocity
  pressed: boolean;
}

export type GameEvent =
  | { type: "bumper"; index: number; x: number; z: number }
  | { type: "sling"; x: number; z: number }
  | { type: "target"; side: "left" | "right"; index: number }
  | { type: "clock" }
  | { type: "portal" }
  | { type: "orbit" }
  | { type: "drain" }
  | { type: "launch" }
  | { type: "tunnel"; index: number; bonus: number };

// ---- Table layout (units: ~cm/5, table 20 x 42) ----
export const TABLE = {
  left: -10,
  right: 10,
  top: -22,
  bottom: 20,
  laneX: 7.6, // inner wall of plunger lane
  laneTop: -16, // where the lane exits into the playfield
  ballR: 0.55,
  gravity: 12, // pulls toward +z (6.5° incline feel)
};

export interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  rest?: number; // restitution override
  sling?: boolean;
}

// Static wall segments (playfield, excluding plunger lane handled separately)
export const WALLS: Seg[] = [
  // outer left wall
  { ax: -10, az: -18, bx: -10, bz: 20 },
  // top-left corner
  { ax: -10, az: -18, bx: -7, bz: -22 },
  // top wall
  { ax: -7, az: -22, bx: 7, bz: -22 },
  // top-right corner into plunger lane outer wall
  { ax: 7, az: -22, bx: 10, bz: -18 },
  { ax: 10, az: -18, bx: 10, bz: 20 },
  // lane inner wall (stops at laneTop so balls exit the lane)
  { ax: TABLE.laneX, az: TABLE.laneTop, bx: TABLE.laneX, bz: 20 },
  // orbit guide: curve at top-left funneling ball down (approximated)
  { ax: -10, az: -12, bx: -6.5, bz: -16.5 },
  { ax: 7.6, az: -16, bx: 5.2, bz: -19.5 },
  // Open lower approaches: the former slingshots are now bonus tunnels.
  // flipper guides (inlane)
  { ax: -6.2, az: 13.5, bx: -4.6, bz: 16.2 },
  { ax: 6.2, az: 13.5, bx: 4.6, bz: 16.2 },
];

export const BONUS_TUNNELS = [
  { x: -5.4, z: 13, length: 3.5, bonus: 5000, upper: false },
  { x: 5.4, z: 13, length: 3.5, bonus: 5000, upper: false },
  ...[-14.2, -17.8].flatMap((z) => [-6, -3, 0, 3, 6].map((x) =>
    ({ x, z, length: 2.1, bonus: 2500, upper: true }))),
];
export const CENTER_POST = { x: 0, z: 17.9, r: 0.16 };

export interface CircleToy {
  x: number;
  z: number;
  r: number;
  kind: "bumper" | "target" | "clock" | "portal";
  side?: "left" | "right";
  index?: number;
}

export const BUMPERS: CircleToy[] = [
  { x: -3.2, z: -6, r: 1.15, kind: "bumper", index: 0 },
  { x: 3.2, z: -6, r: 1.15, kind: "bumper", index: 1 },
  { x: 0, z: -10.8, r: 1.15, kind: "bumper", index: 2 },
];

export const TARGETS: CircleToy[] = [
  { x: -9.1, z: -2, r: 0.5, kind: "target", side: "left", index: 0 },
  { x: -9.1, z: 1.2, r: 0.5, kind: "target", side: "left", index: 1 },
  { x: -9.1, z: 4.4, r: 0.5, kind: "target", side: "left", index: 2 },
  { x: 6.7, z: -2, r: 0.5, kind: "target", side: "right", index: 0 },
  { x: 6.7, z: 1.2, r: 0.5, kind: "target", side: "right", index: 1 },
  { x: 6.7, z: 4.4, r: 0.5, kind: "target", side: "right", index: 2 },
];

export const CLOCK: CircleToy = { x: -6.3, z: -19, r: 0.9, kind: "clock" };
export const PORTAL: CircleToy = { x: 0, z: -20.6, r: 1.0, kind: "portal" };

// ---- Flippers ----
export const FLIPPER_LEN = 3.4;
export const FLIPPER_R = 0.42;
export const FLIPPER_REST = 0.42; // rad below horizontal
export const FLIPPER_UP = -0.55; // rad above horizontal when active
export const FLIPPER_SPEED = 16; // rad/s

export interface FlipperDef {
  pivotX: number;
  pivotZ: number;
  dir: 1 | -1; // 1 = left flipper (tip to the right), -1 = right
}

export const FLIPPERS: FlipperDef[] = [
  { pivotX: -4.3, pivotZ: 16.4, dir: 1 },
  { pivotX: 4.3, pivotZ: 16.4, dir: -1 },
];

export function flipperTip(f: FlipperDef, angle: number) {
  const a = f.dir === 1 ? angle : Math.PI - angle;
  return {
    x: f.pivotX + Math.cos(a) * FLIPPER_LEN,
    z: f.pivotZ + Math.sin(a) * FLIPPER_LEN,
  };
}

// ---- Simulation ----
const SUBDT = 1 / 240;
const REST_WALL = 0.45;
// User rule: wall rebounds amplified ×20, capped for ball safety.
const WALL_BOUNCE_MULT = 20;
const MAX_WALL_BOUNCE = 45;
const REST_BUMPER_BOOST = 16;
const STUCK_SECONDS = 2;
const STUCK_RADIUS = 0.8;
const recovery = new WeakMap<BallState, { x: number; z: number; time: number }>();

function segmentDistance(x: number, z: number, s: Seg) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - s.ax - t * dx, z - s.az - t * dz);
}

// Check displacement, not speed: a trapped ball can jitter with a high velocity.
export function recoverStuckBall(sim: SimState, b: BallState, dt: number) {
  const caught = FLIPPERS.some((f, i) => {
    const fs = sim.flippers[i];
    if (!fs?.pressed) return false;
    const tip = flipperTip(f, fs.angle);
    return segmentDistance(b.x, b.z, { ax: f.pivotX, az: f.pivotZ, bx: tip.x, bz: tip.z }) < TABLE.ballR + FLIPPER_R + 0.2;
  });
  if (!b.active || b.inLane || b.tunnel || b.z > 18 || caught) {
    recovery.delete(b);
    return false;
  }
  const watch = recovery.get(b);
  if (!watch || Math.hypot(b.x - watch.x, b.z - watch.z) > STUCK_RADIUS) {
    recovery.set(b, { x: b.x, z: b.z, time: 0 });
    return false;
  }
  watch.time += dt;
  if (watch.time < STUCK_SECONDS) return false;

  // Move only to a nearby clear point; never award points or consume a ball.
  for (let radius = 1.2; radius <= 8; radius += 0.6) {
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 8;
      const x = b.x + Math.cos(angle) * radius;
      const z = b.z + Math.sin(angle) * radius;
      if (x < TABLE.left + TABLE.ballR || x > TABLE.laneX - TABLE.ballR || z < TABLE.top + TABLE.ballR || z > 15) continue;
      if (WALLS.some((s) => segmentDistance(x, z, s) < TABLE.ballR + 0.15)) continue;
      if ([...BUMPERS, ...TARGETS, CLOCK, PORTAL].some((c) => Math.hypot(x - c.x, z - c.z) < TABLE.ballR + c.r + 0.15)) continue;
      if (Math.hypot(x - CENTER_POST.x, z - CENTER_POST.z) < TABLE.ballR + CENTER_POST.r + 0.15) continue;
      b.x = x;
      b.z = z;
      b.vx = x > 0 ? -4 : 4;
      b.vz = -8;
      recovery.delete(b);
      return true;
    }
  }
  return false;
}

function collideSegment(b: BallState, s: Seg, events: GameEvent[]) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz;
  let t = ((b.x - s.ax) * dx + (b.z - s.az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = s.ax + dx * t;
  const cz = s.az + dz * t;
  let nx = b.x - cx;
  let nz = b.z - cz;
  const d = Math.hypot(nx, nz);
  if (d >= TABLE.ballR) return;
  if (d < 1e-8) {
    const len = Math.sqrt(len2);
    nx = -dz / len;
    nz = dx / len;
    if (b.vx * nx + b.vz * nz > 0) { nx = -nx; nz = -nz; }
  } else { nx /= d; nz /= d; }
  // push out
  b.x = cx + nx * TABLE.ballR;
  b.z = cz + nz * TABLE.ballR;
  const vn = b.vx * nx + b.vz * nz;
  if (vn < 0) {
    // Wall rebounds ×20, capped so the ball never gains unbounded energy.
    const rest = (s.rest ?? REST_WALL) * WALL_BOUNCE_MULT;
    const vtx = b.vx - vn * nx;
    const vtz = b.vz - vn * nz;
    const outVn = Math.min(-rest * vn, MAX_WALL_BOUNCE);
    b.vx = vtx * 0.995 + outVn * nx;
    b.vz = vtz * 0.995 + outVn * nz;
    if (s.sling && vn < -2) events.push({ type: "sling", x: cx, z: cz });
  }
}

function collideCircle(b: BallState, c: CircleToy, events: GameEvent[]) {
  let nx = b.x - c.x;
  let nz = b.z - c.z;
  const d = Math.hypot(nx, nz);
  const minD = TABLE.ballR + c.r;
  if (d >= minD) return;
  if (d < 1e-8) {
    const speed = Math.hypot(b.vx, b.vz);
    nx = speed > 0 ? -b.vx / speed : 0;
    nz = speed > 0 ? -b.vz / speed : 1;
  } else { nx /= d; nz /= d; }
  b.x = c.x + nx * minD;
  b.z = c.z + nz * minD;
  const vn = b.vx * nx + b.vz * nz;
  if (vn < 0) {
    if (c.kind === "bumper") {
      // bumper kicks the ball away hard
      b.vx = nx * REST_BUMPER_BOOST + (Math.random() - 0.5) * 1.5;
      b.vz = nz * REST_BUMPER_BOOST + (Math.random() - 0.5) * 1.5;
      events.push({ type: "bumper", index: c.index ?? 0, x: c.x, z: c.z });
    } else {
      b.vx -= 1.6 * vn * nx;
      b.vz -= 1.6 * vn * nz;
      if (c.kind === "target" && vn < -1.5 && c.side !== undefined && c.index !== undefined)
        events.push({ type: "target", side: c.side, index: c.index });
      if (c.kind === "clock" && vn < -1.5) events.push({ type: "clock" });
    }
  }
}

function collideFlipper(b: BallState, f: FlipperDef, fs: FlipperState) {
  const tip = flipperTip(f, fs.angle);
  const dx = tip.x - f.pivotX;
  const dz = tip.z - f.pivotZ;
  const len2 = dx * dx + dz * dz;
  let t = ((b.x - f.pivotX) * dx + (b.z - f.pivotZ) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = f.pivotX + dx * t;
  const cz = f.pivotZ + dz * t;
  let nx = b.x - cx;
  let nz = b.z - cz;
  const d = Math.hypot(nx, nz);
  const minD = TABLE.ballR + FLIPPER_R;
  if (d >= minD) return;
  if (d < 1e-8) {
    nx = dz / Math.sqrt(len2);
    nz = -dx / Math.sqrt(len2);
  } else { nx /= d; nz /= d; }
  b.x = cx + nx * minD;
  b.z = cz + nz * minD;
  // surface velocity from rotation: v = omega x r (2D: perpendicular)
  const rx = cx - f.pivotX;
  const rz = cz - f.pivotZ;
  const svx = -fs.omega * rz * f.dir;
  const svz = fs.omega * rx * f.dir;
  const rvx = b.vx - svx;
  const rvz = b.vz - svz;
  const vn = rvx * nx + rvz * nz;
  if (vn < 0) {
    const rest = 0.32;
    b.vx -= (1 + rest) * vn * nx;
    b.vz -= (1 + rest) * vn * nz;
    // rolling friction along the flipper lets skilled players trap/catch
    const tx = -nz;
    const tz = nx;
    const vt = b.vx * tx + b.vz * tz;
    b.vx -= vt * tx * 0.06;
    b.vz -= vt * tz * 0.06;
  }
}

export interface SimState {
  balls: BallState[];
  flippers: FlipperState[];
  plungerPower: number; // 0..1 while holding
  plungerHeld: boolean;
  ballSaveUntil: number; // sim-time seconds
  time: number;
  portalCooldown: number;
}

export function createSim(): SimState {
  return {
    balls: [newBallInLane()],
    flippers: [
      { angle: FLIPPER_REST, omega: 0, pressed: false },
      { angle: FLIPPER_REST, omega: 0, pressed: false },
    ],
    plungerPower: 0,
    plungerHeld: false,
    ballSaveUntil: 8,
    time: 0,
    portalCooldown: 0,
  };
}

export function newBallInLane(): BallState {
  return { x: 8.8, z: 18.5, vx: 0, vz: 0, active: true, inLane: true };
}

export function spawnBall(sim: SimState) {
  sim.balls.push(newBallInLane());
}

function stepBall(sim: SimState, b: BallState, dt: number, events: GameEvent[]) {
  if (!b.active) return;

  b.tunnelCooldown = Math.max(0, (b.tunnelCooldown ?? 0) - dt);
  if (b.tunnel) {
    const tunnel = BONUS_TUNNELS[b.tunnel.index];
    if (!tunnel) { b.tunnel = undefined; return; }
    b.tunnel.elapsed += dt;
    const progress = Math.min(1, b.tunnel.elapsed / 0.45);
    b.x = tunnel.x;
    b.z = tunnel.z - progress * (tunnel.length + 0.7);
    if (progress >= 1) {
      events.push({ type: "tunnel", index: b.tunnel.index, bonus: tunnel.bonus });
      b.tunnel = undefined;
      b.tunnelCooldown = 1.2;
      b.vx = tunnel.x > 0 ? -2 : 2;
      b.vz = -14;
    }
    return;
  }

  // gravity along the slope
  b.vz += TABLE.gravity * dt;
  // light rolling resistance
  b.vx *= Math.exp(-0.12 * dt);
  b.vz *= Math.exp(-0.12 * dt);

  b.x += b.vx * dt;
  b.z += b.vz * dt;

  if (b.inLane) {
    // constrained to the plunger lane
    if (b.x < TABLE.laneX + TABLE.ballR) {
      b.x = TABLE.laneX + TABLE.ballR;
      b.vx = Math.abs(b.vx) * 0.4;
    }
    if (b.x > TABLE.right - TABLE.ballR) {
      b.x = TABLE.right - TABLE.ballR;
      b.vx = -Math.abs(b.vx) * 0.4;
    }
    if (b.z > 19.2) {
      b.z = 19.2;
      b.vz = -Math.abs(b.vz) * 0.3;
    }
    // lane exit at top: curve left into the playfield
    if (b.z < TABLE.laneTop + 0.5 && b.vz < 0) {
      b.inLane = false;
      b.x = TABLE.laneX - TABLE.ballR - 0.3;
      b.vx = -Math.abs(b.vz) * 0.55;
      b.vz = b.vz * 0.75;
      events.push({ type: "launch" });
    }
    return;
  }

  // one-way gate: balls cannot re-enter the plunger lane
  if (b.x > TABLE.laneX - TABLE.ballR && b.z > TABLE.laneTop) {
    b.x = TABLE.laneX - TABLE.ballR;
    b.vx = -Math.abs(b.vx) * 0.4;
  }

  if ((b.tunnelCooldown ?? 0) <= 0 && b.vz < 0) {
    const index = BONUS_TUNNELS.findIndex((t) => Math.abs(b.x - t.x) < 0.65 && Math.abs(b.z - t.z) < 0.5);
    if (index >= 0) {
      b.tunnel = { index, elapsed: 0 };
      b.vx = b.vz = 0;
      recovery.delete(b);
      return;
    }
  }

  for (const s of WALLS) collideSegment(b, s, events);
  // Narrow safety nail, separate from scoring toys.
  collideCircle(b, { ...CENTER_POST, kind: "portal" }, events);
  for (const c of BUMPERS) collideCircle(b, c, events);
  for (const c of TARGETS) collideCircle(b, c, events);
  collideCircle(b, CLOCK, events);

  // portal capture (a hole, not a bumper)
  {
    const dx = b.x - PORTAL.x;
    const dz = b.z - PORTAL.z;
    if (Math.hypot(dx, dz) < PORTAL.r && sim.portalCooldown <= 0) {
      events.push({ type: "portal" });
      sim.portalCooldown = 1.2;
      // eject downward with energy
      b.vx = (Math.random() - 0.5) * 4;
      b.vz = 12;
      b.z = PORTAL.z + PORTAL.r + TABLE.ballR + 0.1;
    }
  }

  // orbit detection: fast ball rounding the top
  if (b.z < -18 && Math.abs(b.vx) > 14) events.push({ type: "orbit" });

  for (let i = 0; i < FLIPPERS.length; i++) {
    const def = FLIPPERS[i];
    const state = sim.flippers[i];
    if (def && state) collideFlipper(b, def, state);
  }

  // drain
  if (b.z > TABLE.bottom + 1) {
    b.active = false;
    events.push({ type: "drain" });
  }
}

export function stepSim(sim: SimState, frameDt: number, events: GameEvent[]) {
  const frameTime = Math.min(Math.max(frameDt, 0), 0.05);
  let acc = frameTime;
  sim.portalCooldown = Math.max(0, sim.portalCooldown - frameTime);

  // flippers update at frame rate (input latency matters)
  for (let i = 0; i < sim.flippers.length; i++) {
    const f = sim.flippers[i];
    if (!f) continue;
    const target = f.pressed ? FLIPPER_UP : FLIPPER_REST;
    const prev = f.angle;
    const diff = target - f.angle;
    const step = FLIPPER_SPEED * frameTime;
    f.angle += Math.max(-step, Math.min(step, diff));
    f.omega = (f.angle - prev) / Math.max(frameTime, 1e-4);
  }

  // plunger charging
  if (sim.plungerHeld) {
    sim.plungerPower = Math.min(1, sim.plungerPower + frameTime * 0.9);
  }

  while (acc > 0) {
    const dt = Math.min(SUBDT, acc);
    sim.time += dt;
    for (const b of sim.balls) stepBall(sim, b, dt, events);
    acc -= dt;
  }
  for (const b of sim.balls) recoverStuckBall(sim, b, frameTime);
}

export function releasePlunger(sim: SimState): boolean {
  sim.plungerHeld = false;
  const power = sim.plungerPower;
  sim.plungerPower = 0;
  const laneBall = sim.balls.find((b) => b.active && b.inLane);
  if (laneBall && laneBall.z > 14) {
    laneBall.vz = -(40 + 45 * power);
    return true;
  }
  return false;
}

export function nudge(sim: SimState, dirX: number) {
  for (const b of sim.balls) {
    if (!b.active || b.inLane) continue;
    b.vx += dirX * 2.2;
    b.vz -= 1.2;
  }
}
