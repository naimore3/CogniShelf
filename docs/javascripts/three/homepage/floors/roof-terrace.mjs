/* F10 屋顶露台：漂浮日落花园。
   设计依据：.documents/首页设计/第十层屋顶露台设计.md v2.0。
   组件只使用房间本地坐标；前中后三层分别为浅水前景、双岛家具中景、日落天空后景。 */
export function createFloor(THREE, materials) {
  const group = new THREE.Group();
  group.name = "nmd-floor-roof";

  const geometries = [];
  const edgeGeometries = [];
  const edgeCache = new Map();
  const glowMaterials = [];
  const animated = {
    bulbs: [],
    water: null,
    umbrella: null,
    sunHalo: null,
    sunHaloOuter: null
  };

  function track(geometry) {
    geometries.push(geometry);
    return geometry;
  }

  function edgeFor(geometry) {
    if (!edgeCache.has(geometry)) {
      const edge = new THREE.EdgesGeometry(geometry, 28);
      edgeCache.set(geometry, edge);
      edgeGeometries.push(edge);
    }
    return edgeCache.get(geometry);
  }

  function applyTransform(object, position, rotation, scale) {
    if (position) object.position.set(position[0], position[1], position[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
  }

  function addMesh(parent, shape, material, position, rotation, scale) {
    const item = new THREE.Mesh(shape, material);
    applyTransform(item, position, rotation, scale);
    parent.add(item);
    return item;
  }

  function addOutlined(parent, shape, material, position, rotation, scale) {
    const item = addMesh(parent, shape, material, position, rotation, scale);
    const edge = new THREE.LineSegments(edgeFor(shape), palette.outline);
    applyTransform(edge, position, rotation, scale);
    parent.add(edge);
    return item;
  }

  function makeGlow(color, options = {}, intensity = 0.3) {
    const material = materials.toon(color, options);
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = intensity;
    glowMaterials.push(material);
    return material;
  }

  const palette = {
    coral: materials.toon("#f97316"),
    sun: makeGlow("#ffd166", {}, 0.38),
    sunSoft: makeGlow("#ffd166", { transparent: true, opacity: 0.52, depthWrite: false }, 0.26),
    glint: makeGlow("#ffd166", { transparent: true, opacity: 0.36, depthWrite: false }, 0.24),
    deck: materials.toon("#fff4dd"),
    deckEdge: materials.toon("#e8b98f"),
    terracotta: materials.toon("#d97758"),
    leaf: materials.toon("#4f9d69"),
    leafLight: materials.toon("#8bcf8a"),
    water: materials.toon("#56c8d8", { transparent: true, opacity: 0.84, depthWrite: false }),
    violet: materials.toon("#7656b8"),
    violetLight: materials.toon("#a78be0"),
    navy: materials.toon("#28345f"),
    white: materials.toon("#fffaf7"),
    skyTop: makeGlow("#8fb8e8", {}, 0.08),
    skyMid: makeGlow("#c7a3f0", {}, 0.09),
    skyCoral: makeGlow("#f4a58b", {}, 0.1),
    skyGold: makeGlow("#ffd98f", {}, 0.13),
    skyCloud: makeGlow("#fff1d6", { transparent: true, opacity: 0.72 }, 0.16),
    skyline: materials.toon("#3b2b61"),
    outline: materials.line("#30264f", { transparent: true, opacity: 0.34 })
  };

  /* 共享几何：所有道具用同一批基础体拼装，不加载外部模型与贴图。 */
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
  const unitCone = track(new THREE.ConeGeometry(0.5, 1, 10));
  const unitSphere = track(new THREE.SphereGeometry(0.5, 16, 10));
  const sunDisc = track(new THREE.CircleGeometry(0.26, 32));
  const sunHalo = track(new THREE.TorusGeometry(0.42, 0.022, 8, 40));
  const sunHaloOuter = track(new THREE.TorusGeometry(0.52, 0.012, 8, 40));
  const poolRim = track(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 8));
  const poolWater = track(new THREE.CylinderGeometry(0.72, 0.78, 0.05, 8));

  /* 后景：日落天空幕布 + 云带 + 城市剪影 + 落日圆盘。 */
  const skyZ = -1.19;
  addMesh(group, unitBox, palette.skyTop, [0, 0.79, skyZ], null, [2.70, 0.66, 0.04]);
  addMesh(group, unitBox, palette.skyMid, [0, 0.15, skyZ], null, [2.70, 0.62, 0.04]);
  addMesh(group, unitBox, palette.skyCoral, [0, -0.42, skyZ], null, [2.70, 0.52, 0.04]);
  addMesh(group, unitBox, palette.skyGold, [0, -1.02, skyZ], null, [2.70, 0.68, 0.04]);

  addMesh(group, unitBox, palette.skyCloud, [-0.55, 0.62, skyZ + 0.03], null, [0.62, 0.05, 0.02]);
  addMesh(group, unitBox, palette.skyCloud, [0.42, 0.30, skyZ + 0.03], null, [0.78, 0.045, 0.02]);
  addMesh(group, unitBox, palette.skyCloud, [-0.20, -0.16, skyZ + 0.03], null, [0.52, 0.04, 0.02]);

  [
    [-1.06, 0.18, 0.42],
    [-0.80, 0.22, 0.62],
    [-0.54, 0.16, 0.34],
    [0.60, 0.20, 0.50],
    [0.86, 0.18, 0.72],
    [1.08, 0.14, 0.40]
  ].forEach(([x, width, height]) => {
    addMesh(
      group,
      unitBox,
      palette.skyline,
      [x, -1.36 + height / 2, skyZ + 0.05],
      null,
      [width, height, 0.04]
    );
  });

  addMesh(group, sunDisc, palette.sun, [0.92, 0.50, skyZ + 0.09], null, null);
  animated.sunHalo = addMesh(group, sunHalo, palette.sunSoft, [0.92, 0.50, skyZ + 0.08], null, null);
  animated.sunHaloOuter = addMesh(group, sunHaloOuter, palette.sunSoft, [0.92, 0.50, skyZ + 0.07], null, null);

  /* 中景：左侧主木台 + 右侧花台，两岛之间留出可读的缝隙。 */
  addOutlined(group, unitBox, palette.deck, [-0.27, -1.18, -0.35], null, [1.20, 0.14, 1.02]);
  addMesh(group, unitBox, palette.deckEdge, [-0.27, -1.105, 0.14], null, [1.16, 0.03, 0.06]);
  addOutlined(group, unitBox, palette.violetLight, [0.84, -1.20, -0.30], null, [0.72, 0.12, 0.78]);

  /* 前景：八边形浅水镜面、池边与三块踏步石。 */
  addOutlined(group, poolRim, palette.deckEdge, [-0.42, -1.32, 0.78], null, [0.92, 1, 0.56]);
  const water = addMesh(group, poolWater, palette.water, [-0.42, -1.275, 0.78], null, [0.92, 1, 0.56]);
  water.renderOrder = 2;
  animated.water = water;

  [
    [-0.55, 0.70, 0.26, 0.03, 0.10],
    [-0.28, 0.84, 0.20, 0.025, -0.18],
    [-0.68, 0.92, 0.16, 0.022, 0.24]
  ].forEach(([x, z, width, depth, angle]) => {
    const glint = addMesh(
      group,
      unitBox,
      palette.glint,
      [x, -1.245, z],
      [0, angle, 0],
      [width, 0.008, depth]
    );
    glint.renderOrder = 3;
  });

  [
    [0.16, -1.23, 0.82],
    [0.30, -1.23, 0.52],
    [0.40, -1.23, 0.20]
  ].forEach(([x, y, z]) => {
    addOutlined(group, unitBox, palette.deck, [x, y, z], null, [0.18, 0.06, 0.18]);
  });

  /* 沙滩躺椅：座面、倾斜靠背、靠枕与四条腿，两张椅朝向略微错开。 */
  function createLounger(x, z, angle, color, accent) {
    const chair = new THREE.Group();
    chair.position.set(x, -1.11, z);
    chair.rotation.y = angle;
    group.add(chair);

    addOutlined(chair, unitBox, color, [0, 0.14, 0], null, [0.54, 0.08, 0.98]);
    addOutlined(chair, unitBox, color, [0, 0.34, -0.42], [-0.52, 0, 0], [0.54, 0.08, 0.64]);
    addMesh(chair, unitBox, palette.white, [0, 0.19, 0.02], null, [0.40, 0.03, 0.30]);
    addMesh(chair, unitBox, accent, [0, 0.198, 0.02], null, [0.10, 0.034, 0.30]);

    [[-0.20, -0.34], [0.20, -0.34], [-0.20, 0.34], [0.20, 0.34]].forEach(([lx, lz]) => {
      addOutlined(chair, unitBox, palette.deckEdge, [lx, 0.06, lz], null, [0.06, 0.12, 0.06]);
    });
  }
  createLounger(-0.50, -0.33, -0.16, palette.coral, palette.violet);
  createLounger(0.06, -0.33, 0.14, palette.violet, palette.coral);

  /* 遮阳伞：左中景的最高轮廓，伞面、伞杆、底座与顶珠分层。 */
  const umbrella = new THREE.Group();
  umbrella.position.set(-0.85, -1.11, -0.65);
  umbrella.rotation.z = 0.035;
  group.add(umbrella);
  addOutlined(umbrella, unitCylinder, palette.terracotta, [0, 0.94, 0], null, [0.05, 1.88, 0.05]);
  addOutlined(umbrella, unitCone, palette.coral, [0, 1.88, 0], [0, 0.20, 0], [1.16, 0.42, 1.16]);
  addMesh(umbrella, sunHaloOuter, palette.sunSoft, [0, 1.66, 0], [Math.PI / 2, 0, 0], [1.10, 1.10, 1]);
  addOutlined(umbrella, unitCylinder, palette.terracotta, [0, 0.03, 0], null, [0.28, 0.06, 0.28]);
  addMesh(umbrella, unitSphere, palette.sun, [0, 2.12, 0], null, [0.10, 0.10, 0.10]);
  animated.umbrella = umbrella;

  /* 吧台车：前景右侧的生活尺度物件，杯具与酒瓶用低面数圆柱简化。 */
  const cart = new THREE.Group();
  cart.position.set(0.98, -1.36, 0.95);
  group.add(cart);
  addOutlined(cart, unitBox, palette.white, [0, 0.22, 0], null, [0.42, 0.38, 0.34]);
  addOutlined(cart, unitBox, palette.sun, [0, 0.44, 0], null, [0.50, 0.05, 0.42]);
  addOutlined(cart, unitBox, palette.deckEdge, [0, 0.10, 0], null, [0.38, 0.03, 0.30]);
  [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]].forEach(([lx, lz]) => {
    addOutlined(cart, unitCylinder, palette.navy, [lx, 0.03, lz], [0, 0, Math.PI / 2], [0.07, 0.04, 0.07]);
  });
  addOutlined(cart, unitCylinder, palette.coral, [-0.12, 0.56, 0.02], null, [0.07, 0.18, 0.07]);
  addOutlined(cart, unitCylinder, palette.water, [0.10, 0.56, 0.02], null, [0.07, 0.18, 0.07]);
  addOutlined(cart, unitCylinder, palette.white, [0.00, 0.60, -0.12], null, [0.10, 0.24, 0.10]);

  /* 绿植盆栽：高、中、低三处错落，叶片用低面数锥体扇开。 */
  function createPlanter(x, baseY, z, scale, leafMaterial) {
    const plant = new THREE.Group();
    plant.position.set(x, baseY, z);
    group.add(plant);

    addOutlined(plant, unitCylinder, palette.terracotta, [0, 0.21 * scale, 0], null, [0.36 * scale, 0.42 * scale, 0.36 * scale]);
    addOutlined(plant, unitCylinder, palette.leaf, [0, 0.70 * scale, 0], null, [0.045 * scale, 1.0 * scale, 0.045 * scale]);

    [-0.95, -0.48, 0, 0.48, 0.95].forEach((tilt, index) => {
      addMesh(
        plant,
        unitCone,
        index % 2 ? palette.leafLight : leafMaterial,
        [Math.sin(index - 2) * 0.10 * scale, 1.05 * scale, Math.cos(index - 2) * 0.06 * scale],
        [0, index * 0.9, tilt],
        [0.30 * scale, 0.76 * scale, 0.30 * scale]
      );
    });
  }
  createPlanter(0.80, -1.14, -0.42, 1.0, palette.leaf);
  createPlanter(1.06, -1.36, 0.30, 0.85, palette.leafLight);
  createPlanter(-1.05, -1.36, -1.02, 0.8, palette.leafLight);

  /* 顶灯：一条从门前上方横跨的灯串，灯珠做极小幅度的上下漂浮。 */
  const lightPath = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.02, 1.08, 1.12),
    new THREE.Vector3(0, 0.90, 1.20),
    new THREE.Vector3(1.02, 1.08, 1.12)
  );
  const lightString = track(new THREE.TubeGeometry(lightPath, 24, 0.012, 6, false));
  addMesh(group, lightString, palette.navy, [0, 0, 0], null, null);
  for (let index = 0; index < 7; index += 1) {
    const point = lightPath.getPoint((index + 0.5) / 7);
    const bulb = addMesh(
      group,
      unitSphere,
      palette.sun,
      [point.x, point.y - 0.035, point.z],
      null,
      [0.055, 0.055, 0.055]
    );
    bulb.userData.baseY = point.y - 0.035;
    bulb.userData.phase = index * 0.85;
    animated.bulbs.push(bulb);
  }

  function update(delta, tokens = {}) {
    const dark = tokens.scheme === "slate";

    function setColor(material, lightColor, darkColor) {
      material.color.set(dark ? darkColor : lightColor);
    }

    setColor(palette.coral, "#f97316", "#ff9b62");
    setColor(palette.sun, "#ffd166", "#ffc75a");
    setColor(palette.sunSoft, "#ffd166", "#ffc75a");
    setColor(palette.glint, "#ffd166", "#ffc75a");
    setColor(palette.deck, "#fff4dd", "#f7f2ff");
    setColor(palette.deckEdge, "#e8b98f", "#b9846d");
    setColor(palette.terracotta, "#d97758", "#b86b67");
    setColor(palette.leaf, "#4f9d69", "#6bbf86");
    setColor(palette.leafLight, "#8bcf8a", "#a5e09a");
    setColor(palette.water, "#56c8d8", "#33e3f1");
    setColor(palette.violet, "#7656b8", "#b26bff");
    setColor(palette.violetLight, "#a78be0", "#4a367d");
    setColor(palette.navy, "#28345f", "#14162c");
    setColor(palette.white, "#fffaf7", "#f4f1ff");
    setColor(palette.skyTop, "#8fb8e8", "#28345f");
    setColor(palette.skyMid, "#c7a3f0", "#59418f");
    setColor(palette.skyCoral, "#f4a58b", "#b6536f");
    setColor(palette.skyGold, "#ffd98f", "#e2a04a");
    setColor(palette.skyCloud, "#fff1d6", "#e7c7ff");
    setColor(palette.skyline, "#3b2b61", "#17102b");

    palette.outline.color.set(dark ? "#b9a9d2" : "#30264f");
    palette.outline.opacity = dark ? 0.5 : 0.34;
    glowMaterials.forEach((material) => material.emissive.copy(material.color));

    const t = performance.now() * 0.001;
    animated.bulbs.forEach((bulb) => {
      bulb.position.y = bulb.userData.baseY + Math.sin(t * 1.4 + bulb.userData.phase) * 0.035;
    });
    if (animated.water) {
      animated.water.material.opacity = 0.80 + Math.sin(t * 0.9) * 0.04;
    }
    palette.glint.opacity = (dark ? 0.44 : 0.34) + Math.sin(t * 1.1) * 0.06;
    if (animated.umbrella) {
      animated.umbrella.rotation.z = 0.035 + Math.sin(t * 0.55) * 0.006;
    }
    if (animated.sunHalo) {
      animated.sunHalo.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
      animated.sunHaloOuter.scale.setScalar(1 + Math.sin(t * 0.8 + 0.8) * 0.025);
    }
  }

  function dispose() {
    geometries.forEach((item) => item.dispose());
    edgeGeometries.forEach((item) => item.dispose());
    edgeCache.clear();
    group.clear();
    geometries.length = 0;
    edgeGeometries.length = 0;
    animated.bulbs.length = 0;
  }

  return { group, update, dispose };
}
