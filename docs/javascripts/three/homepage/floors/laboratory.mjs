/* F7 实验室：空稿骨架，详细设计见 .documents/首页设计/第七层实验室设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-laboratory";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
