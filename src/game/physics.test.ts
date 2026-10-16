import { describe, expect, it } from "vitest";
import { BONUS_TUNNELS, CENTER_POST, FLIPPERS, FLIPPER_REST, flipperTip, createSim, recoverStuckBall, stepSim, TABLE, FLIPPER_UP, type GameEvent, type BallState } from "./physics";

function ball(x = 0, z = 0): BallState {
  return { x, z, vx: 0, vz: 0, active: true, inLane: false };
}

describe("billes sans blocage", () => {
  it("libère une bille immobile après deux secondes sans la perdre", () => {
    const sim = createSim();
    const b = ball(-9.45, 8);
    recoverStuckBall(sim, b, 0);
    for (let i = 0; i < 39; i++) expect(recoverStuckBall(sim, b, 0.05)).toBe(false);
    expect(recoverStuckBall(sim, b, 0.05)).toBe(true);
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(8);
    expect(b.active).toBe(true);
  });
  it("ne relance pas une bille dans le lanceur", () => {
    const sim = createSim();
    const b = sim.balls[0];
    if (!b) throw new Error("Missing lane ball");
    for (let i = 0; i < 100; i++) expect(recoverStuckBall(sim, b, 0.05)).toBe(false);
    expect(b.vz).toBe(0);
    expect(b.z).toBe(18.5);
  });
  it("préserve une bille volontairement maintenue sur un flipper", () => {
    const sim = createSim();
    const f = sim.flippers[0];
    if (!f) throw new Error("Missing flipper");
    f.pressed = true;
    f.angle = FLIPPER_UP;
    const b = ball(-4.3, 15.45);
    for (let i = 0; i < 100; i++) expect(recoverStuckBall(sim, b, 0.05)).toBe(false);
    expect(b.vz).toBe(0);
  });
  it("garde la bille du bon côté du couloir du lanceur", () => {
    const sim = createSim();
    const b = ball(8.3, 6);
    b.vx = 4;
    sim.balls = [b];
    stepSim(sim, 1 / 60, []);
    expect(b.x).toBeLessThanOrEqual(TABLE.laneX - TABLE.ballR);
    expect(b.vx).toBeLessThan(0);
  });
  it("éjecte une bille exactement au centre d'un bumper", () => {
    const sim = createSim();
    const b = ball(-3.2, -6);
    sim.balls = [b];
    stepSim(sim, 1 / 240, []);
    expect(Math.hypot(b.x + 3.2, b.z + 6)).toBeGreaterThanOrEqual(1.7 - 1e-6);
    expect(Number.isFinite(b.vz)).toBe(true);
  });
  it("amplifie le rebond des parois vingt fois", () => {
    const sim = createSim();
    const b = ball(-10 + TABLE.ballR - 0.01, 0);
    b.vx = -2;
    sim.balls = [b];
    stepSim(sim, 1 / 60, []);
    expect(b.vx).toBeCloseTo(0.45 * 20 * 2, 1);
  });
  it("plafonne le rebond des parois pour la sécurité de la bille", () => {
    const sim = createSim();
    const b = ball(-10 + TABLE.ballR - 0.01, 0);
    b.vx = -10;
    sim.balls = [b];
    stepSim(sim, 1 / 60, []);
    expect(b.vx).toBeCloseTo(45, 0);
  });
});

describe("tunnels bonus et clou central", () => {
  it("offre au moins dix tunnels en haut et deux en bas", () => {
    expect(BONUS_TUNNELS.filter((t) => t.upper).length).toBeGreaterThanOrEqual(10);
    expect(BONUS_TUNNELS.filter((t) => !t.upper)).toHaveLength(2);
  });
  it.each(BONUS_TUNNELS.map((t, index) => ({ ...t, index })))("traverse le tunnel $index et accorde un seul bonus", (t) => {
    const sim = createSim();
    const b = ball(t.x, t.z + 0.15);
    b.vz = -10;
    sim.balls = [b];
    const events: GameEvent[] = [];
    stepSim(sim, 1 / 240, events);
    expect(b.tunnel?.index).toBe(t.index);
    for (let i = 0; i < 10; i++) stepSim(sim, 0.05, events);
    expect(events.filter((e) => e.type === "tunnel")).toEqual([{ type: "tunnel", index: t.index, bonus: t.bonus }]);
    expect(b.tunnel).toBeUndefined();
    expect(b.active).toBe(true);
    expect(b.z).toBeLessThan(t.z - t.length);
  });
  it("ne libère pas prématurément une bille en transit", () => {
    const sim = createSim();
    const b = ball(-5.4, 13);
    b.tunnel = { index: 0, elapsed: 0 };
    for (let i = 0; i < 100; i++) expect(recoverStuckBall(sim, b, 0.05)).toBe(false);
    expect(b.vz).toBe(0);
  });
  it("écarte les flippers tout en laissant un passage autour du clou fin", () => {
    const left = FLIPPERS[0], right = FLIPPERS[1];
    if (!left || !right) throw new Error("Missing flippers");
    const gap = flipperTip(right, FLIPPER_REST).x - flipperTip(left, FLIPPER_REST).x;
    expect(gap).toBeGreaterThan(2 * (TABLE.ballR + CENTER_POST.r + 0.1));
    expect(CENTER_POST.r).toBeLessThan(TABLE.ballR / 2);
  });
  it("fait rebondir la bille sur le clou entre les flippers", () => {
    const sim = createSim();
    const b = ball(0, CENTER_POST.z - TABLE.ballR - CENTER_POST.r + 0.01);
    b.vz = 8;
    sim.balls = [b];
    stepSim(sim, 1 / 240, []);
    expect(b.vz).toBeLessThan(0);
    expect(b.active).toBe(true);
  });
});