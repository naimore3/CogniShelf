/* F5 音乐室：空稿骨架，详细设计见 .documents/首页设计/第五层音乐室设计.md。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-music";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
