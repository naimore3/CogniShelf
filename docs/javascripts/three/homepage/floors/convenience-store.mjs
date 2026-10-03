/* F3 便利店：空稿骨架，详细设计见 .documents/首页设计/第三层便利店设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-store";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
