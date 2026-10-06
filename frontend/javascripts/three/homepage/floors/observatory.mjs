/* F9 天文台：空稿骨架，详细设计见 .documents/首页设计/第九层天文台设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-observatory";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
