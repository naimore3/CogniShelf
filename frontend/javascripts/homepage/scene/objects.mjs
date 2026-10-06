import * as THREE from "three";

/**
 * 场景内容：灯光 + 物体。
 * @returns {{ group: THREE.Group, box: THREE.Mesh }}
 *   group 用于挂进 scene；box 是当前唯一可动画的物体。
 */
export function createObjects() {
  const group = new THREE.Group();

  group.add(new THREE.AmbientLight(0xffffff, 1.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3, 5, 4);
  group.add(keyLight);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.42 })
  );
  group.add(box);

  return { group, box };
}
