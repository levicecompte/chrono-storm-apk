import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Scene } from "./Scene";
import { HUD } from "./HUD";

export function GameCanvas() {
  return (
    <div className="fixed inset-0 bg-background">
      <div className="absolute inset-x-0 bottom-0 top-40">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 56, 48], fov: 27, near: 1, far: 200 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 1)}
      >
        <Suspense fallback={null}><Scene /></Suspense>
      </Canvas>
      </div>
      <HUD />
    </div>
  );
}
