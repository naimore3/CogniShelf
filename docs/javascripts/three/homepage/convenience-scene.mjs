/* =============================================================
   墨海寻珠 · 主页 Three.js 场景入口
   历史文件名：convenience-scene.mjs；内部已切换为首页“房间解剖”框架。

   边界：
   - 只在 #convenience-scene 存在时动态加载 three 与场景子模块；
   - 只做 renderer / scene / 生命周期 / 主题与滚动接线；
   - 具体几何、材质、贴图、镜头、动画分别落在同目录组件中；
   - WebGL 不可用或初始化失败时保留 CSS 降级层。
   ============================================================= */

const CONTAINER_ID = "convenience-scene";
const LIVE_CLASS = "is-live";
const PIXEL_RATIO_MAX = 2;

let current = null;
let pending = null;
let initToken = 0;

const prefersReduced = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

function getContainer() {
  return document.getElementById(CONTAINER_ID);
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (error) {
    return false;
  }
}

function loadThree() {
  return import("three").catch(function () {
    return import(new URL("../../vendor/three/build/three.module.js", import.meta.url).href);
  });
}

function loadModules() {
  return Promise.all([
    loadThree(),
    import("./materials.mjs"),
    import("./canvas-textures.mjs"),
    import("./scene-builder.mjs"),
    import("./interior-builder.mjs"),
    import("./camera-rig.mjs"),
    import("./animation-loop.mjs"),
    import("./rain-system.mjs"),
    import("./scroll-map.mjs"),
    import("./floor-registry.mjs"),
    import("./lighting.mjs"),
    import("./scene-kit.mjs")
  ]);
}

function readTokens() {
  const styles = window.getComputedStyle(document.body);
  const token = (name, fallback) => {
    const value = styles.getPropertyValue(name);
    return value && value.trim() ? value.trim() : fallback;
  };

  return {
    scheme: document.body.getAttribute("data-md-color-scheme") || "default",
    stage: token("--nmd-stage", "#f4effa"),
    roomFloor: token("--nmd-room-floor", "#ffffff"),
    roomWall: token("--nmd-room-wall", "#efe6f8"),
    pillar: token("--nmd-pillar", "#d9cfe8"),
    base: token("--nmd-base", "#bfb0d8"),
    outline: token("--nmd-outline", "#2b3446"),
    stageFill: token("--nmd-stage-fill", "#ffffff"),
    roomKeyLight: token("--nmd-room-key-light", "#fff1dd"),
    roomFillLight: token("--nmd-room-fill-light", "#e8f2ff"),
    roomBounceLight: token("--nmd-room-bounce-light", "#f2e8ff"),
    particle: token("--nmd-particle", "#7c3aed"),
    particleOpacity: Number.parseFloat(token("--nmd-particle-opacity", "0.42"))
  };
}

function qualityProfile() {
  const coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
  const low = coarse || window.innerWidth < 900;
  return {
    particles: prefersReduced ? 0 : (low ? 42 : 90),
    shadows: !low && !prefersReduced
  };
}

function createScene(THREE, modules, container) {
  const quality = qualityProfile();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  /* 风格口径（2026-10-03 起）：ACES 色调映射 + VSM 软阴影。
     实测对比 AgX：同样曝光下 AgX 把高饱和色块压成灰粉调、面上对比度偏低，
     与参考图「明快高饱和块面」对不上；ACES 在 1.45 倍曝光下亮面仍不糊。 */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "nmd-scene-canvas";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(modules[9].ROOM_CAMERA.fov, 1, 0.1, 520);

  /* 棚拍环境贴图：哑光塑料的柔和明暗一半来自它。亮暗主题各烘一张，
     暗色主题必须换更暗的盒子，否则白盒子会把夜景照成灰板。 */
  const ENVIRONMENT_PALETTE = {
    light: {
      horizon: "#c9cee0",
      ceiling: "#ffffff",
      ground: "#5d5674",
      keyPanel: "#ffffff"
    },
    dark: {
      horizon: "#2e2850",
      ceiling: "#7d6cc0",
      ground: "#140e26",
      keyPanel: "#b9a6ff"
    }
  };
  let environment = null;

  function refreshEnvironment(dark) {
    if (environment) {
      scene.environment = null;
      environment.dispose();
    }
    environment = modules[11].createStudioEnvironment(
      THREE,
      renderer,
      dark ? ENVIRONMENT_PALETTE.dark : ENVIRONMENT_PALETTE.light
    );
    scene.environment = environment.texture;
  }

  refreshEnvironment(false);

  let tokens = readTokens();
  const materials = modules[1].createMaterialLibrary(THREE);
  materials.update(tokens);

  const textures = modules[2].createTextureLibrary(THREE);
  const builder = modules[3].createSceneBuilder(THREE, materials);
  const interiors = modules[4].buildInteriors(THREE, materials, modules[9].FLOORS);
  const lighting = modules[10].createRoomLighting(THREE, { shadows: quality.shadows });
  lighting.update(tokens);
  scene.add(builder.group);
  scene.add(interiors.group);
  scene.add(lighting.group);
  /* 播种主题 tokens：reduce 模式下 rAF 循环不启动，
     后续挂载的单层组件要靠 interior-builder 缓存的这份 tokens 换色。 */
  interiors.update(0, tokens);

  const rig = modules[5].createCameraRig(THREE, camera);
  const ambient = modules[7].createAmbientParticles(THREE, {
    count: quality.particles,
    areaX: 120,
    areaY: 52,
    areaZ: 36,
    centerY: 0,
    color: tokens.particle,
    opacity: tokens.particleOpacity,
    size: 0.085
  });
  scene.add(ambient.points);

  const sections = container.closest(".nmd-home, .nmd-story")
    ? container.closest(".nmd-home, .nmd-story").querySelectorAll(".nmd-chapter[data-floor]")
    : document.querySelectorAll(".nmd-chapter[data-floor]");
  const scrollMap = modules[8].createScrollMap(sections);

  let progress = 0;
  let activeFloor = 0;
  let disposed = false;

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function applyProgress(next) {
    progress = Math.min(1, Math.max(0, next || 0));
    const state = scrollMap.getState(progress);
    rig.setState(state);
    if (state.floor !== activeFloor) {
      activeFloor = state.floor;
      builder.setActiveFloor(activeFloor);
      interiors.setActiveFloor(activeFloor);
      lighting.setActiveFloor(activeFloor);
      document.dispatchEvent(new CustomEvent("nmd:floorchange", {
        detail: { floor: activeFloor }
      }));
    }
    if (prefersReduced) {
      rig.update(1);
      renderFrame();
    }
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    rig.frame();
    scrollMap.measure();
    applyProgress(progress);
  }

  function onScroll(event) {
    applyProgress(event.detail && event.detail.progress);
  }

  function onVisibility() {
    if (prefersReduced) return;
    if (document.hidden) loop.setPaused(true);
    else loop.setPaused(false);
  }

  const loop = modules[6].createAnimationLoop({
    onFrame(delta) {
      if (!prefersReduced) ambient.update(delta);
      rig.update(delta);
      interiors.update(delta, tokens);
      renderFrame();
    }
  });

  const themeObserver = new MutationObserver(() => {
    tokens = readTokens();
    refreshEnvironment(tokens.scheme !== "default");
    materials.update(tokens);
    ambient.setTheme(tokens);
    builder.update(tokens);
    lighting.update(tokens);
    /* 单层调色板也同步刷新：reduce 模式下 rAF 循环不启动，
       若不在此补调，楼层道具会停留在切换前的主题色。 */
    interiors.update(0, tokens);
    if (prefersReduced) renderFrame();
  });
  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"]
  });

  document.addEventListener("nmd:scroll", onScroll);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resize, { passive: true });
  if ("ResizeObserver" in window) {
    var resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
  } else {
    var resizeObserver = null;
  }

  builder.setActiveFloor(0);
  interiors.setActiveFloor(0);
  lighting.setActiveFloor(0);
  resize();
  const initialProgress = Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue("--nmd-scroll")
  ) || 0;
  applyProgress(initialProgress);
  rig.update(1);
  renderFrame();
  if (!prefersReduced) loop.start();

  return {
    container,
    destroy() {
      if (disposed) return;
      disposed = true;
      loop.stop();
      document.removeEventListener("nmd:scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      if (resizeObserver) resizeObserver.disconnect();
      themeObserver.disconnect();
      ambient.dispose();
      lighting.dispose();
      builder.dispose();
      interiors.dispose();
      textures.dispose();
      materials.dispose();
      if (environment) {
        scene.environment = null;
        environment.dispose();
        environment = null;
      }
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
}

async function initScene() {
  const container = getContainer();
  if (!container || current || pending === container) return;
  if (!hasWebGL()) return;

  const token = ++initToken;
  pending = container;
  container.dataset.nmdScene = "loading";
  try {
    const loaded = await loadModules();
    if (token !== initToken || !container.isConnected || getContainer() !== container) return;
    current = createScene(loaded[0], loaded, container);
    container.dataset.nmdScene = "ready";
    document.documentElement.classList.add("nmd-scene-ready");
    container.classList.add(LIVE_CLASS);
  } catch (error) {
    container.dataset.nmdScene = "fallback";
    console.warn("[nmd-scene] init failed, CSS fallback remains", error);
  } finally {
    if (pending === container) pending = null;
  }
}

function teardown() {
  initToken += 1;
  pending = null;
  if (!current) return;
  const container = current.container;
  current.destroy();
  current = null;
  if (container) {
    container.classList.remove(LIVE_CLASS);
    delete container.dataset.nmdScene;
  }
  document.documentElement.classList.remove("nmd-scene-ready");
}

function nodeRemoved(removedNodes, node) {
  for (let i = 0; i < removedNodes.length; i += 1) {
    const removed = removedNodes[i];
    if (removed === node || (removed.contains && removed.contains(node))) return true;
  }
  return false;
}

initScene();

if ("MutationObserver" in window) {
  new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i += 1) {
      if (current && mutations[i].removedNodes.length &&
          nodeRemoved(mutations[i].removedNodes, current.container)) {
        teardown();
        break;
      }
    }
    initScene();
  }).observe(document.documentElement, { childList: true, subtree: true });
}
