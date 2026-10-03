/* F1 汉堡店：空稿骨架，详细设计见 .documents/首页设计/第一层汉堡店设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-burger";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
