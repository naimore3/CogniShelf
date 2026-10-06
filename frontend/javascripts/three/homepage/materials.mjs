/* 材质库：房间壳与楼层的哑光塑料材质 + 主题 token 接线。
   颜色全部由 homepage.css 的 --nmd-* tokens 驱动，亮暗主题只换 token。

   风格口径（2026-10-03 起）：柔光玩具棚拍 / soft-lit designer-toy diorama ——
   平滑着色的哑光塑料（MeshStandardMaterial），不用 toon 分档、不用描边、不做后处理。
   toon() / line() 作为旧口径接口保留，但已退出场景使用（总纲 v3.13 §9 要求场景内
   三者命中数为 0），gradientMap 因此改为按需创建，不再无条件占一张贴图。
   ============================================================= */

const PLASTIC = {
  metalness: 0,
  roughness: 0.42,
  envMapIntensity: 0.3
};

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
  const materials = [];
  const outlineMaterials = [];
  let gradientMap = null;

  /* 旧口径（三渲二分档），保留接口供历史楼层与回归对比使用。 */
  function toon(color, options = {}) {
    if (!gradientMap) gradientMap = createGradientMap(THREE);
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

  /* 当前口径：哑光塑料。metalness 恒为 0，明暗主要靠 scene.environment 塑形。 */
  function plastic(color, options = {}) {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: options.metalness == null ? PLASTIC.metalness : options.metalness,
      roughness: options.roughness == null ? PLASTIC.roughness : options.roughness,
      envMapIntensity: options.envMapIntensity == null
        ? PLASTIC.envMapIntensity
        : options.envMapIntensity,
      transparent: Boolean(options.transparent),
      opacity: options.opacity == null ? 1 : options.opacity,
      depthWrite: options.depthWrite !== false,
      flatShading: Boolean(options.flatShading),
      vertexColors: Boolean(options.vertexColors),
      side: options.side == null ? THREE.FrontSide : options.side
    });
    if (options.emissive != null) {
      material.emissive = new THREE.Color(options.emissive);
      material.emissiveIntensity = options.emissiveIntensity == null
        ? 1
        : options.emissiveIntensity;
    }
    materials.push(material);
    return material;
  }

  const palette = {
    stage: plastic("#f4effa"),
    roomFloor: plastic("#ffffff"),
    roomWall: plastic("#efe6f8"),
    pillar: plastic("#d9cfe8"),
    base: plastic("#bfb0d8")
  };

  function update(tokens = {}) {
    palette.stage.color.copy(toColor(THREE, tokens.stage, "#f4effa"));
    palette.roomFloor.color.copy(toColor(THREE, tokens.roomFloor, "#ffffff"));
    palette.roomWall.color.copy(toColor(THREE, tokens.roomWall, "#efe6f8"));
    palette.pillar.color.copy(toColor(THREE, tokens.pillar, "#d9cfe8"));
    palette.base.color.copy(toColor(THREE, tokens.base, "#bfb0d8"));
  }

  function dispose() {
    materials.forEach((material) => material.dispose());
    outlineMaterials.forEach((material) => material.dispose());
    if (gradientMap) gradientMap.dispose();
    materials.length = 0;
    outlineMaterials.length = 0;
    gradientMap = null;
  }

  return {
    palette,
    plastic,
    toon,
    line,
    update,
    dispose
  };
}
