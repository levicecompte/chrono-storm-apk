import { describe, expect, it } from "vitest";
import { createSim, recoverStuckBall, stepSim, TABLE, FLIPPER_UP, type BallState } from "./physics";

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
    const b = ball(-3.6, 15.45);
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
    expect(b.vx).toBeCloseTo(45, 1);
  });
});