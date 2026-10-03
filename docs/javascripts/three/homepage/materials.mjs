/* 三渲二材质库：房间框架 / 地板 / 墙面 / 支柱 / 底座 + 分档 toon + 描边。
   颜色全部由 homepage.css 的 --nmd-* tokens 驱动，亮暗主题只换 token。 */

function createGradientMap(THREE) {
  const steps = new Uint8Array([70, 150, 235]);
  const texture = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function toColor(THREE, value, fallback) {
  try {
    return new THREE.Color(value || fallback);
  } catch (error) {
    return new THREE.Color(fallback);
  }
}

export function createMaterialLibrary(THREE) {
  const gradientMap = createGradientMap(THREE);
  const materials = [];
  const outlineMaterials = [];
  const accentMaterials = new Map();

  function toon(color, options = {}) {
    const material = new THREE.MeshToonMaterial({
      color,
      gradientMap,
      transparent: Boolean(options.transparent),
      opacity: options.opacity == null ? 1 : options.opacity,
      depthWrite: options.depthWrite !== false
    });
    materials.push(material);
    return material;
  }

  function line(color, options = {}) {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: Boolean(options.transparent),
      opacity: options.opacity == null ? 0.28 : options.opacity
    });
    outlineMaterials.push(material);
    return material;
  }

  const palette = {
    stage: toon("#f4effa"),
    roomFloor: toon("#ffffff"),
    roomWall: toon("#efe6f8"),
    roomFrame: toon("#ffffff"),
    pillar: toon("#d9cfe8"),
    base: toon("#bfb0d8"),
    interior: toon("#ffffff", { transparent: true, opacity: 0.68 }),
    outline: line("#2b3446", { opacity: 0.26 })
  };

  const floorIds = [
    { id: "cover", floor: 0 },
    { id: "roof", floor: 10 },
    { id: "observatory", floor: 9 },
    { id: "studio", floor: 8 },
    { id: "lab", floor: 7 },
    { id: "class", floor: 6 },
    { id: "music", floor: 5 },
    { id: "cafe", floor: 4 },
    { id: "store", floor: 3 },
    { id: "library", floor: 2 },
    { id: "burger", floor: 1 }
  ];
  floorIds.forEach(({ floor }) => {
    accentMaterials.set(floor, toon("#7c3aed", { transparent: true, opacity: 0.92 }));
  });

  function update(tokens = {}) {
    palette.stage.color.copy(toColor(THREE, tokens.stage, "#f4effa"));
    palette.roomFloor.color.copy(toColor(THREE, tokens.roomFloor, "#ffffff"));
    palette.roomWall.color.copy(toColor(THREE, tokens.roomWall, "#efe6f8"));
    palette.roomFrame.color.copy(toColor(THREE, tokens.roomFrame, "#ffffff"));
    palette.pillar.color.copy(toColor(THREE, tokens.pillar, "#d9cfe8"));
    palette.base.color.copy(toColor(THREE, tokens.base, "#bfb0d8"));
    palette.interior.color.copy(toColor(THREE, tokens.interior, "#ffffff"));
    palette.outline.color.copy(toColor(THREE, tokens.outline, "#2b3446"));

    floorIds.forEach(({ id, floor }) => {
      accentMaterials.get(floor).color.copy(
        toColor(THREE, tokens[`floor-${id}`], "#7c3aed")
      );
    });
  }

  function dispose() {
    materials.forEach((material) => material.dispose());
    outlineMaterials.forEach((material) => material.dispose());
    gradientMap.dispose();
    materials.length = 0;
    outlineMaterials.length = 0;
    accentMaterials.clear();
  }

  return {
    palette,
    accentMaterials,
    toon,
    line,
    update,
    dispose
  };
}
