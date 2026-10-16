import { useMemo } from "react";
import * as THREE from "three";

export function VintageRails() {
  const paths = useMemo(() => [-1, 1].map((side) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 5.6, 0.8, 14),
    new THREE.Vector3(side * 8.7, 0.8, 8),
    new THREE.Vector3(side * 9.1, 0.8, -7),
    new THREE.Vector3(side * 7.8, 0.8, -17),
    new THREE.Vector3(side * 3.8, 0.8, -21),
    new THREE.Vector3(0, 0.8, -21.7),
  ])), []);
  return <>
    {paths.map((curve, i) => <mesh key={i}>
      <tubeGeometry args={[curve, 64, 0.18, 8, false]} />
      <meshStandardMaterial color="#b9bec3" metalness={0.95} roughness={0.26} />
    </mesh>)}
    {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((i) =>
      <mesh key={`${side}-${i}`} position={[side * 5.5, 0.12, 1.5 + i * 2.8]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.42, 20]} />
        <meshStandardMaterial color={side === -1 ? "#b99946" : "#6e9d58"} emissive={side === -1 ? "#ffb65c" : "#729956"} emissiveIntensity={0.45} roughness={0.35} />
      </mesh>))}
  </>;
}