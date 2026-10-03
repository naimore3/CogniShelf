/* 三渲二材质库：地板 / 墙面 / 支柱 / 底座 + 分档 toon + 描边。
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
    pillar: toon("#d9cfe8"),
    base: toon("#bfb0d8"),
    outline: line("#2b3446", { opacity: 0.26 })
  };

  function update(tokens = {}) {
    palette.stage.color.copy(toColor(THREE, tokens.stage, "#f4effa"));
    palette.roomFloor.color.copy(toColor(THREE, tokens.roomFloor, "#ffffff"));
    palette.roomWall.color.copy(toColor(THREE, tokens.roomWall, "#efe6f8"));
    palette.pillar.color.copy(toColor(THREE, tokens.pillar, "#d9cfe8"));
    palette.base.color.copy(toColor(THREE, tokens.base, "#bfb0d8"));
    palette.outline.color.copy(toColor(THREE, tokens.outline, "#2b3446"));
  }

  function dispose() {
    materials.forEach((material) => material.dispose());
    outlineMaterials.forEach((material) => material.dispose());
    gradientMap.dispose();
    materials.length = 0;
    outlineMaterials.length = 0;
  }

  return {
    palette,
    toon,
    line,
    update,
    dispose
  };
}
