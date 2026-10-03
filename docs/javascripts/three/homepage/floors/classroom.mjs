/* F6 教室：空稿骨架，详细设计见 .documents/首页设计/第六层教室设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-classroom";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
