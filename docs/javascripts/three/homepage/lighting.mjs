/* 房间灯组：每间房复制同一份本地灯位，主光 / 补光 / 反弹光都只朝本房间内打。
   灯组不挂在房间结构上，而是按房间中心独立摆放；可见性与主光阴影的投射范围都与当前层 ±1 同步（邻层阴影提前渲染，换层不跳变）。

   风格口径（2026-10-03 起）：柔光玩具棚拍 —— 大面积柔主光（宽锥角 + penumbra 1 +
   弱距离衰减）抬亮整间房，半球环境光把暗部抬起来，哑光塑料的柔和明暗另外由
   scene.environment 的 IBL 塑形。阴影改用 VSM + 2048 贴图 + radius 4，边缘才是软的。
   锥角必须控制在 0.8 rad 以内：房间链的下一间在灯位视角里大约偏离 44°，再宽就会
   把邻房的墙打亮，出现跨房间漏光。 */

import { FLOORS } from "./floor-registry.mjs";

const RIG = {
  key: {
    position: [-2.3, 4.4, 2.7],
    target: [0, -0.15, 0],
    angle: 0.74,
    penumbra: 1,
    distance: 9.5,
    decay: 0.75,
    intensity: { light: 3.4, dark: 5 },
    color: { light: "#fff7ec", dark: "#ffe6bd" }
  },
  fill: {
    position: [1.9, 1.6, 3.6],
    target: [-0.1, -0.1, -0.1],
    angle: 0.9,
    penumbra: 1,
    distance: 8.5,
    decay: 0.75,
    intensity: { light: 1.2, dark: 1.8 },
    color: { light: "#eef4ff", dark: "#a8c4ff" }
  },
  bounce: {
    position: [-1.5, -0.9, 2.4],
    target: [0.2, 0.1, -0.5],
    angle: 0.95,
    penumbra: 1,
    distance: 7,
    decay: 0.75,
    intensity: { light: 0.7, dark: 1.1 },
    color: { light: "#f7efff", dark: "#c9a6ff" }
  }
};

const SHADOW = {
  mapSize: 2048,
  near: 1,
  far: 12,
  bias: -0.0005,
  normalBias: 0.02,
  radius: 4,
  blurSamples: 10
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
    key.light.shadow.mapSize.set(SHADOW.mapSize, SHADOW.mapSize);
    key.light.shadow.camera.near = SHADOW.near;
    key.light.shadow.camera.far = SHADOW.far;
    key.light.shadow.bias = SHADOW.bias;
    key.light.shadow.normalBias = SHADOW.normalBias;
    key.light.shadow.radius = SHADOW.radius;
    key.light.shadow.blurSamples = SHADOW.blurSamples;
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

  /* 半球环境光的色与强度都随主题走；强度口径与顶光同一量级，
     让哑光塑料的最暗面也留在 18% 亮度以上，不出现死黑。 */
  const STAGE_FILL = { light: 0.25, dark: 0.5 };

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
    stageLight.intensity = STAGE_FILL[mode];
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
