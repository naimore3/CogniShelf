/* F2 图书馆：空稿骨架，详细设计见 .documents/首页设计/第二层图书馆设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-library";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
