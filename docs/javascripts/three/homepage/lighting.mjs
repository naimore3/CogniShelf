/* 房间灯组：每间房复制同一份本地灯位，主光 / 补光 / 反弹光都只朝本房间内打。
   灯组不挂在房间结构上，而是按房间中心独立摆放；可见性与主光阴影的投射范围都与当前层 ±1 同步（邻层阴影提前渲染，换层不跳变）。
   聚光角度与距离负责把光限制在本房间，舞台环境底光只负责抬起暗部，避免死黑。 */

import { FLOORS } from "./floor-registry.mjs";

const RIG = {
  key: {
    position: [-2.45, 3.7, 3.35],
    target: [0, -0.05, 0],
    angle: 0.6,
    penumbra: 0.78,
    distance: 10.5,
    decay: 1.05,
    intensity: { light: 8.2, dark: 13 },
    color: { light: "#fff1dd", dark: "#ffd9a8" }
  },
  fill: {
    position: [0.9, 1.25, 3.85],
    target: [-0.15, -0.1, -0.15],
    angle: 0.9,
    penumbra: 0.9,
    distance: 9.5,
    decay: 1,
    intensity: { light: 2.9, dark: 5.2 },
    color: { light: "#e8f2ff", dark: "#9fc4ff" }
  },
  bounce: {
    position: [-1.3, 0.2, 2.2],
    target: [0.2, 0.1, -0.6],
    angle: 0.95,
    penumbra: 0.95,
    distance: 7.5,
    decay: 1,
    intensity: { light: 1.6, dark: 3.2 },
    color: { light: "#f2e8ff", dark: "#c69cff" }
  }
};

function toColor(THREE, value, fallback) {
  try {
    return new THREE.Color(value || fallback);
  } catch (error) {
    return new THREE.Color(fallback);
  }
}

export function createRoomLighting(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = "nmd-room-lighting";

  const rigs = new Map();
  const rooms = FLOORS.filter((item) => item.floor !== 0);
  const shadowsEnabled = options.shadows !== false;

  const stageLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0);
  stageLight.name = "nmd-stage-fill";
  stageLight.position.set(0, 1, 0);
  group.add(stageLight);

  function createSpotFrom(spec) {
    const light = new THREE.SpotLight(0xffffff, 0);
    light.position.set(spec.position[0], spec.position[1], spec.position[2]);
    light.angle = spec.angle;
    light.penumbra = spec.penumbra;
    light.distance = spec.distance;
    light.decay = spec.decay;

    const target = new THREE.Object3D();
    target.position.set(spec.target[0], spec.target[1], spec.target[2]);
    light.target = target;
    return { light, target };
  }

  rooms.forEach((item, index) => {
    const rig = new THREE.Group();
    rig.name = `nmd-lights-${item.id}`;
    rig.position.set(item.position[0], item.position[1], item.position[2]);
    rig.userData.orderIndex = index;

    const key = createSpotFrom(RIG.key);
    key.light.name = `nmd-key-${item.id}`;
    key.light.castShadow = false;
    key.light.shadow.mapSize.set(512, 512);
    key.light.shadow.camera.near = 1;
    key.light.shadow.camera.far = 12;
    key.light.shadow.bias = -0.0005;
    key.light.shadow.normalBias = 0.02;
    key.light.shadow.radius = 2;
    rig.add(key.light, key.target);

    const fill = createSpotFrom(RIG.fill);
    fill.light.name = `nmd-fill-${item.id}`;
    rig.add(fill.light, fill.target);

    const bounce = createSpotFrom(RIG.bounce);
    bounce.light.name = `nmd-bounce-${item.id}`;
    rig.add(bounce.light, bounce.target);

    group.add(rig);
    rigs.set(item.floor, {
      rig,
      key: key.light,
      fill: fill.light,
      bounce: bounce.light,
      orderIndex: index
    });
  });

  function update(tokens = {}) {
    const dark = tokens.scheme && tokens.scheme !== "default";
    const mode = dark ? "dark" : "light";

    rigs.forEach(({ key, fill, bounce }) => {
      key.color.copy(toColor(THREE, tokens.roomKeyLight, RIG.key.color[mode]));
      key.intensity = RIG.key.intensity[mode];

      fill.color.copy(toColor(THREE, tokens.roomFillLight, RIG.fill.color[mode]));
      fill.intensity = RIG.fill.intensity[mode];

      bounce.color.copy(toColor(THREE, tokens.roomBounceLight, RIG.bounce.color[mode]));
      bounce.intensity = RIG.bounce.intensity[mode];
    });

    stageLight.color.copy(toColor(THREE, tokens.stageFill, dark ? "#5a3d9c" : "#ffffff"));
    stageLight.groundColor.copy(toColor(THREE, tokens.stage, dark ? "#160f2b" : "#f4effa"));
    stageLight.intensity = dark ? 0.55 : 0.27;
  }

  function setActiveFloor(floor) {
    const overview = floor === 0;
    const activeIndex = overview
      ? -1
      : rooms.findIndex((item) => item.floor === Number(floor));

    // 封面能同时看到全部房间：只开主光，避免 30 盏聚光灯一起参与着色；
    // 顶楼 F10 保留完整灯组，cover → F10 的衔接不会突然换光。
    rigs.forEach(({ rig, key, fill, bounce, orderIndex }, roomFloor) => {
      const visible = overview || Math.abs(orderIndex - activeIndex) <= 1;
      const fullRig = !overview || roomFloor === 10;
      rig.visible = visible;
      key.visible = visible;
      // ±1 窗口内所有主光都提前投射阴影（阴影预加载）：换层瞬间前后邻房的
      // shadow map 已就绪，不会再出现「刚看到邻房没影、落脚才突然生效」的跳变。
      key.castShadow = shadowsEnabled && visible && !overview;
      fill.visible = visible && fullRig;
      bounce.visible = visible && fullRig;
    });
  }

  function dispose() {
    group.clear();
    rigs.clear();
  }

  return { group, update, setActiveFloor, dispose };
}
