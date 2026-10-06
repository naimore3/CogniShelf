/* F4 咖啡馆：空稿骨架，详细设计见 .documents/首页设计/第四层咖啡馆设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-cafe";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
