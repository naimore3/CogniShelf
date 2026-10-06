/* F0 封面楼层：房间群结构总览与开场机位。详细设计见 .documents/首页设计/封面场景.md（待产出）。 */
export function createFloor(THREE) {
  const group = new THREE.Group();
  group.name = "nmd-floor-cover";
  return {
    group,
    update() {},
    dispose() { group.clear(); }
  };
}
