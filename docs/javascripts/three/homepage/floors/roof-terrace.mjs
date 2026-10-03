/* F10 屋顶露台 · 日落花园（v3.0 重构）
   设计依据：.documents/首页设计/第十层屋顶露台设计.md（v3.0 起以本文件为准）。

   形态定调：一座被浅镜池托起的「漂浮日落花园」。
   前景 = 镜池与踏步石；中景 = 漂浮的胶木前岛（遮阳伞 + 双躺椅 + 边几）、
   紫调后岛（丛植 + 吧台车）；后景 = 渐变日落穹幕 + 分层日轮 + 三层城市剪影 +
   星野与飞鸟；顶部 = 纸灯笼串。所有物体只使用房间本地坐标，不动相机与房间链。

   房间实测约束（来自 scene-builder.mjs / floor-registry.mjs，本文不得越界）：
   - 房间 3.0(宽) × 3.2(高) × 3.0(深)，原点在房间中心；
   - 地板是 3.0 × 0.24 × 3.0 的盒子，中心 y = -0.12 - height/2 = -1.72，
     故地板**上表面 y = -1.36**；
   - 背墙 3.0 × 3.2 × 0.22 置于 z = -depth/2 + 0.11 = -1.39，**内面 z = -1.28**；
   - 右墙 0.22 × 3.2 × 3.0 置于 x = width/2 - 0.11 = 1.39，**内面 x = 1.28**；
   - 前开口无下梁 / 立柱，视线从开口直接落进房间；
     最前景只放水面与踏步石，不摆低矮前景道具；
   - 安全盒：x ∈ [-1.22, 1.22]、z ∈ [-1.24, 1.22]、y ∈ [-1.36, 1.12]。
     （左墙不存在，取 x ≥ -1.22 只为与右墙对称、保持构图居中。）

   与框架的契约：createFloor(THREE, materials) → { group, update, dispose }。
   只读 tokens.scheme 与 materials.toon / materials.line，不修改框架其余文件；
   prefers-reduced-motion 下 delta 传 0，动效自动全静止。 */

export function createFloor(THREE, materials) {
  const group = new THREE.Group();
  group.name = "nmd-floor-roof";

  const geometries = [];
  const ownedMaterials = [];
  const edgeGeometries = [];
  const edgeCache = new Map();
  /* 需要 亮/暗 双色的材质，条目为 [material, lightHex, darkHex]。 */
  const themeColorEntries = [];
  /* 需要按主题重算「自发光强度」的材质，条目为 [material, lightIntensity, darkIntensity]。 */
  const emissiveEntries = [];

  const animated = {
    bulbs: [],
    water: null,
    waterGlints: [],
    pondGlints: [],
    umbrella: null,
    sunHalo: null,
    sunRays: null,
    starMaterial: null,
    cloudA: null,
    cloudB: null,
    birds: null,
    islands: []
  };

  let elapsed = 0;

  /* ---------------------------------------------------------------
     资源登记：几何 / 自带材质 / 描边几何，dispose 时一并释放。
     --------------------------------------------------------------- */
  function track(geometry) {
    geometries.push(geometry);
    return geometry;
  }

  function own(material) {
    ownedMaterials.push(material);
    return material;
  }

  function themeColor(material, lightHex, darkHex) {
    themeColorEntries.push({ material, lightHex, darkHex });
    return material;
  }

  /* 受主题驱动的 toon 材质。材质本身由 materials.mjs 的材质库统一销毁，
     这里只登记「亮/暗颜色」，避免单层 dispose 重复销毁库材质。 */
  function toonPair(lightHex, darkHex, options) {
    return themeColor(materials.toon(lightHex, options), lightHex, darkHex);
  }

  /* 自带材质：不受主题换色，由本层直接销毁。用于纯色远景面片与道具小件。 */
  function basic(color, options = {}) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: Boolean(options.transparent),
      opacity: options.opacity == null ? 1 : options.opacity,
      depthWrite: options.depthWrite !== false,
      side: options.side || THREE.FrontSide,
      vertexColors: Boolean(options.vertexColors),
      toneMapped: options.toneMapped === undefined ? true : options.toneMapped
    });
    return own(material);
  }

  /* 小面积亮点：toon + emissive，不做 Bloom。 */
  function glow(lightHex, darkHex, lightIntensity, darkIntensity, options) {
    const material = toonPair(lightHex, darkHex, options);
    material.emissive = new THREE.Color(lightHex);
    material.emissiveIntensity = lightIntensity;
    emissiveEntries.push({ material, lightIntensity, darkIntensity });
    return material;
  }

  function applyTransform(object, position, rotation, scale) {
    if (position) object.position.set(position[0], position[1], position[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
    return object;
  }

  function addMesh(parent, shape, material, position, rotation, scale) {
    const item = new THREE.Mesh(shape, material);
    applyTransform(item, position, rotation, scale);
    parent.add(item);
    return item;
  }

  function edgeFor(geometry) {
    if (!edgeCache.has(geometry)) {
      const edge = new THREE.EdgesGeometry(geometry, 28);
      edgeCache.set(geometry, edge);
      edgeGeometries.push(edge);
    }
    return edgeCache.get(geometry);
  }

  /* 描边材质走 materials.line 的统一实例，不在这里销毁。 */
  function addOutlined(parent, shape, material, position, rotation, scale, lineMaterial) {
    const item = addMesh(parent, shape, material, position, rotation, scale);
    const edge = new THREE.LineSegments(edgeFor(shape), lineMaterial);
    applyTransform(edge, position, rotation, scale);
    parent.add(edge);
    return item;
  }

  /* ---------------------------------------------------------------
     调色板：亮 / 暗 两套只换颜色，不换几何、构图与镜头。
     口径：亮色 = 纸白摄影棚里的午后日落花园；暗色 = 深紫舞台上的黄昏。
     --------------------------------------------------------------- */
  const PALETTE = {
    /* 天空渐变：索引 0 = 地平线、索引 3 = 天顶。
       日落的方向必须是「地平线暖、天顶冷」，v3.0 早先把顺序写反了，
       于是画面里出现蓝底黄顶的假天空。 */
    skyGrad: [
      ["#ffdf92", "#ff9f63", "#bd7cc4", "#6a93cf"],
      ["#ffb457", "#bd4a68", "#4a3088", "#141c3e"]
    ],
    skyBase: ["#cfe0f5", "#2a2350"],
    cloud: ["#fff4e6", "#7d5fa8"],
    star: ["#fffdf4", "#f4ecff"],
    sunDisc: ["#fff1bd", "#fff6d4"],
    sunCore: ["#fffbf2", "#fffcec"],
    sunGlow: ["#ffbe63", "#ffcf7a"],
    skylineFar: ["#7a63ab", "#33245c"],
    skylineMid: ["#4c3878", "#1e1438"],
    skylineNear: ["#2e1f4c", "#0f0a1c"],
    window: ["#ffe3a3", "#ffd27a"],
    /* 池水跟天空同调：暖色日落下一池亮青是最刺眼的一处色冲突。
       水面不用 toonPair，改成顶点色 + MeshBasicMaterial：后左缘接住落日余晖、
       前右缘沉成天顶紫，一条渐变就把"镜面"交代清楚，且一定比地板深，
       不会再跟雾紫地板融成一片。 */
    water: ["#7f6cbe", "#2b2160"],
    waterWarm: ["#ffc98a", "#c86f4a"],
    pond: ["#f4e2ff", "#a98cf0"],
    glint: ["#fff0c8", "#e8f8ff"],
    paver: ["#fff6e8", "#efe8ff"],
    paverEdge: ["#dcc6ac", "#8f7ab5"],
    deckTop: ["#fff3df", "#f6efff"],
    deckSide: ["#e0a877", "#a97f66"],
    deckRail: ["#cf9260", "#8d6a58"],
    leg: ["#c98d5a", "#8a6552"],
    islandTop: ["#e6d6f7", "#3a2a63"],
    islandSide: ["#b79ada", "#6a4f9e"],
    coral: ["#f97316", "#ff9b62"],
    coralSoft: ["#f9a03f", "#ffb27d"],
    violet: ["#7656b8", "#b26bff"],
    cream: ["#fffaf5", "#f5f1ff"],
    terracotta: ["#d97758", "#c07b72"],
    navy: ["#2c3a63", "#14162c"],
    wood: ["#c98d5a", "#8a6552"],
    teal: ["#2fbfae", "#4de0cf"],
    glass: ["#bfeef2", "#9fe6f0"],
    gold: ["#ffc65a", "#ffd06e"],
    leaf: ["#4f9d69", "#6bbf86"],
    leafLight: ["#8bcf8a", "#a5e09a"],
    leafDeep: ["#2f7a52", "#4a9a6d"]
  };

  const outlineLine = materials.line("#30264f", { transparent: true, opacity: 0.34 });

  /* ---------------------------------------------------------------
     共享几何：所有道具由同一批基础体缩放拼装，不加载外部模型与贴图。
     --------------------------------------------------------------- */
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
  const unitCylinderLow = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  const unitCone = track(new THREE.ConeGeometry(0.5, 1, 12));
  const unitConeLow = track(new THREE.ConeGeometry(0.5, 1, 6));
  const unitSphere = track(new THREE.SphereGeometry(0.5, 18, 12));
  const unitDisc = track(new THREE.CircleGeometry(0.5, 40));
  const unitRing = track(new THREE.TorusGeometry(0.5, 0.02, 8, 44));

  /* 径向渐变圆盘：圆心 alpha=1、圆周 alpha=0，用 4 分量顶点色做柔边。
     CircleGeometry 是纯色圆盘，边缘一刀切，叠三层就是三个同心硬边圆——
     在画面上会读成一个"拱门"轮廓。改成顶点色带 alpha 的三角扇，
     不用贴图也能得到无边界的辉光。 */
  function makeGlowDiscGeometry(segments) {
    const positions = [0, 0, 0];
    const colors = [1, 1, 1, 1];
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0);
      colors.push(1, 1, 1, 0);
    }
    for (let i = 0; i < segments; i += 1) {
      indices.push(0, 1 + i, 2 + i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    return track(geometry);
  }
  const glowDisc = makeGlowDiscGeometry(48);

  /* 伞面：顶端内凹的 12 边低锥，边缘带一点波浪，读作松弛的伞布。 */
  function makeCanopyGeometry(radius, height, sag, segments) {
    const positions = [0, height, 0];
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const wave = Math.sin(angle * 6) * sag * 0.30;
      positions.push(Math.cos(angle) * radius, height - sag + wave, Math.sin(angle) * radius);
    }
    for (let i = 0; i < segments; i += 1) {
      indices.push(0, 1 + i, 2 + i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return track(geometry);
  }

  /* ===============================================================
     § 1 · 后景：渐变日落穹幕
     穹幕**正好等于背墙内面尺寸**（3.00 × 3.20，y 居中于 0），贴在
     z = -1.273（内面 -1.28 之前 0.007）。边缘与墙沿逐像素重合，于是
     天空就是这面墙本身，不存在"贴纸"矩形边。
     注意：左面是开口，穹幕一旦宽过房间就会露到房间外糊满画面，
     所以这里必须与墙面严格同尺寸，不能靠"放大到看不见边"。
     =============================================================== */
  const SKY_Z = -1.273;
  const SKY_W = 3.00;
  const SKY_H = 3.20;
  const SKY_CENTER_Y = 0;

  const skyGeometry = track(new THREE.PlaneGeometry(SKY_W, SKY_H, 1, 3));
  skyGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(skyGeometry.attributes.position.count * 3), 3));
  const skyMaterial = own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const skyMesh = addMesh(group, skyGeometry, skyMaterial, [0, SKY_CENTER_Y, SKY_Z]);
  skyMesh.renderOrder = -2;

  /* 云带：三条细长圆角长条，在高空缓慢横移，不抢道具轮廓。
     低空那条用暖色，和地平线的暖色带接上；高空的偏冷，融入天顶蓝紫。 */
  const cloudMaterial = basic(PALETTE.cloud[0], {
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false
  });
  const cloudLowMaterial = basic("#ffd9a8", {
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    toneMapped: false
  });
  const clouds = new THREE.Group();
  clouds.position.set(0, 0, SKY_Z + 0.03);
  group.add(clouds);
  const cloudA = new THREE.Group();
  const cloudB = new THREE.Group();
  clouds.add(cloudA, cloudB);
  [
    [cloudA, [-0.58, 0.74, 0.64, 0.055], cloudMaterial],
    [cloudA, [-0.28, 0.70, 0.34, 0.042], cloudMaterial],
    [cloudB, [0.32, 0.34, 0.72, 0.048], cloudMaterial],
    [cloudB, [0.64, 0.30, 0.40, 0.038], cloudMaterial],
    [cloudB, [-0.84, -0.06, 0.52, 0.036], cloudLowMaterial]
  ].forEach(([parent, spec, material]) => {
    addMesh(parent, unitBox, material, [spec[0], spec[1], 0], null, [spec[2], spec[3], 0.012]);
  });
  animated.cloudA = cloudA;
  animated.cloudB = cloudB;

  /* 星野：Points 而非小球，避免 draw call 与三角形浪费；固定种子保证布局稳定。 */
  const STAR_COUNT = 150;
  const starGeometry = track(new THREE.BufferGeometry());
  {
    let seed = 20261002;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i += 1) {
      positions[i * 3] = (rand() - 0.5) * 2.80;
      positions[i * 3 + 1] = 0.30 + rand() * 0.70;
      positions[i * 3 + 2] = SKY_Z + 0.04;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  }
  const starMaterial = own(
    new THREE.PointsMaterial({
      color: PALETTE.star[0],
      size: 0.019,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      toneMapped: false
    })
  );
  starMaterial.userData.baseOpacity = 0.18;
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  group.add(stars);
  animated.starMaterial = starMaterial;

  /* ===============================================================
     § 2 · 后景：分层日轮
     四层同心径向渐变圆盘（glowDisc，4 分量顶点色做柔边）+ 10 根光芒，
     全部平贴穹幕前方 0.04~0.08；用「同心 + 放射」而不是球体，侧看不会鼓成球。
     纯色 CircleGeometry 叠层会读成三个硬边同心圆（像拱门），故必须用柔边圆盘。
     =============================================================== */
  /* 落日：四层同心圆做柔和的径向辉光，越外越淡，靠叠加而不是 Bloom。
     位置压在地平线一带、偏左——既贴合"暖色在低处"的渐变，又避开伞面
     与后排盆栽；此前放在画面正中，被伞整片盖住。 */
  const SUN = [-0.78, -0.10, SKY_Z + 0.12];
  const sunDiscMaterial = basic(PALETTE.sunDisc[0], { toneMapped: false });
  const sunCoreMaterial = basic(PALETTE.sunCore[0], { toneMapped: false });
  const sunHemMaterial = basic(PALETTE.sunGlow[0], {
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    toneMapped: false,
    vertexColors: true
  });
  const sunBloomMaterial = basic(PALETTE.sunGlow[0], {
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
    vertexColors: true
  });
  const sunHaloMaterial = basic(PALETTE.sunGlow[0], {
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    toneMapped: false,
    vertexColors: true
  });
  addMesh(group, glowDisc, sunHemMaterial, [SUN[0], SUN[1], SUN[2] - 0.004], null, [1.30, 1.30, 1]);
  addMesh(group, glowDisc, sunBloomMaterial, [SUN[0], SUN[1], SUN[2] + 0.002], null, [0.94, 0.94, 1]);
  const sunHalo = addMesh(group, glowDisc, sunHaloMaterial, [SUN[0], SUN[1], SUN[2] + 0.008], null, [0.62, 0.62, 1]);
  addMesh(group, unitDisc, sunDiscMaterial, [SUN[0], SUN[1], SUN[2] + 0.012], null, [0.32, 0.32, 1]);
  addMesh(group, unitDisc, sunCoreMaterial, [SUN[0], SUN[1], SUN[2] + 0.016], null, [0.19, 0.19, 1]);
  animated.sunHalo = sunHalo;

  /* 光芒不能共用 sunHaloMaterial：那份材质开了 vertexColors，
     而 unitBox 没有 color 属性，attribute 未绑定会读成黑色。 */
  const sunRayMaterial = basic(PALETTE.sunGlow[0], {
    transparent: true,
    opacity: 0.40,
    depthWrite: false,
    toneMapped: false
  });

  const sunRays = new THREE.Group();
  sunRays.position.set(SUN[0], SUN[1], SUN[2] + 0.001);
  group.add(sunRays);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 20;
    const length = i % 2 === 0 ? 0.30 : 0.17;
    const ray = addMesh(
      sunRays,
      unitBox,
      sunRayMaterial,
      [Math.sin(angle) * (0.26 + length / 2), Math.cos(angle) * (0.26 + length / 2), 0],
      [0, 0, -angle],
      [0.014, length, 0.001]
    );
    ray.renderOrder = -1;
  }
  animated.sunRays = sunRays;

  /* ===============================================================
     § 3 · 后景：三层城市剪影 + 窗光
     越远越淡、越近越深，制造空气透视；全部压在地平线 y ≤ -0.72 一带。
     =============================================================== */
  const skylineFar = basic(PALETTE.skylineFar[0], {
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const skylineMid = basic(PALETTE.skylineMid[0], {
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    toneMapped: false
  });
  const skylineNear = basic(PALETTE.skylineNear[0], { toneMapped: false });
  const windowMaterial = glow(PALETTE.window[0], PALETTE.window[1], 0.42, 0.92, { toneMapped: false });

  [
    [skylineFar, SKY_Z + 0.07, [
      [-1.10, -0.90, 0.30, 0.72], [-0.72, -0.82, 0.44, 0.92], [-0.24, -0.94, 0.32, 0.62],
      [0.22, -0.86, 0.40, 0.84], [0.68, -0.92, 0.36, 0.68], [1.10, -0.84, 0.30, 0.88]
    ]],
    [skylineMid, SKY_Z + 0.09, [
      [-1.00, -1.00, 0.24, 0.52], [-0.60, -0.96, 0.34, 0.62], [0.06, -1.02, 0.26, 0.48],
      [0.54, -0.94, 0.32, 0.66], [1.00, -1.00, 0.22, 0.52]
    ]],
    [skylineNear, SKY_Z + 0.11, [
      [-0.84, -1.10, 0.26, 0.34], [-0.34, -1.12, 0.30, 0.28], [0.34, -1.10, 0.28, 0.34],
      [0.82, -1.08, 0.24, 0.40]
    ]]
  ].forEach((entry) => {
    const material = entry[0];
    const z = entry[1];
    entry[2].forEach((block) => {
      addMesh(group, unitBox, material, [block[0], block[1] + block[3] / 2, z], null, [block[2], block[3], 0.02]);
    });
  });
  [
    [-0.86, -0.98, 0.05], [-0.76, -0.90, 0.04],
    [-0.38, -1.06, 0.045], [-0.28, -0.98, 0.04],
    [0.30, -1.04, 0.05], [0.40, -0.96, 0.04],
    [0.80, -0.98, 0.04]
  ].forEach((spec) => {
    addMesh(group, unitBox, windowMaterial, [spec[0], spec[1], SKY_Z + 0.13], null, [spec[2], spec[2], 0.012]);
  });

  /* ===============================================================
     § 4 · 远景：飞鸟剪影（5 只，缓慢横移后回卷）
     =============================================================== */
  const birdMaterial = basic(PALETTE.skylineNear[0], {
    transparent: true,
    opacity: 0.60,
    depthWrite: false,
    toneMapped: false
  });
  const birds = new THREE.Group();
  birds.position.set(0, 0, SKY_Z + 0.14);
  group.add(birds);
  [
    [-0.55, 0.80, 1.00], [-0.30, 0.88, 0.82], [-0.10, 0.78, 0.92],
    [0.14, 0.86, 0.76], [0.34, 0.76, 0.88]
  ].forEach((spec) => {
    const bird = new THREE.Group();
    bird.position.set(spec[0], spec[1], 0);
    bird.scale.setScalar(spec[2]);
    bird.rotation.z = 0.18;
    addMesh(bird, unitBox, birdMaterial, [-0.030, 0.008, 0], [0, 0, 0.55], [0.075, 0.008, 0.006]);
    addMesh(bird, unitBox, birdMaterial, [0.030, 0.008, 0], [0, 0, -0.55], [0.075, 0.008, 0.006]);
    birds.add(bird);
  });
  animated.birds = birds;

  /* ===============================================================
     § 5 · 前景：浅镜池
     2.44 × 2.44 水面平铺在地板上表面之上 0.008，正好落在安全盒
      z ∈ [-1.22, 1.24] 之内；前缘露出的"一线池水"就是前景分割线。
      水面不写深度，靠 renderOrder 排序。
     =============================================================== */
  const WATER_Y = -1.352;
  /* 池面收小到 2.06 × 2.06：满铺到墙根时，池水的直线边会跟地板撞出
     一条说不清的硬边（看上去像渲染错误）。收小 + 加一圈压边，边界就
     从"没对齐"变成"刻意做的"。双岛仍在池面正上方（离池心最远 1.15）。 */
  const POND_HALF = 1.03;
  const POND_SIZE = POND_HALF * 2;
  /* 4 × 5 段：够铺一条二维渐变（后左暖、前右冷），又只多十几个顶点。 */
  const waterGeometry = track(new THREE.PlaneGeometry(POND_SIZE, POND_SIZE, 4, 4));
  waterGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(waterGeometry.attributes.position.count * 3), 3)
  );
  const waterMaterial = own(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      toneMapped: false
    })
  );
  const water = addMesh(group, waterGeometry, waterMaterial, [0, WATER_Y, 0], [-Math.PI / 2, 0, 0]);
  water.renderOrder = 1;
  water.name = "nmd-roof-water";
  animated.water = water;

  /* 池沿压边：四条薄边，把池水的边界交代清楚。 */
  const pondRimMaterial = toonPair(PALETTE.paverEdge[0], PALETTE.paverEdge[1]);
  [
    [0, POND_HALF, POND_SIZE + 0.12, 0.10],
    [0, -POND_HALF, POND_SIZE + 0.12, 0.10]
  ].forEach(([x, z, w, d]) => {
    addOutlined(group, unitBox, pondRimMaterial, [x, WATER_Y + 0.012, z], null, [w, 0.05, d], outlineLine);
  });
  [
    [POND_HALF, 0],
    [-POND_HALF, 0]
  ].forEach(([x, z]) => {
    addOutlined(group, unitBox, pondRimMaterial, [x, WATER_Y + 0.012, z], null, [0.10, 0.05, POND_SIZE - 0.02], outlineLine);
  });

  /* 水面反光：三条暖色 + 三条冷色长条，缓慢漂移并呼吸。 */
  const glintWarm = basic(PALETTE.glint[0], {
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    toneMapped: false
  });
  const glintCool = basic(PALETTE.glint[1], {
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false
  });
  [
    /* [材质, 基准不透明度, x, z, 宽, 厚, 偏角] */
    [glintWarm, 0.30, 0.62, -0.40, 0.20, 0.030, 0.16],
    [glintWarm, 0.30, 0.30, 0.40, 0.16, 0.026, -0.42],
    [glintWarm, 0.30, -0.34, 0.68, 0.24, 0.028, 0.30],
    [glintCool, 0.22, -0.58, -0.44, 0.18, 0.020, -0.24],
    [glintCool, 0.22, 0.68, 0.66, 0.14, 0.018, 0.52],
    [glintCool, 0.22, -0.10, -0.74, 0.22, 0.020, 0.08]
  ].forEach((spec) => {
    const glint = addMesh(
      group,
      unitBox,
      spec[0],
      [spec[2], WATER_Y + 0.004, spec[3]],
      [0, spec[6], 0],
      [spec[4], 0.002, spec[5]]
    );
    glint.renderOrder = 2;
    glint.userData.baseX = spec[2];
    glint.userData.baseOpacity = spec[1];
    animated.waterGlints.push(glint);
  });

  /* 池中浮光：8 个极薄同心圆环，随呼吸放大缩小。 */
  const pondGlintMaterial = basic(PALETTE.pond[0], {
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    toneMapped: false
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = 0.32 + (i % 3) * 0.30;
    const baseScale = 0.16 + (i % 4) * 0.05;
    const ring = addMesh(
      group,
      unitRing,
      pondGlintMaterial,
      [Math.cos(angle) * distance, WATER_Y + 0.006, 0.10 + Math.sin(angle) * distance],
      [Math.PI / 2, 0, 0],
      [baseScale, baseScale, 1]
    );
    ring.renderOrder = 3;
    ring.userData.baseScale = baseScale;
    ring.userData.phase = i * 0.9;
    animated.pondGlints.push(ring);
  }

  /* ===============================================================
     § 6 · 中景：漂浮双岛
     前岛（胶木主台）与后岛（紫调花台）都通过四条支撑腿抬离水面，
     读作"漂浮"但有物理承接，符合总纲「不允许房间悬空」。
     关键高度：地板面 -1.36 → 台体底面 -1.18 → 台面 -1.00 左右。
     =============================================================== */
  const deckTopMaterial = toonPair(PALETTE.deckTop[0], PALETTE.deckTop[1]);
  const deckSideMaterial = toonPair(PALETTE.deckSide[0], PALETTE.deckSide[1]);
  const deckRailMaterial = toonPair(PALETTE.deckRail[0], PALETTE.deckRail[1]);
  const legMaterial = toonPair(PALETTE.leg[0], PALETTE.leg[1]);
  const woodMaterial = toonPair(PALETTE.wood[0], PALETTE.wood[1]);
  const creamMaterial = toonPair(PALETTE.cream[0], PALETTE.cream[1]);

  /* 前岛：台体 x[-1.19,-0.13] z[-0.59,0.55]，台面 y = -0.99。 */
  const frontIsland = new THREE.Group();
  group.add(frontIsland);
  animated.islands.push({ node: frontIsland, baseline: 0, phase: 0, amplitude: 0.014 });

  addOutlined(frontIsland, unitBox, deckSideMaterial, [-0.66, -1.09, -0.02], null, [1.06, 0.12, 1.14], outlineLine);
  addOutlined(frontIsland, unitBox, deckTopMaterial, [-0.66, -1.023, -0.02], null, [1.00, 0.022, 1.08], outlineLine);
  [
    [-0.66, -1.065, 0.53, 0.98, 0.045, 0.045],
    [-0.66, -1.065, -0.57, 0.98, 0.045, 0.045],
    [-1.175, -1.065, -0.02, 0.045, 0.045, 1.08],
    [-0.145, -1.065, -0.02, 0.045, 0.045, 1.08]
  ].forEach((spec) => {
    addOutlined(frontIsland, unitBox, deckRailMaterial, [spec[0], spec[1], spec[2]], null, [spec[3], spec[4], spec[5]], outlineLine);
  });
  [
    [-1.10, 0.44], [-0.22, 0.44], [-1.10, -0.48], [-0.22, -0.48]
  ].forEach((spec) => {
    addOutlined(frontIsland, unitBox, legMaterial, [spec[0], -1.205, spec[1]], null, [0.055, 0.14, 0.055], outlineLine);
  });

  /* 后岛：台体 x[0.50,1.22] z[-1.15,-0.35]，台面 y = -0.975。 */
  const islandTopMaterial = toonPair(PALETTE.islandTop[0], PALETTE.islandTop[1]);
  const islandSideMaterial = toonPair(PALETTE.islandSide[0], PALETTE.islandSide[1]);

  const rearIsland = new THREE.Group();
  group.add(rearIsland);
  animated.islands.push({ node: rearIsland, baseline: 0, phase: 1.6, amplitude: 0.011 });

  addOutlined(rearIsland, unitBox, islandSideMaterial, [0.86, -1.085, -0.75], null, [0.72, 0.12, 0.80], outlineLine);
  addOutlined(rearIsland, unitBox, islandTopMaterial, [0.86, -1.018, -0.75], null, [0.66, 0.022, 0.74], outlineLine);
  [
    [0.56, -1.11], [1.16, -1.11], [0.56, -0.39], [1.16, -0.39]
  ].forEach((spec) => {
    addOutlined(rearIsland, unitBox, legMaterial, [spec[0], -1.20, spec[1]], null, [0.055, 0.14, 0.055], outlineLine);
  });

  /* 踏步石：从后岛前缘斜向走到前岛右缘，四块错落、间距均匀。 */
  const paverTopMaterial = toonPair(PALETTE.paver[0], PALETTE.paver[1]);
  const paverSideMaterial = toonPair(PALETTE.paverEdge[0], PALETTE.paverEdge[1]);
  [
    [0.68, -0.28, 0.20, 0.16],
    [0.50, -0.01, 0.22, 0.17],
    [0.28, 0.26, 0.21, 0.16],
    [0.02, 0.47, 0.19, 0.15]
  ].forEach((spec, index) => {
    addOutlined(group, unitBox, paverSideMaterial, [spec[0], -1.345, spec[1]], null, [spec[2], 0.055, spec[3]], outlineLine);
    addOutlined(
      group,
      unitBox,
      paverTopMaterial,
      [spec[0], -1.315, spec[1]],
      [0, index % 2 ? 0.10 : -0.08, 0],
      [spec[2] * 0.92, 0.014, spec[3] * 0.92],
      outlineLine
    );
  });

  /* ===============================================================
     § 7 · 中景家具：遮阳伞 + 双躺椅 + 边几
     家具组的基准 y = -0.99（= 前岛台面），所有零件按台面起算。
     =============================================================== */
  const coralMaterial = toonPair(PALETTE.coral[0], PALETTE.coral[1]);
  const coralSoftMaterial = toonPair(PALETTE.coralSoft[0], PALETTE.coralSoft[1]);
  const violetMaterial = toonPair(PALETTE.violet[0], PALETTE.violet[1]);
  const terracottaMaterial = toonPair(PALETTE.terracotta[0], PALETTE.terracotta[1]);
  const navyMaterial = toonPair(PALETTE.navy[0], PALETTE.navy[1]);
  const leafMaterial = toonPair(PALETTE.leaf[0], PALETTE.leaf[1]);
  const leafLightMaterial = toonPair(PALETTE.leafLight[0], PALETTE.leafLight[1]);
  const leafDeepMaterial = toonPair(PALETTE.leafDeep[0], PALETTE.leafDeep[1]);
  const goldMaterial = glow(PALETTE.gold[0], PALETTE.gold[1], 0.34, 0.52);

  /* 遮阳伞：木杆 + 12 边内凹伞面 + 12 根奶白伞骨 + 金色顶珠。
     伞组基准 y = -0.99，所有零件按此起算。
     顶珠 local y = 2.00 → 世界 1.057，叠加珠半径 0.055 = 1.112 ≤ 1.12。 */
  const umbrella = new THREE.Group();
  umbrella.position.set(-1.04, -0.99, 0.18);
  umbrella.rotation.z = 0.05;
  group.add(umbrella);
  animated.umbrella = umbrella;

  /* 伞面必须 DoubleSide：相机站在房间左上前方俯视，看到的是扇形正面；
     但 `makeCanopyGeometry` 的绕序朝下，默认 FrontSide 会把整片伞面当背面
     剔除，画面里只剩 EdgesGeometry 的一圈空椭圆。双面渲染一并解决
     可见性与背面法线打光。
     伞骨贴伞面斜下行：从 r = 0.12 到 r = 0.60，落差 0.16 × (0.48 / 0.62)。 */
  const canopyGeometry = makeCanopyGeometry(0.62, 1.72, 0.16, 12);
  const canopyMaterial = toonPair(PALETTE.coral[0], PALETTE.coral[1]);
  canopyMaterial.side = THREE.DoubleSide;
  addOutlined(umbrella, canopyGeometry, canopyMaterial, [0, 0, 0], null, null, outlineLine);
  const RIB_SLOPE = Math.atan2(0.16, 0.62);
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const ribRadius = 0.36;
    const rib = new THREE.Group();
    rib.position.set(
      Math.cos(angle) * ribRadius,
      1.72 - (ribRadius / 0.62) * 0.16,
      Math.sin(angle) * ribRadius
    );
    rib.rotation.y = -angle;
    umbrella.add(rib);
    addMesh(rib, unitBox, creamMaterial, [0, 0, 0], [0, 0, -RIB_SLOPE], [0.50, 0.016, 0.046]);
  }
  addMesh(umbrella, unitConeLow, creamMaterial, [0, 1.715, 0], null, [0.10, 0.09, 0.10]);
  addOutlined(umbrella, unitCylinder, woodMaterial, [0, 0.95, 0], null, [0.058, 1.78, 0.058], outlineLine);
  addOutlined(umbrella, unitCylinder, woodMaterial, [0, 0.05, 0], null, [0.34, 0.09, 0.34], outlineLine);
  addMesh(umbrella, unitSphere, goldMaterial, [0, 2.00, 0], null, [0.11, 0.11, 0.11]);

  /* 躺椅：座面 + 倾斜靠背 + 靠垫 + 描边线 + 四条腿。 */
  function buildLounger(x, z, yaw, shellMaterial, accentMaterial) {
    const chair = new THREE.Group();
    chair.position.set(x, -0.99, z);
    chair.rotation.y = yaw;
    group.add(chair);

    addOutlined(chair, unitBox, shellMaterial, [0, 0.24, 0.02], null, [0.56, 0.075, 1.00], outlineLine);
    addOutlined(chair, unitBox, shellMaterial, [0, 0.44, -0.50], [-0.62, 0, 0], [0.56, 0.075, 0.60], outlineLine);
    addOutlined(chair, unitBox, creamMaterial, [0, 0.286, 0.04], null, [0.46, 0.030, 0.86], outlineLine);
    addOutlined(chair, unitBox, creamMaterial, [0, 0.492, -0.50], [-0.62, 0, 0], [0.46, 0.030, 0.52], outlineLine);
    addMesh(chair, unitBox, accentMaterial, [0, 0.302, 0.04], null, [0.10, 0.032, 0.86]);
    addMesh(chair, unitBox, accentMaterial, [0, 0.508, -0.50], [-0.62, 0, 0], [0.10, 0.032, 0.52]);
    addOutlined(chair, unitBox, creamMaterial, [0, 0.40, -0.28], [-0.30, 0, 0], [0.34, 0.085, 0.16], outlineLine);
    [
      [-0.22, 0.40], [0.22, 0.40], [-0.22, -0.38], [0.22, -0.38]
    ].forEach((spec) => {
      addOutlined(chair, unitBox, legMaterial, [spec[0], 0.10, spec[1]], null, [0.055, 0.20, 0.055], outlineLine);
    });
    return chair;
  }
  /* 椅心分别落在前岛台面内：(-0.94, 0.06) 与 (-0.30, -0.10)。 */
  buildLounger(-0.94, 0.06, -0.26, coralMaterial, violetMaterial);
  buildLounger(-0.30, -0.10, 0.20, violetMaterial, coralMaterial);

  /* 边几：小圆几 + 一杯饮料 + 一本摊开的书。 */
  const sideTable = new THREE.Group();
  sideTable.position.set(-0.24, -0.99, 0.36);
  group.add(sideTable);
  addOutlined(sideTable, unitCylinder, creamMaterial, [0, 0.12, 0], null, [0.30, 0.05, 0.30], outlineLine);
  addOutlined(sideTable, unitCylinder, goldMaterial, [0, 0.015, 0], null, [0.055, 0.24, 0.055], outlineLine);
  addOutlined(sideTable, unitCylinder, goldMaterial, [0, -0.105, 0], null, [0.17, 0.03, 0.17], outlineLine);
  addOutlined(sideTable, unitCylinder, coralSoftMaterial, [0.07, 0.205, 0.03], null, [0.062, 0.11, 0.062], outlineLine);
  addMesh(sideTable, unitCylinder, goldMaterial, [0.07, 0.275, 0.03], null, [0.018, 0.10, 0.018]);
  addOutlined(sideTable, unitBox, creamMaterial, [-0.05, 0.155, -0.05], null, [0.14, 0.022, 0.18], outlineLine);
  addMesh(sideTable, unitBox, coralMaterial, [-0.082, 0.156, -0.05], [0, 0, 0.06], [0.055, 0.026, 0.18]);

  /* ===============================================================
     § 8 · 中景：吧台车 + 杯具酒瓶（后岛台面）
     车体基准 y = -0.975（= 后岛台面），脚轮贴台面。
     =============================================================== */
  const cart = new THREE.Group();
  cart.position.set(0.86, -0.975, -0.72);
  cart.rotation.y = -0.14;
  group.add(cart);
  addOutlined(cart, unitBox, creamMaterial, [0, 0.22, 0], null, [0.62, 0.36, 0.42], outlineLine);
  addOutlined(cart, unitBox, goldMaterial, [0, 0.42, 0], null, [0.72, 0.055, 0.52], outlineLine);
  addOutlined(cart, unitBox, terracottaMaterial, [0, 0.05, 0], null, [0.56, 0.035, 0.36], outlineLine);
  [
    [-0.30, -0.16], [0.30, -0.16], [-0.30, 0.16], [0.30, 0.16]
  ].forEach((spec) => {
    addOutlined(cart, unitCylinderLow, navyMaterial, [spec[0], 0.04, spec[1]], [0, 0, Math.PI / 2], [0.10, 0.05, 0.10], outlineLine);
  });
  addOutlined(cart, unitCylinder, creamMaterial, [-0.18, 0.53, 0.02], null, [0.10, 0.19, 0.10], outlineLine);
  addOutlined(cart, unitCylinder, toonPair(PALETTE.teal[0], PALETTE.teal[1]), [0, 0.51, -0.08], null, [0.09, 0.15, 0.09], outlineLine);
  addOutlined(cart, unitCylinder, coralSoftMaterial, [0.18, 0.52, 0.06], null, [0.09, 0.17, 0.09], outlineLine);
  addOutlined(cart, unitCylinder, terracottaMaterial, [0.04, 0.58, 0.20], null, [0.075, 0.30, 0.075], outlineLine);
  addMesh(cart, unitCylinder, navyMaterial, [0.04, 0.755, 0.20], null, [0.045, 0.05, 0.045]);
  addOutlined(cart, unitCylinder, toonPair(PALETTE.glass[0], PALETTE.glass[1]), [-0.30, 0.56, -0.16], null, [0.075, 0.22, 0.075], outlineLine);

  /* ===============================================================
     § 9 · 植物：棕榈 / 丛叶 / 草团 / 角落高盆
     前岛左侧留出伞、椅之外的竖向支撑，后岛与右后角补层次。
     =============================================================== */
  function buildPalm(x, baseY, z, yaw) {
    const palm = new THREE.Group();
    palm.position.set(x, baseY, z);
    palm.rotation.y = yaw;
    group.add(palm);
    addOutlined(palm, unitCylinder, terracottaMaterial, [0, 0.16, 0], null, [0.34, 0.32, 0.34], outlineLine);
    addOutlined(palm, unitCylinder, terracottaMaterial, [0, 0.325, 0], null, [0.38, 0.045, 0.38], outlineLine);
    addOutlined(palm, unitCylinder, woodMaterial, [0, 0.62, 0], null, [0.062, 0.60, 0.062], outlineLine);
    addOutlined(palm, unitSphere, leafDeepMaterial, [0, 0.92, 0], null, [0.14, 0.11, 0.14], outlineLine);
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      const tilt = Math.PI / 2 - (i % 2 === 0 ? 0.95 : 0.72);
      addOutlined(
        palm,
        unitConeLow,
        i % 2 ? leafMaterial : leafLightMaterial,
        [Math.cos(angle) * 0.17, 0.94, Math.sin(angle) * 0.17],
        [0, -angle, tilt],
        [0.085, 0.46, 0.028],
        outlineLine
      );
    }
    return palm;
  }
  buildPalm(-0.86, -0.99, -0.44, 0.5);

  function buildBush(x, baseY, z, scale, primary, secondary) {
    const plant = new THREE.Group();
    plant.position.set(x, baseY, z);
    group.add(plant);
    addOutlined(plant, unitCylinder, terracottaMaterial, [0, 0.18 * scale, 0], null, [0.36 * scale, 0.36 * scale, 0.36 * scale], outlineLine);
    addOutlined(plant, unitCylinder, creamMaterial, [0, 0.355 * scale, 0], null, [0.40 * scale, 0.035 * scale, 0.40 * scale], outlineLine);
    [-0.62, -0.22, 0.22, 0.62].forEach((tilt, index) => {
      addOutlined(
        plant,
        unitCone,
        index % 2 ? secondary : primary,
        [Math.sin(index * 1.8) * 0.07 * scale, (0.62 + index * 0.05) * scale, Math.cos(index * 1.8) * 0.05 * scale],
        [0, index * 1.5, tilt],
        [0.26 * scale, 0.52 * scale, 0.26 * scale],
        outlineLine
      );
    });
    return plant;
  }
  buildBush(0.54, -0.975, -0.58, 1.0, leafMaterial, leafLightMaterial);
  buildBush(1.10, -0.975, -0.40, 0.82, leafDeepMaterial, leafMaterial);
  buildBush(-1.02, -1.36, -0.98, 0.92, leafDeepMaterial, leafLightMaterial);

  function buildGrass(x, baseY, z, scale) {
    const clump = new THREE.Group();
    clump.position.set(x, baseY, z);
    group.add(clump);
    addOutlined(clump, unitCylinder, creamMaterial, [0, 0.09 * scale, 0], null, [0.26 * scale, 0.18 * scale, 0.26 * scale], outlineLine);
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const tilt = 0.24 + (i % 3) * 0.13;
      addMesh(
        clump,
        unitConeLow,
        i % 3 === 0 ? leafLightMaterial : leafMaterial,
        [Math.cos(angle) * 0.05 * scale, (0.30 + (i % 4) * 0.035) * scale, Math.sin(angle) * 0.05 * scale],
        [Math.sin(angle) * tilt, 0, -Math.cos(angle) * tilt],
        [0.028 * scale, 0.34 * scale, 0.028 * scale]
      );
    }
    return clump;
  }
  /* 草团贴前岛左前角，比躺椅低一档，不抢轮廓。 */
  buildGrass(-1.00, -0.99, 0.44, 0.78);

  /* 高杆绿植：细杆 + 顶端放射叶，整棵约 1.73 高。
     镜头右向量是 (0.44, 0, 0.85)，画面的右侧对应房间的 +x +z 象限——
     也就是右前方；把高杆种在右前，才能真正压住画面右三分之一的空白
     （低矮盆栽种在右后只会缩在画面中部，看不出来）。 */
  function buildTallPlant(x, baseY, z, yaw, scale) {
    const plant = new THREE.Group();
    plant.position.set(x, baseY, z);
    plant.rotation.y = yaw;
    plant.scale.setScalar(scale);
    group.add(plant);
    addOutlined(plant, unitCylinder, terracottaMaterial, [0, 0.17, 0], null, [0.36, 0.34, 0.36], outlineLine);
    addOutlined(plant, unitCylinder, creamMaterial, [0, 0.345, 0], null, [0.40, 0.045, 0.40], outlineLine);
    addOutlined(plant, unitCylinder, woodMaterial, [0, 0.90, 0], null, [0.052, 1.14, 0.052], outlineLine);
    addOutlined(plant, unitSphere, leafDeepMaterial, [0, 1.50, 0], null, [0.11, 0.09, 0.11], outlineLine);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const tilt = Math.PI / 2 - (i % 2 === 0 ? 1.02 : 0.78);
      addOutlined(
        plant,
        unitConeLow,
        i % 2 ? leafLightMaterial : leafMaterial,
        [Math.cos(angle) * 0.13, 1.54, Math.sin(angle) * 0.13],
        [0, -angle, tilt],
        [0.075, 0.42, 0.026],
        outlineLine
      );
    }
    return plant;
  }
  buildTallPlant(0.94, -1.36, 0.80, 0.6, 1.0);
  buildTallPlant(1.00, -1.36, 0.14, 2.1, 0.78);
  buildBush(0.84, -1.36, 0.94, 0.86, leafMaterial, leafLightMaterial);

  /* 房间后左角高盆：压住左上角空白，也是后景的竖向收边。
     放到地板上（y = -1.36），底部收紧避免与背墙穿模。 */
  const cornerPlant = new THREE.Group();
  cornerPlant.position.set(-1.06, -1.36, -1.00);
  group.add(cornerPlant);
  addOutlined(cornerPlant, unitCylinder, terracottaMaterial, [0, 0.20, 0], null, [0.44, 0.40, 0.44], outlineLine);
  addOutlined(cornerPlant, unitCylinder, creamMaterial, [0, 0.41, 0], null, [0.46, 0.05, 0.46], outlineLine);
  addOutlined(cornerPlant, unitCylinder, leafDeepMaterial, [0, 0.66, 0], null, [0.05, 0.54, 0.05], outlineLine);
  [-0.9, -0.3, 0.3, 0.9].forEach((tilt, index) => {
    addOutlined(
      cornerPlant,
      unitCone,
      index % 2 ? leafLightMaterial : leafMaterial,
      [Math.sin(index - 1.5) * 0.10, 0.98 + index * 0.045, Math.cos(index - 1.5) * 0.12],
      [0, index * 1.4, tilt],
      [0.30, 0.62, 0.30],
      outlineLine
    );
  });

  /* ===============================================================
     § 10 · 顶灯：纸灯笼串
     两端必须落在实处：左端系在遮阳伞的伞杆上（伞面顶点 y=0.73，
     绳索从伞顶引出），右端挂到右墙内面的一枚小挂钩上。
     顶点 y = 0.92 + 管半径 0.009 = 0.929，最低处 0.76 再减灯笼
     半高 0.06 = 0.70，全部落在 y ≤ 1.12 之内（v3.0 首版两端悬空，
     像凭空飘着的一条线）。
     =============================================================== */
  const LIGHT_LEFT = [-1.04, 0.80, 0.18];
  const LIGHT_RIGHT = [1.24, 0.92, 0.20];
  const lightPath = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(LIGHT_LEFT[0], LIGHT_LEFT[1], LIGHT_LEFT[2]),
    new THREE.Vector3(0, 0.72, 0.36),
    new THREE.Vector3(LIGHT_RIGHT[0], LIGHT_RIGHT[1], LIGHT_RIGHT[2])
  );
  const lightStringGeometry = track(new THREE.TubeGeometry(lightPath, 32, 0.009, 6, false));
  addMesh(group, lightStringGeometry, navyMaterial);

  /* 墙钩：很短的一段横杆，让灯绳的右端有明确的着力点。 */
  addMesh(group, unitCylinder, navyMaterial, [1.26, 0.92, 0.20], [0, 0, Math.PI / 2], [0.020, 0.10, 0.020]);

  const bulbMaterial = glow(PALETTE.sunGlow[0], PALETTE.sunGlow[1], 0.62, 0.92);
  const lanternMaterial = toonPair(PALETTE.cream[0], PALETTE.cream[1], { transparent: true, opacity: 0.94 });
  for (let i = 0; i < 9; i += 1) {
    const point = lightPath.getPoint((i + 0.5) / 9);
    if (i % 3 === 1) {
      addOutlined(group, unitCylinder, lanternMaterial, [point.x, point.y - 0.085, point.z], null, [0.105, 0.12, 0.105], outlineLine);
      addMesh(group, unitCylinder, goldMaterial, [point.x, point.y - 0.005, point.z], null, [0.032, 0.026, 0.032]);
    } else {
      const bulb = addMesh(group, unitSphere, bulbMaterial, [point.x, point.y - 0.028, point.z], null, [0.040, 0.040, 0.040]);
      bulb.userData.baseY = point.y - 0.028;
      bulb.userData.phase = i * 0.8;
      animated.bulbs.push(bulb);
    }
  }

  /* ===============================================================
     主题更新：亮 / 暗 两套只换颜色与发光强度，不换几何与构图。
     =============================================================== */
  function applyTheme(tokens = {}) {
    const dark = tokens.scheme === "slate" || tokens.scheme === "dark";
    const light = dark ? 1 : 0;

    themeColorEntries.forEach((entry) => {
      entry.material.color.set(entry.lightHex && dark ? entry.darkHex : entry.lightHex);
    });

    /* 天空穹幕：按**顶点真实高度**取渐变，不依赖 PlaneGeometry 的顶点顺序
       （原来用裸下标查 stops，段数一改就整体错位）。天空板与背墙同尺寸，
       底边即地平线，4 段邻近色从地平线向天顶推进。 */
    const gradient = PALETTE.skyGrad[light];
    const colorAttribute = skyGeometry.getAttribute("color");
    const positionAttribute = skyGeometry.getAttribute("position");
    const skyBottom = SKY_CENTER_Y - SKY_H / 2;
    const scratch = new THREE.Color();
    const upperColor = new THREE.Color();
    for (let i = 0; i < colorAttribute.count; i += 1) {
      const raw = (positionAttribute.getY(i) - skyBottom) / SKY_H;
      /* 用 gamma 把色带压向地平线一侧，让落日附近更绵密、天顶更整片。 */
      const t = Math.min(1, Math.max(0, raw)) ** 1.35;
      const scaled = t * (gradient.length - 1);
      const lower = Math.floor(scaled);
      const upper = Math.min(gradient.length - 1, lower + 1);
      scratch.set(gradient[lower]).lerp(upperColor.set(gradient[upper]), scaled - lower);
      colorAttribute.setXYZ(i, scratch.r, scratch.g, scratch.b);
    }
    colorAttribute.needsUpdate = true;
    skyMaterial.color.set(PALETTE.skyBase[light]);

    cloudMaterial.color.set(PALETTE.cloud[light]);
    cloudMaterial.opacity = dark ? 0.26 : 0.34;
    cloudLowMaterial.opacity = dark ? 0.24 : 0.30;

    skylineFar.color.set(PALETTE.skylineFar[light]);
    skylineFar.opacity = dark ? 0.50 : 0.72;
    skylineMid.color.set(PALETTE.skylineMid[light]);
    skylineMid.opacity = dark ? 0.70 : 0.88;
    skylineNear.color.set(PALETTE.skylineNear[light]);

    starMaterial.color.set(PALETTE.star[light]);
    starMaterial.userData.baseOpacity = dark ? 0.92 : 0.16;
    starMaterial.opacity = starMaterial.userData.baseOpacity;
    starMaterial.size = dark ? 0.026 : 0.019;

    sunDiscMaterial.color.set(PALETTE.sunDisc[light]);
    sunCoreMaterial.color.set(PALETTE.sunCore[light]);
    /* 三层辉光共用一个暖色，只按主题调不透明度：夜里要更亮才压得住深蓝天。 */
    [sunHemMaterial, sunBloomMaterial, sunHaloMaterial].forEach((material, index) => {
      material.color.set(PALETTE.sunGlow[light]);
      const base = [0.20, 0.34, 0.52][index];
      material.opacity = base * (dark ? 1.25 : 1);
    });
    sunRayMaterial.color.set(PALETTE.sunGlow[light]);
    sunRayMaterial.opacity = (dark ? 1.25 : 1) * 0.40;

    /* 水面：按顶点铺「后左暖（接落日）→ 前右冷（映天顶）」的渐变。
       平面 rotate.x = -π/2 后 local +Y 映射到世界 -z（后缘），
       所以 ly 越大越靠后、lx 越小越靠左。 */
    waterMaterial.opacity = dark ? 0.90 : 0.88;
    {
      const colorAttribute = waterGeometry.getAttribute("color");
      const positionAttribute = waterGeometry.getAttribute("position");
      const deep = new THREE.Color(PALETTE.water[light]);
      const warm = new THREE.Color(PALETTE.waterWarm[light]);
      const scratch = new THREE.Color();
      for (let i = 0; i < colorAttribute.count; i += 1) {
        const back = (positionAttribute.getY(i) / POND_HALF + 1) / 2;
        const left = (1 - positionAttribute.getX(i) / POND_HALF) / 2;
        const glow = Math.min(1, Math.max(0, back * 0.74 + left * 0.26));
        scratch.copy(deep).lerp(warm, glow ** 2.4);
        colorAttribute.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      colorAttribute.needsUpdate = true;
    }

    glintWarm.color.set(PALETTE.glint[light]);
    glintCool.color.set(PALETTE.glint[dark ? 0 : 1]);
    pondGlintMaterial.color.set(PALETTE.pond[light]);
    pondGlintMaterial.opacity = dark ? 0.30 : 0.20;

    birdMaterial.color.set(PALETTE.skylineNear[light]);
    birdMaterial.opacity = dark ? 0.78 : 0.60;

    outlineLine.color.set(dark ? "#b9a9d2" : "#30264f");
    outlineLine.opacity = dark ? 0.52 : 0.34;

    emissiveEntries.forEach((entry) => {
      entry.material.emissive.copy(entry.material.color);
      entry.material.emissiveIntensity = dark ? entry.darkIntensity : entry.lightIntensity;
    });
  }

  /* ===============================================================
     动效：只有三类极小幅度——呼吸、漂浮、缓移。
     prefers-reduced-motion 下 delta 传 0，elapsed 不推进，画面停在首帧。
     =============================================================== */
  function update(delta, tokens = {}) {
    applyTheme(tokens);

    const step = delta > 0 && delta < 0.5 ? delta : 0;
    elapsed += step;
    const t = elapsed;

    /* 水面反光缓慢漂移 + 呼吸。 */
    animated.waterGlints.forEach((glint, index) => {
      glint.position.x = glint.userData.baseX + Math.sin(t * 0.22 + index) * 0.035;
      glint.material.opacity = glint.userData.baseOpacity + Math.sin(t * 0.8 + index * 0.7) * 0.05;
    });
    animated.pondGlints.forEach((ring) => {
      const scale = ring.userData.baseScale * (1 + Math.sin(t * 0.6 + ring.userData.phase) * 0.14);
      ring.scale.set(scale, scale, 1);
    });

    /* 灯珠上下漂浮（极小幅度）。 */
    animated.bulbs.forEach((bulb) => {
      bulb.position.y = bulb.userData.baseY + Math.sin(t * 1.3 + bulb.userData.phase) * 0.026;
    });

    /* 双岛不同相位、不同幅度的呼吸式漂浮。 */
    animated.islands.forEach((island) => {
      island.node.position.y = island.baseline + Math.sin(t * 0.55 + island.phase) * island.amplitude;
    });

    /* 伞面缓慢摇曳。 */
    if (animated.umbrella) {
      animated.umbrella.rotation.z = 0.05 + Math.sin(t * 0.5) * 0.008;
    }

    /* 日轮光晕与光芒呼吸（基准缩放必须还原，否则会累积漂移）。 */
    if (animated.sunHalo) {
      animated.sunHalo.scale.setScalar(0.62 * (1 + Math.sin(t * 0.7) * 0.035));
    }
    if (animated.sunRays) {
      animated.sunRays.scale.setScalar(1 + Math.sin(t * 0.6) * 0.05);
    }

    /* 云带横移。 */
    if (animated.cloudA) {
      animated.cloudA.position.x = Math.sin(t * 0.045) * 0.10;
      animated.cloudB.position.x = Math.sin(t * 0.038 + 2.1) * 0.13;
    }

    /* 星野脉动 + 飞鸟横移回卷。亮色下星几乎不可见，暗色下缓慢明灭。 */
    if (animated.starMaterial) {
      const base = animated.starMaterial.userData.baseOpacity || starMaterial.userData.baseOpacity;
      animated.starMaterial.opacity = base * (0.86 + Math.sin(t * 0.45) * 0.14);
    }
    if (animated.birds) {
      animated.birds.position.x = ((t * 0.012 + 0.4) % 1.6) - 0.8;
    }
  }

  function dispose() {
    geometries.forEach((geometry) => geometry.dispose());
    edgeGeometries.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    edgeCache.clear();
    group.clear();

    geometries.length = 0;
    edgeGeometries.length = 0;
    ownedMaterials.length = 0;
    themeColorEntries.length = 0;
    emissiveEntries.length = 0;
    animated.bulbs.length = 0;
    animated.waterGlints.length = 0;
    animated.pondGlints.length = 0;
    animated.islands.length = 0;
    animated.water = null;
    animated.umbrella = null;
    animated.starMaterial = null;
    animated.birds = null;
  }

  return { group, update, dispose };
}
