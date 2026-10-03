/* 主页相机 rig：所有房间共享同一个局部机位，镜头沿右上—左下房间链平移。
   镜头固定在房间左顶角外侧、沿左顶角向内看；机位水平偏移沿链的地面投影，
   因此所有机位都落在过链的同一竖直面上。只有 descend 段在相邻机位间过渡。 */

import {
  getChainBounds,
  getFloorPosition,
  getNextFloor,
  getNextFloorPosition,
  ROOM_CAMERA
} from "./floor-registry.mjs";

const COVER_MARGIN = 1.18;

export function createCameraRig(THREE, camera) {
  const targetPosition = new THREE.Vector3();
  const targetLookAt = new THREE.Vector3();
  const currentLookAt = new THREE.Vector3();
  const reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  let currentState = { floor: 0, local: 0, phase: "hold", phaseT: 0 };

  function framing() {
    const aspect = Math.max(0.5, camera.aspect || 1);
    const portrait = aspect < 0.9;
    return {
      fov: portrait ? ROOM_CAMERA.fov + 4 : ROOM_CAMERA.fov,
      distanceScale: portrait ? 1.02 : 1
    };
  }

  function roomPose(position) {
    const frame = framing();
    const [x, y, z] = position;
    return {
      position: new THREE.Vector3(
        x + ROOM_CAMERA.offset[0] * frame.distanceScale,
        y + ROOM_CAMERA.offset[1] * frame.distanceScale,
        z + ROOM_CAMERA.offset[2] * frame.distanceScale
      ),
      lookAt: new THREE.Vector3(
        x + ROOM_CAMERA.lookAt[0],
        y + ROOM_CAMERA.lookAt[1],
        z + ROOM_CAMERA.lookAt[2]
      )
    };
  }

  function coverPose() {
    const frame = framing();
    const bounds = getChainBounds();
    const tan = Math.tan(THREE.MathUtils.degToRad(frame.fov / 2));
    const aspect = Math.max(0.6, camera.aspect || 1);
    const distanceY = (bounds.spanY * 0.5 * COVER_MARGIN) / tan;
    const distanceX = (bounds.spanX * 0.5 * COVER_MARGIN) / (tan * aspect);
    const distance = Math.max(60, distanceX, distanceY);
    return {
      position: new THREE.Vector3(
        bounds.centerX,
        bounds.centerY + 1.5,
        bounds.centerZ + distance
      ),
      lookAt: new THREE.Vector3(bounds.centerX, bounds.centerY, bounds.centerZ)
    };
  }

  function poseFor(state) {
    if (state.floor === 0) {
      const from = coverPose();
      if (state.phase === "hold") {
        targetPosition.copy(from.position);
        targetLookAt.copy(from.lookAt);
        return;
      }

      const to = roomPose(getFloorPosition(10));
      const t = state.phaseT;
      targetPosition.lerpVectors(from.position, to.position, t);
      targetPosition.y += Math.sin(t * Math.PI) * 1.8;
      targetLookAt.lerpVectors(from.lookAt, to.lookAt, t);
      return;
    }

    const current = roomPose(getFloorPosition(state.floor));
    if (state.phase === "hold") {
      targetPosition.copy(current.position);
      targetLookAt.copy(current.lookAt);
      return;
    }

    const nextFloor = getNextFloor(state.floor);
    if (nextFloor === state.floor) {
      targetPosition.copy(current.position);
      targetLookAt.copy(current.lookAt);
      return;
    }

    const next = roomPose(getNextFloorPosition(state.floor));
    const t = state.phaseT;
    targetPosition.lerpVectors(current.position, next.position, t);
    targetPosition.x += Math.sin(t * Math.PI) * 1.4;
    targetPosition.y += Math.sin(t * Math.PI) * 1.2;
    targetLookAt.lerpVectors(current.lookAt, next.lookAt, t);
  }

  function setState(state) {
    currentState = state || currentState;
    poseFor(currentState);
    if (reducedMotion) {
      camera.position.copy(targetPosition);
      currentLookAt.copy(targetLookAt);
      camera.lookAt(currentLookAt);
    }
  }

  function update(delta) {
    const damping = reducedMotion ? 1 : Math.min(1, delta * 5.5);
    camera.position.lerp(targetPosition, damping);
    currentLookAt.lerp(targetLookAt, damping);
    camera.lookAt(currentLookAt);
  }

  function frame() {
    camera.fov = framing().fov;
    camera.updateProjectionMatrix();
  }

  camera.fov = framing().fov;
  camera.updateProjectionMatrix();

  return {
    camera,
    setState,
    update,
    frame,
    get state() { return currentState; }
  };
}
