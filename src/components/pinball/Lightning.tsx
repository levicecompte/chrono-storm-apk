import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface Arc {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number; // seconds (performance clock)
  life: number;
}

const SEGMENTS = 14;

// Procedural branching Tesla arcs — regenerated every ~40ms while alive.
export function LightningArcs({ arcs }: { arcs: React.MutableRefObject<Arc[]> }) {
  const group = useRef<THREE.Group>(null);
  const pool = useMemo(
    () =>
      Array.from({ length: 12 }, () => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3));
        const mat = new THREE.LineBasicMaterial({
          color: "#bfe6ff",
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        return line;
      }),
    []
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const now = performance.now() / 1000;
    pool.forEach((line, i) => {
      const arc = arcs.current[i];
      const mat = line.material as THREE.LineBasicMaterial;
      if (!arc || now - arc.t0 > arc.life) {
        mat.opacity = 0;
        return;
      }
      const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let s = 0; s < SEGMENTS; s++) {
        const t = s / (SEGMENTS - 1);
        const x = THREE.MathUtils.lerp(arc.from.x, arc.to.x, t);
        const y = THREE.MathUtils.lerp(arc.from.y, arc.to.y, t);
        const z = THREE.MathUtils.lerp(arc.from.z, arc.to.z, t);
        const jitter = s === 0 || s === SEGMENTS - 1 ? 0 : 0.55;
        pos.setXYZ(
          s,
          x + (Math.random() - 0.5) * jitter,
          y + (Math.random() - 0.5) * jitter + Math.sin(t * Math.PI) * 0.6,
          z + (Math.random() - 0.5) * jitter
        );
      }
      pos.needsUpdate = true;
      const k = 1 - (now - arc.t0) / arc.life;
      mat.opacity = 0.4 + k * 0.6;
    });
  });

  return (
    <group ref={group}>
      {pool.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}
