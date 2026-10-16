import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BONUS_TUNNELS, CENTER_POST, type SimState } from "../../game/physics";
import type { SurfaceTextures } from "./surfaceTextures";

export function BonusTunnels({ surfaces, sim }: { surfaces: SurfaceTextures; sim: React.RefObject<SimState> }) {
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    lamps.current.forEach((material, index) => {
      if (material) material.emissiveIntensity = sim.current.balls.some((b) => b.tunnel?.index === index) ? 2 : 0.35;
    });
  });
  return <>
    {BONUS_TUNNELS.map((t, i) => <group key={i} name={`bonus-tunnel-${i}`} position={[t.x, 0, t.z]}>
      <mesh position={[0, 0.45, -t.length / 2]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.95, 0.95, t.length, 16, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial map={surfaces.stone} color={t.upper ? "#777f76" : "#865b50"} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.91, 0.23, -t.length / 2]}>
        <boxGeometry args={[0.14, 0.46, t.length]} />
        <meshStandardMaterial map={surfaces.stone} color="#777f76" roughness={0.85} />
      </mesh>)}
      {[0, -t.length].map((z) => <mesh key={z} position={[0, 0.45, z]}>
        <torusGeometry args={[0.95, 0.09, 6, 16, Math.PI]} />
        <meshStandardMaterial map={surfaces.metal} color="#c8b47c" metalness={0.8} roughness={0.35} />
      </mesh>)}
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial ref={(m) => { lamps.current[i] = m; }} map={surfaces.rubber} color="#ffc46b" emissive="#ffb65c" emissiveIntensity={0.35} />
      </mesh>
    </group>)}
    <group name="center-rebound-nail" position={[CENTER_POST.x, 0, CENTER_POST.z]}>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[CENTER_POST.r, CENTER_POST.r, 1.3, 10]} />
        <meshStandardMaterial map={surfaces.metal} color="#c4c8ca" metalness={0.95} roughness={0.22} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.09, 10]} />
        <meshStandardMaterial map={surfaces.metal} color="#d4b868" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  </>;
}