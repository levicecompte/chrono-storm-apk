import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Scene } from "./Scene";
import { HUD } from "./HUD";

export function GameCanvas() {
  return (
    <div className="fixed inset-0 bg-background">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 56, 48], fov: 27, near: 1, far: 200 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 1)}
      >
        <Scene />
        <EffectComposer>
          <Bloom intensity={0.55} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette darkness={0.55} offset={0.25} />
        </EffectComposer>
      </Canvas>
      <HUD />
    </div>
  );
}
