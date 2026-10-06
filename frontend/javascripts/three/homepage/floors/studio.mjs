/* F8 工作室：空稿骨架，详细设计见 .documents/首页设计/第八层工作室设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-studio";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
