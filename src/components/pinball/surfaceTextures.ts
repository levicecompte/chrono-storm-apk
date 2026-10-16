import * as THREE from "three";

// Shared, deterministic surface maps: no remote texture requests.
export function makeSurfaceTexture(kind: "metal" | "rubber" | "stone"): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = ((x * 73 + y * 151 + x * y * 19) % 97) / 97;
      const scratch = kind === "metal" && (y % 17 === 0 || (x + y * 3) % 91 === 0);
      const seam = kind === "stone" && (y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 2);
      const value = seam ? 75 : scratch ? 135 : Math.round(185 + noise * (kind === "rubber" ? 40 : 65));
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export type SurfaceTextures = { metal: THREE.Texture; rubber: THREE.Texture; stone: THREE.Texture };