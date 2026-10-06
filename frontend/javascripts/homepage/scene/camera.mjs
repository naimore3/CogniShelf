import * as THREE from "three";

/** 主页场景的观察相机。 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 5.2);
  camera.lookAt(0, 0, 0);
  return camera;
}
