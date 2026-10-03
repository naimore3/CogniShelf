/* 第十层 · 屋顶露台（v4.0 · 柔光玩具棚拍 / soft-lit designer-toy diorama）
   ------------------------------------------------------------------
   契约：只写房间本地坐标，返回 { group, update, dispose }；落位由
   interior-builder 按 floor-registry 的 position 完成，本层不碰 scene。

   风格口径见：
   - .documents/首页设计/第十层屋顶露台设计.md v4.0
   - .documents/首页设计/场景设计概述.md v3.13 §5.2.1

   与 v3.0 的差别：取消渐变天空幕布 / 日轮 / 城市剪影 / 星野 / 云带 / 飞鸟 /
   漂浮双岛与支撑腿 / 踏步石阵列。全部构件改为圆角箱 + 哑光塑料，明暗交给
   scene.environment 与大面积柔主光，一根描边线都不画（EdgesGeometry 与
   LineBasicMaterial 在本层命中数为 0）。

   主题：材质按「一套材质 × 亮暗两色」登记，主题切换时只改 .color / .emissive；
   材质由材质库持有并统一 dispose，本层只释放自己造的几何。
   ============================================================= */
import { createShapeKit } from "../scene-kit.mjs";

const GROUP_NAME = "nmd-floor-roof";

/* 房间本地基准面。地板顶 = -1.36；木地板铺在上面，水台再铺在木地板上。 */
const FLOOR_TOP = -1.36;
const DECK_THICKNESS = 0.07;
const DECK_TOP = FLOOR_TOP + DECK_THICKNESS;
const MAT_THICKNESS = 0.03;
const MAT_TOP = DECK_TOP + MAT_THICKNESS;
const BACK_INNER_Z = -1.28;
const RIGHT_INNER_X = 1.28;

/* 色板：[亮色, 暗色]。舞台与房间壳由 CSS token 驱动，这里只管本层构件。 */
const PALETTE = {
  panelBack: ["#ef4d86", "#9a3a63"],
  panelSide: ["#fff4ea", "#6b5788"],
  deck: ["#ecd3b4", "#7a5c72"],
  deckSeam: ["#dcbf9e", "#68496b"],
  mat: ["#4fd1c5", "#2fbdb4"],
  glint: ["#a8f0e6", "#7ff0e4"],
  cream: ["#fffaf3", "#f6efff"],
  canopyA: ["#ff7f3f", "#ff9b62"],
  canopyB: ["#fff3e8", "#f7efff"],
  pole: ["#e7d5c2", "#c9b4e0"],
  wood: ["#dcae7e", "#c99871"],
  cushionA: ["#8b5cf6", "#b98cff"],
  cushionB: ["#ffc94d", "#ffd772"],
  leaf: ["#2f9e73", "#57c99a"],
  leafLight: ["#6fd3a6", "#9ae6c6"],
  cactus: ["#3fc79a", "#4fd8ad"],
  pot: ["#e2825f", "#d98a6c"],
  soil: ["#6b4a3a", "#4a3550"],
  lantern: ["#fff6e6", "#ffeec9"],
  cord: ["#b99a78", "#8a7aa8"],
  purple: ["#7c5cf0", "#a88cff"],
  teal: ["#3ec9c0", "#5ce0d6"],
  paper: ["#fffdf7", "#f2ecff"],
  magenta: ["#f0477f", "#ff5c8a"],
  shadow: ["#362a48", "#0b0714"]
};

/* 灯笼芯：亮暗各给一个自发光色，强度再乘主题系数与呼吸系数。 */
const GLOW = { lantern: ["#ffc65a", "#ffd06e"] };

/* 材质库实例 → 共享材质包。材质随库走，**不能每层挂载都新建**：
   materials.plastic() 会把材质压进库级数组且只在库 dispose 时释放，
   若每次 createFloor 都新建，就会随滚动重挂载线性泄漏。 */
const bundleCache = new WeakMap();

function getBundle(THREE, materials) {
  const cached = bundleCache.get(materials);
  if (cached) return cached;

  const entries = [];
  const glows = [];
  const tinted = (key, options) => {
    const material = materials.plastic(PALETTE[key][0], options);
    entries.push([material, PALETTE[key][0], PALETTE[key][1]]);
    return material;
  };

  const material = {
    panelBack: tinted("panelBack"),
    panelSide: tinted("panelSide"),
    deck: tinted("deck"),
    deckSeam: tinted("deckSeam"),
    mat: tinted("mat"),
    glint: tinted("glint", { transparent: true, opacity: 0.55, depthWrite: false }),
    cream: tinted("cream"),
    canopy: tinted("canopyA", { vertexColors: true, side: THREE.DoubleSide }),
    pole: tinted("pole"),
    wood: tinted("wood"),
    cushionA: tinted("cushionA"),
    cushionB: tinted("cushionB"),
    leaf: tinted("leaf"),
    leafLight: tinted("leafLight"),
    cactus: tinted("cactus"),
    pot: tinted("pot"),
    soil: tinted("soil"),
    cord: tinted("cord"),
    purple: tinted("purple"),
    teal: tinted("teal"),
    paper: tinted("paper"),
    magenta: tinted("magenta")
  };

  /* 灯笼布：自发光单独登记，按主题换 emissive 与强度。 */
  material.lantern = materials.plastic(PALETTE.lantern[0], {
    emissive: GLOW.lantern[0],
    emissiveIntensity: 0.5
  });
  entries.push([material.lantern, PALETTE.lantern[0], PALETTE.lantern[1]]);
  glows.push([material.lantern, GLOW.lantern[0], GLOW.lantern[1]]);

  /* 接触阴影贴片材质：颜色即阴影色，顶点色只提供 alpha 衰减，故 vertexColors 必开。 */
  const decal = materials.plastic(PALETTE.shadow[0], {
    vertexColors: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const bundle = { material, entries, glows, decal, mode: -1 };
  bundleCache.set(materials, bundle);
  return bundle;
}

/* 圆角壶身（花盆）：LatheGeometry 一条圆角剖面绕轴旋转，顶面自带浅碟。
   两处倒角都用参数化圆弧生成，倒角与侧壁之间才是连续明暗。 */
function makePotGeometry(THREE, radius, height, fillet, segments) {
  const points = [new THREE.Vector2(0, 0)];
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    points.push(new THREE.Vector2(
      radius - fillet + Math.cos(a) * fillet,
      fillet + Math.sin(a) * fillet
    ));
  }
  points.push(new THREE.Vector2(radius, height - fillet));
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * (Math.PI / 2);
    points.push(new THREE.Vector2(
      radius - fillet + Math.cos(a) * fillet,
      height - fillet + Math.sin(a) * fillet
    ));
  }
  points.push(new THREE.Vector2(radius * 0.66, height - fillet * 0.5));
  points.push(new THREE.Vector2(0, height - fillet * 1.6));
  return new THREE.LatheGeometry(points, segments);
}

/* 伞面：按「顶圈 → 中圈 → 伞沿」三圈采样，两侧各自展开成三角，逐楔形写顶点色，
   于是条纹不需要任何贴图与第二份材质。返回的几何带 color 属性，主题切换时
   由 applyCanopyColors 逐楔形重写，楔形数一改也不会错位。 */
function buildCanopy(THREE, radius, height, segments, topRadius) {
  const ringR = [topRadius, radius * 0.62, radius];
  const ringY = [height, height * 0.46, 0];
  const positions = [];
  const colors = [];
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const wedge = Math.floor(i / 2) % 2;
    for (let k = 0; k < 2; k += 1) {
      const r0 = ringR[k];
      const y0 = ringY[k];
      const r1 = ringR[k + 1];
      const y1 = ringY[k + 1];
      const p00 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0];
      const p01 = [Math.cos(a0) * r1, y1, Math.sin(a0) * r1];
      const p10 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0];
      const p11 = [Math.cos(a1) * r1, y1, Math.sin(a1) * r1];
      positions.push(...p00, ...p11, ...p01, ...p00, ...p10, ...p11);
      for (let n = 0; n < 6; n += 1) colors.push(wedge, 0, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createFloor(THREE, materials) {
  const group = new THREE.Group();
  group.name = GROUP_NAME;

  const kit = createShapeKit(THREE);
  const bundle = getBundle(THREE, materials);
  const material = bundle.material;
  const owned = [];
  const keep = (geometry) => {
    owned.push(geometry);
    return geometry;
  };

  const animated = { lanterns: [], leaves: [], glints: [] };
  let canopyGeometry = null;
  let localMode = -1;

  /* ---------- 通用挂载 ---------- */
  function attach(parent, geometry, target, position, rotation, scale) {
    const mesh = new THREE.Mesh(geometry, target);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    parent.add(mesh);
    return mesh;
  }

  /* 圆角箱：尺寸即实际宽高深，圆角半径交给 scene-kit 统一夹取。 */
  function box(parent, target, size, position, rotation, radius) {
    return attach(parent, kit.roundedBox(size[0], size[1], size[2], radius), target, position, rotation);
  }

  /* 落影贴片：铺在木地板面上，半径＝道具水平外接半径 × 1.15。
     移动端 shadowMap 被 qualityProfile() 关闭时，它是唯一的落地感来源。 */
  function contact(parent, radius, x, z, y) {
    return attach(
      parent,
      kit.shadowDecal(radius),
      bundle.decal,
      [x, y == null ? DECK_TOP + 0.002 : y, z]
    );
  }

  function cylinder(parent, target, radiusTop, radiusBottom, height, segments, position, rotation) {
    return attach(
      parent,
      keep(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)),
      target,
      position,
      rotation
    );
  }

  function blob(parent, target, radius, position, scale, segments) {
    const detail = segments || 14;
    return attach(
      parent,
      keep(new THREE.SphereGeometry(radius, detail, detail - 2)),
      target,
      position,
      null,
      scale
    );
  }

  /* 花盆：壶身 + 奶油盆沿 + 土面，三件套。extra 回调拿盆高继续长植株。 */
  function pot(parent, x, z, radius, height, baseY, extra) {
    const host = new THREE.Group();
    host.position.set(x, baseY, z);
    parent.add(host);
    attach(host, keep(makePotGeometry(THREE, radius, height, radius * 0.28, 20)), material.pot);
    attach(
      host,
      keep(new THREE.TorusGeometry(radius * 1.01, radius * 0.085, 8, 22)),
      material.cream,
      [0, height - radius * 0.20, 0],
      [Math.PI / 2, 0, 0]
    );
    attach(
      host,
      keep(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.02, 20)),
      material.soil,
      [0, height - radius * 0.5, 0]
    );
    if (extra) extra(host, height);
    return host;
  }

  /* ---------- §1 墙面大色块 ----------
     背墙色块是整间房的主色块（参考图里那面品红墙的角色），右墙色块压住侧向空白。
     两块都贴在各自墙的内面上，四周留一圈房间壳的浅色边框。 */
  box(group, material.panelBack, [2.62, 2.56, 0.07], [0, 0.12, BACK_INNER_Z + 0.035], null, 0.06);
  box(group, material.panelSide, [0.07, 2.30, 2.62], [RIGHT_INNER_X - 0.035, 0.12, 0], null, 0.06);

  /* 右墙搁板：对应参考图左墙那组「层板上摆小物」的情节，给素色结构面一点内容。
     板只到墙内面为止，不向房内多伸（最内侧 1.18，仍在安全盒 1.22 以内）。 */
  const SHELF_X = RIGHT_INNER_X - 0.055;
  const SHELF_Y = 0.42;
  box(group, material.cream, [0.10, 0.05, 1.30], [SHELF_X, SHELF_Y, -0.22], null, 0.02);
  pot(group, SHELF_X, -0.66, 0.075, 0.11, SHELF_Y + 0.025, (host, height) => {
    blob(host, material.leaf, 0.085, [0, height + 0.06, 0], [1, 0.7, 1], 12);
    blob(host, material.leafLight, 0.058, [0.045, height + 0.115, 0.03], [1, 0.72, 1], 10);
  });
  cylinder(group, material.teal, 0.036, 0.030, 0.085, 14, [SHELF_X, SHELF_Y + 0.068, -0.16]);
  box(group, material.magenta, [0.11, 0.055, 0.15], [SHELF_X, SHELF_Y + 0.053, 0.16], [0, 0.5, 0], 0.012);
  box(group, material.paper, [0.10, 0.03, 0.14], [SHELF_X, SHELF_Y + 0.095, 0.16], [0, 0.16, 0], 0.01);

  /* ---------- §2 木地板 + 拼缝 ---------- */
  box(group, material.deck, [2.86, DECK_THICKNESS, 2.86], [0, DECK_TOP - DECK_THICKNESS / 2, 0], null, 0.07);
  for (let i = -3; i <= 3; i += 1) {
    box(group, material.deckSeam, [0.018, 0.008, 2.72], [i * 0.36, DECK_TOP + 0.001, 0], null, 0.004);
  }

  /* ---------- §3 薄荷青水台 + 碎光 ----------
     参考图里那块薄荷青地毯的角色：一块大面积高亮色块压住地板中心。 */
  box(group, material.mat, [1.94, MAT_THICKNESS, 1.66], [0.16, MAT_TOP - MAT_THICKNESS / 2, -0.05], null, 0.09);
  const glintSpec = [
    [-0.42, 0.30, 0.10], [-0.05, -0.42, 0.13], [0.34, 0.14, 0.09],
    [0.52, -0.30, 0.11], [-0.30, -0.06, 0.08]
  ];
  glintSpec.forEach((spec, index) => {
    const disc = attach(
      group,
      keep(new THREE.CylinderGeometry(spec[2], spec[2], 0.008, 18)),
      material.glint,
      [0.16 + spec[0], MAT_TOP + 0.004, -0.05 + spec[1]]
    );
    disc.userData.baseX = disc.position.x;
    disc.userData.baseZ = disc.position.z;
    disc.userData.phase = index * 0.7;
    animated.glints.push(disc);
  });
  blob(group, material.purple, 0.055, [0.14, MAT_TOP + 0.055, 0.57]);
  blob(group, material.teal, 0.045, [0.60, MAT_TOP + 0.045, 0.49]);
  blob(group, material.cream, 0.05, [0.22, MAT_TOP + 0.05, 0.65]);

  /* ---------- §4 背墙矮花箱 + 迷你绿植 ---------- */
  box(group, material.pot, [1.62, 0.24, 0.26], [0, DECK_TOP + 0.12, -1.08], null, 0.05);
  box(group, material.soil, [1.48, 0.03, 0.16], [0, DECK_TOP + 0.245, -1.08], null, 0.02);
  [-0.56, -0.20, 0.18, 0.54].forEach((x, index) => {
    const planter = new THREE.Group();
    planter.position.set(x, DECK_TOP + 0.25, -1.08);
    group.add(planter);
    const target = index % 2 === 0 ? material.leaf : material.leafLight;
    blob(planter, target, 0.11, [0, 0.09, 0], [1, 0.86, 1], 12);
    blob(planter, target, 0.075, [0.07, 0.16, 0.03], [1, 0.8, 1], 10);
    blob(planter, target, 0.065, [-0.07, 0.15, -0.04], [1, 0.8, 1], 10);
  });

  /* ---------- §5 遮阳伞 ----------
     伞面用顶点色条纹（24 段 / 每 2 段一换），伞骨不做线，靠圆角伞沿与顶珠收口。 */
  const UMBRELLA = { x: -0.58, z: 0.04, poleHeight: 1.55, canopyRadius: 0.62, canopyHeight: 0.30 };
  const umbrella = new THREE.Group();
  umbrella.position.set(UMBRELLA.x, DECK_TOP, UMBRELLA.z);
  group.add(umbrella);

  cylinder(umbrella, material.cream, 0.17, 0.20, 0.07, 22, [0, 0.035, 0]);
  cylinder(
    umbrella,
    material.pole,
    0.036,
    0.036,
    UMBRELLA.poleHeight,
    16,
    [0, 0.075 + UMBRELLA.poleHeight / 2, 0]
  );

  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(0, 0.075 + UMBRELLA.poleHeight - UMBRELLA.canopyHeight + 0.06, 0);
  umbrella.add(canopyGroup);
  canopyGeometry = keep(buildCanopy(THREE, UMBRELLA.canopyRadius, UMBRELLA.canopyHeight, 24, 0.075));
  attach(canopyGroup, canopyGeometry, material.canopy);
  attach(
    canopyGroup,
    keep(new THREE.TorusGeometry(UMBRELLA.canopyRadius, 0.022, 10, 40)),
    material.cream,
    [0, 0, 0],
    [Math.PI / 2, 0, 0]
  );
  blob(canopyGroup, material.cream, 0.052, [0, UMBRELLA.canopyHeight + 0.02, 0], null, 14);

  /* ---------- §6 两张躺椅 ---------- */
  function buildLounger(x, z, yaw, cushion) {
    const lounger = new THREE.Group();
    lounger.position.set(x, DECK_TOP, z);
    lounger.rotation.y = yaw;
    group.add(lounger);

    [-0.25, 0.25].forEach((rx) => {
      box(lounger, material.wood, [0.055, 0.055, 0.98], [rx, 0.115, 0], null, 0.02);
      [-0.42, 0.42].forEach((lz) => {
        box(lounger, material.wood, [0.05, 0.11, 0.05], [rx, 0.055, lz], null, 0.02);
      });
    });
    [-0.36, -0.12, 0.12, 0.36].forEach((lz) => {
      box(lounger, material.wood, [0.46, 0.028, 0.10], [0, 0.152, lz], null, 0.012);
    });

    box(lounger, cushion, [0.46, 0.07, 0.58], [0, 0.196, 0.16], null, 0.035);
    box(lounger, cushion, [0.46, 0.07, 0.44], [0, 0.345, -0.25], [-0.62, 0, 0], 0.035);
    box(lounger, material.cream, [0.30, 0.10, 0.15], [0, 0.30, -0.10], null, 0.045);
  }
  contact(group, 0.62, -0.80, 0.52);
  buildLounger(-0.80, 0.52, -0.18, material.cushionA);
  contact(group, 0.60, -0.14, 0.70);
  buildLounger(-0.14, 0.70, 0.13, material.cushionB);

  /* ---------- §7 边几 + 杯 + 摊开的书 ---------- */
  const table = new THREE.Group();
  table.position.set(0.44, DECK_TOP, 0.32);
  group.add(table);
  contact(group, 0.28, 0.44, 0.32);
  cylinder(table, material.cream, 0.17, 0.17, 0.035, 20, [0, 0.40, 0]);
  cylinder(table, material.wood, 0.028, 0.028, 0.38, 12, [0, 0.20, 0]);
  cylinder(table, material.cream, 0.11, 0.11, 0.02, 20, [0, 0.012, 0]);
  cylinder(table, material.teal, 0.036, 0.030, 0.09, 16, [-0.06, 0.462, 0.03]);
  box(table, material.magenta, [0.17, 0.022, 0.23], [0.02, 0.43, -0.01], [0, 0.34, 0], 0.008);
  box(table, material.paper, [0.155, 0.014, 0.215], [0.02, 0.447, -0.01], [0, 0.34, 0], 0.006);

  /* ---------- §8 仙人掌 ---------- */
  const CACTUS = { x: 0.86, z: -0.50, potRadius: 0.19, potHeight: 0.26 };
  pot(group, CACTUS.x, CACTUS.z, CACTUS.potRadius, CACTUS.potHeight, DECK_TOP, (host, height) => {
    const base = height + 0.18;
    cylinder(host, material.cactus, 0.105, 0.115, 0.44, 18, [0, base, 0]);
    blob(host, material.cactus, 0.105, [0, base + 0.22, 0], [1, 0.92, 1], 16);
    [-1, 1].forEach((side) => {
      attach(
        host,
        keep(new THREE.CapsuleGeometry(0.072, 0.14, 8, 14)),
        material.cactus,
        [side * 0.16, base + 0.06, 0],
        [0, 0, side * 1.35]
      );
      cylinder(host, material.cactus, 0.072, 0.072, 0.16, 14, [side * 0.26, base + 0.26, 0]);
      blob(host, material.cactus, 0.072, [side * 0.26, base + 0.35, 0], [1, 0.9, 1], 14);
    });
  });
  contact(group, 0.30, CACTUS.x, CACTUS.z);

  /* ---------- §9 圆叶盆栽 ×3 ---------- */
  function buildRoundPlant(x, z, scale, target, light) {
    pot(group, x, z, 0.15 * scale, 0.22 * scale, DECK_TOP, (host, height) => {
      const offsets = [
        [0, 0.06, 0, 0.115], [0.10, 0.10, 0.04, 0.09], [-0.09, 0.09, -0.05, 0.085],
        [0.03, 0.15, -0.10, 0.08], [-0.04, 0.14, 0.10, 0.078], [0.12, 0.02, -0.09, 0.07]
      ];
      offsets.forEach((spec, index) => {
        blob(
          host,
          index % 2 === 0 ? target : light,
          spec[3] * scale * 1.4,
          [
            spec[0] * scale * 1.6,
            height + 0.10 * scale + spec[1] * scale * 1.6,
            spec[2] * scale * 1.6
          ],
          [1, 0.62, 1],
          12
        );
      });
    });
    contact(group, 0.34 * scale, x, z);
  }
  buildRoundPlant(0.46, -0.86, 1.0, material.leaf, material.leafLight);
  buildRoundPlant(-0.96, -0.52, 0.86, material.leaf, material.leafLight);
  buildRoundPlant(-0.34, -1.04, 0.74, material.leafLight, material.leaf);

  /* ---------- §10 高杆绿植 ---------- */
  const TALL = { x: 1.02, z: 0.46 };
  pot(group, TALL.x, TALL.z, 0.20, 0.28, DECK_TOP, (host, height) => {
    cylinder(host, material.wood, 0.026, 0.036, 0.80, 12, [0, height + 0.40, 0]);
    const crown = new THREE.Group();
    crown.position.set(0, height + 0.80, 0);
    host.add(crown);
    for (let i = 0; i < 8; i += 1) {
      const blade = new THREE.Group();
      blade.rotation.y = (i / 8) * Math.PI * 2 + 0.3;
      blade.rotation.z = (i % 2 === 0 ? 1 : 0.62) * 0.62;
      blade.userData.baseYaw = blade.rotation.y;
      blade.userData.phase = i * 0.5;
      crown.add(blade);
      attach(
        blade,
        keep(new THREE.SphereGeometry(1, 10, 8)),
        i % 3 === 0 ? material.leafLight : material.leaf,
        [0, 0.26, 0],
        null,
        [0.042, 0.28, 0.016]
      );
      animated.leaves.push(blade);
    }
  });
  contact(group, 0.36, TALL.x, TALL.z);

  /* ---------- §11 纸灯笼串 ----------
     绳子一端系在伞顶、另一端挂在右墙的小钩上；整串绕伞顶为轴轻摆，
     灯笼各自再做小幅度钟摆，两者叠加才像有风。 */
  const CORD_A = [UMBRELLA.x, DECK_TOP + 0.075 + UMBRELLA.poleHeight + 0.12, UMBRELLA.z];
  const CORD_B = [RIGHT_INNER_X - 0.06, 0.86, 0.24];
  const stringGroup = new THREE.Group();
  stringGroup.position.set(CORD_A[0], CORD_A[1], CORD_A[2]);
  group.add(stringGroup);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.34, -0.06, 0.24),
    new THREE.Vector3(CORD_B[0] - CORD_A[0], CORD_B[1] - CORD_A[1], CORD_B[2] - CORD_A[2])
  ], false, "catmullrom", 0.5);
  attach(stringGroup, keep(new THREE.TubeGeometry(curve, 26, 0.010, 8, false)), material.cord);
  attach(
    group,
    keep(new THREE.CylinderGeometry(0.022, 0.022, 0.10, 12)),
    material.cord,
    [CORD_B[0] + 0.01, CORD_B[1], CORD_B[2]],
    [0, 0, Math.PI / 2]
  );

  const LANTERN_COUNT = 8;
  for (let i = 1; i <= LANTERN_COUNT; i += 1) {
    const t = i / (LANTERN_COUNT + 1);
    const point = curve.getPointAt(t);
    const lantern = new THREE.Group();
    lantern.position.set(point.x, point.y, point.z);
    lantern.userData.phase = t * 3.1;
    stringGroup.add(lantern);
    attach(lantern, keep(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6)), material.cord, [0, -0.03, 0]);
    attach(lantern, keep(new THREE.CylinderGeometry(0.048, 0.048, 0.095, 14)), material.lantern, [0, -0.108, 0]);
    attach(lantern, keep(new THREE.CylinderGeometry(0.054, 0.050, 0.014, 14)), material.cream, [0, -0.055, 0]);
    animated.lanterns.push(lantern);
  }

  /* ---------- §12 主题 ---------- */
  function applyCanopyColors(mode) {
    if (!canopyGeometry) return;
    const attribute = canopyGeometry.getAttribute("color");
    const colorA = new THREE.Color(mode ? PALETTE.canopyA[1] : PALETTE.canopyA[0]);
    const colorB = new THREE.Color(mode ? PALETTE.canopyB[1] : PALETTE.canopyB[0]);
    for (let i = 0; i < attribute.count; i += 1) {
      const wedge = Math.floor(Math.floor(i / 12) / 2) % 2;
      const color = wedge === 0 ? colorA : colorB;
      attribute.setXYZ(i, color.r, color.g, color.b);
    }
    attribute.needsUpdate = true;
  }

  function applyTheme(tokens) {
    const mode = tokens && tokens.scheme && tokens.scheme !== "default" ? 1 : 0;
    if (bundle.mode !== mode) {
      bundle.mode = mode;
      bundle.entries.forEach(([entry, light, dark]) => entry.color.set(mode ? dark : light));
      bundle.glows.forEach(([entry, light, dark]) => entry.emissive.set(mode ? dark : light));
      bundle.decal.color.set(mode ? PALETTE.shadow[1] : PALETTE.shadow[0]);
      bundle.decal.opacity = mode ? 0.42 : 0.34;
      bundle.material.glint.opacity = mode ? 0.62 : 0.55;
    }
    if (localMode !== mode) {
      localMode = mode;
      applyCanopyColors(mode);
    }
  }

  /* ---------- §13 动效 ----------
     step 由 delta 累积：delta 为 0（prefers-reduced-motion / 首帧）时画面静止，
     不依赖任何性能计时器，动画与帧率解耦。 */
  let elapsed = 0;

  function update(delta, tokens) {
    applyTheme(tokens);
    const step = delta > 0 && delta < 0.5 ? delta : 0;
    elapsed += step;
    if (step === 0) return;
    const t = elapsed;

    animated.lanterns.forEach((lantern) => {
      lantern.rotation.z = Math.sin(t * 1.15 + lantern.userData.phase) * 0.045;
      lantern.rotation.x = Math.cos(t * 0.95 + lantern.userData.phase) * 0.03;
    });
    stringGroup.rotation.z = Math.sin(t * 0.85) * 0.010;
    canopyGroup.rotation.z = Math.sin(t * 0.5) * 0.012;

    material.lantern.emissiveIntensity = 0.5 * (1 + Math.sin(t * 0.9) * 0.06);
    material.glint.opacity = (localMode ? 0.62 : 0.55) * (1 + Math.sin(t * 0.75) * 0.10);

    animated.glints.forEach((disc) => {
      disc.position.x = disc.userData.baseX + Math.sin(t * 0.6 + disc.userData.phase) * 0.02;
      disc.position.z = disc.userData.baseZ + Math.cos(t * 0.52 + disc.userData.phase) * 0.015;
    });
    animated.leaves.forEach((blade) => {
      blade.rotation.y = blade.userData.baseYaw + Math.sin(t * 0.7 + blade.userData.phase) * 0.021;
    });
  }

  /* ---------- §14 释放 ----------
     几何全部本层自造，逐件释放；材质由材质库持有（库 dispose 时统一释放），
     这里不能重复 dispose，否则重挂载时第二次绑定会拿到已释放的材质。 */
  function dispose() {
    owned.forEach((geometry) => geometry.dispose());
    owned.length = 0;
    animated.lanterns.length = 0;
    animated.leaves.length = 0;
    animated.glints.length = 0;
    canopyGeometry = null;
    kit.dispose();
    group.clear();
  }

  return { group, update, dispose };
}
