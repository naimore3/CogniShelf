/* 楼层内部管理器：按当前楼层懒加载 floors/ 下的单层组件，只挂载当前层与邻层（±1 窗口）；
   楼层滑出窗口立即卸载（dispose + 移出场景），任意时刻内存中最多只有三间房的单层组件。 */

export function buildInteriors(THREE, materials, floors) {
  const group = new THREE.Group();
  group.name = "nmd-floor-interiors";
  const instances = new Map();
  const pending = new Set();
  let activeFloor = 0;
  /* 最近一次主题 tokens：挂载后的组件立即按它换色，
     保证 prefers-reduced-motion（rAF 循环不启动）下首帧调色板也是正确的。 */
  let lastTokens = {};

  function enableShadows(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      const material = object.material;
      object.castShadow = !(material && material.transparent);
      object.receiveShadow = true;
    });
  }

  function neighbours(floor) {
    const index = floors.findIndex((item) => item.floor === Number(floor));
    if (index < 0) return [Number(floor)];
    return [index - 1, index, index + 1]
      .filter((value) => value >= 0 && value < floors.length)
      .map((value) => floors[value].floor);
  }

  async function mount(item) {
    if (!item || !item.load || instances.has(item.id) || pending.has(item.id)) return;
    pending.add(item.id);
    try {
      const module = await item.load();
      if (!module || typeof module.createFloor !== "function") return;
      const instance = module.createFloor(THREE, materials);
      /* 动态 import 期间楼层可能已滑出 ±1 窗口（setActiveFloor 挂载的是当时的窗口）：
         过期实例直接销毁，不挂进场景，避免卸载规则被异步竞态打破。 */
      if (!neighbours(activeFloor).includes(item.floor)) {
        if (typeof instance.dispose === "function") instance.dispose();
        return;
      }
      instance.group.name = `nmd-floor-${item.id}`;
      instance.group.position.set(item.position[0], item.position[1], item.position[2]);
      instance.group.visible = true;
      enableShadows(instance.group);
      group.add(instance.group);
      instances.set(item.id, { item, instance });
      /* 挂载即按当前主题换色，不等下一帧 rAF（reduce 模式可能没有下一帧）。 */
      if (typeof instance.update === "function") instance.update(0, lastTokens);
    } finally {
      pending.delete(item.id);
    }
  }

  function unmount(item, instance) {
    instances.delete(item.id);
    if (typeof instance.dispose === "function") instance.dispose();
    group.remove(instance.group);
  }

  function setActiveFloor(floor) {
    activeFloor = Number(floor) || 0;
    const wanted = neighbours(activeFloor);

    instances.forEach(({ item, instance }) => {
      if (wanted.includes(item.floor)) {
        instance.group.visible = true;
        return;
      }
      /* 滑出 ±1 窗口：立即卸载，释放该层几何与材质实例；再次进入窗口时按需重建。 */
      unmount(item, instance);
    });

    wanted.forEach((value) => {
      mount(floors.find((item) => item.floor === value));
    });
  }

  function update(delta, tokens) {
    if (tokens) lastTokens = tokens;
    instances.forEach(({ instance }) => {
      if (typeof instance.update === "function") instance.update(delta, lastTokens);
    });
  }

  function dispose() {
    instances.forEach(({ instance }) => {
      if (typeof instance.dispose === "function") instance.dispose();
    });
    instances.clear();
    pending.clear();
    group.clear();
  }

  return { group, setActiveFloor, update, dispose };
}
