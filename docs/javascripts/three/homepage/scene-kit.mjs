/* 场景形体与光学工具箱：圆角箱、接触阴影贴片、棚拍环境贴图。
   三个工具都自带缓存与 dispose，框架与各楼层组件共用，避免每层各写一份。

   只依赖 three 核心：docs/javascripts/vendor/three/examples/jsm/ 下没有
   geometries / environments / postprocessing 三个目录，所以 RoundedBoxGeometry、
   RoomEnvironment 这类扩展都不可用，圆角箱与环境贴图必须自建。
   ============================================================= */

/* 圆角半径：默认取最短边的 5%，夹在 [0.02, 0.09]；
   同时不许超过最短边的 1/3，否则圆角矩形会自交出破面。 */
const RADIUS_RATIO = 0.05;
const RADIUS_MIN = 0.02;
const RADIUS_MAX = 0.09;

/* 接触阴影贴片：从圆心到边缘分四圈，顶点色第四分量（alpha）逐圈衰减。
   顶点色 itemSize = 4 时 three 会启用 vertexAlphas，不需要任何贴图。 */
const DECAL_RINGS = [0, 0.55, 0.8, 1];
const DECAL_ALPHAS = [1, 0.6, 0.24, 0];
const DECAL_SEGMENTS = 26;

function clampRadius(width, height, depth, requested) {
  const minSide = Math.min(width, height, depth);
  const wanted = requested == null
    ? minSide * RADIUS_RATIO
    : requested;
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.min(wanted, minSide / 3)));
}

function roundedRectShape(THREE, width, height, radius, shape) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const r = Math.min(radius, halfWidth, halfHeight);
  const left = -halfWidth;
  const right = halfWidth;
  const bottom = -halfHeight;
  const top = halfHeight;

  shape.moveTo(left + r, bottom);
  shape.lineTo(right - r, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + r);
  shape.lineTo(right, top - r);
  shape.quadraticCurveTo(right, top, right - r, top);
  shape.lineTo(left + r, top);
  shape.quadraticCurveTo(left, top, left, top - r);
  shape.lineTo(left, bottom + r);
  shape.quadraticCurveTo(left, bottom, left + r, bottom);
  return shape;
}

/* ExtrudeGeometry 产出的是非索引几何，computeVertexNormals() 只能得到逐面法线，
   圆角截面会一块块发硬。把重合顶点焊起来再算法线，倒角与平面之间才是连续明暗。 */
function weldByPosition(THREE, source, precision) {
  const position = source.getAttribute("position");
  const factor = Math.pow(10, precision);
  const lookup = new Map();
  const points = [];
  const indices = new Array(position.count);

  for (let i = 0; i < position.count; i += 1) {
    const x = Math.round(position.getX(i) * factor) / factor;
    const y = Math.round(position.getY(i) * factor) / factor;
    const z = Math.round(position.getZ(i) * factor) / factor;
    const key = x + "," + y + "," + z;
    let index = lookup.get(key);
    if (index === undefined) {
      index = points.length / 3;
      lookup.set(key, index);
      points.push(x, y, z);
    }
    indices[i] = index;
  }

  const welded = new THREE.BufferGeometry();
  welded.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  welded.setIndex(indices);
  welded.computeVertexNormals();
  source.dispose();
  return welded;
}

export function createShapeKit(THREE) {
  const boxCache = new Map();
  const decalCache = new Map();
  const owned = new Set();

  function track(geometry) {
    owned.add(geometry);
    return geometry;
  }

  /* 圆角箱：宽/高/深 + 圆角半径，中心落在原点，参数相同即命中缓存。
     形状画在 XY 面、沿 Z 挤出，因此 width→X、height→Y、depth→Z。 */
  function roundedBox(width, height, depth, requestedRadius) {
    const radius = clampRadius(width, height, depth, requestedRadius);
    const key = [width, height, depth, radius].map((n) => n.toFixed(4)).join(":");
    const cached = boxCache.get(key);
    if (cached) return cached;

    const shape = roundedRectShape(
      THREE,
      width - radius * 2,
      height - radius * 2,
      radius,
      new THREE.Shape()
    );
    const raw = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.0001, depth - radius * 2),
      bevelEnabled: true,
      bevelThickness: radius,
      bevelSize: radius,
      bevelSegments: 2,
      curveSegments: 3,
      steps: 1
    });
    raw.center();
    const geometry = track(weldByPosition(THREE, raw, 4));
    boxCache.set(key, geometry);
    return geometry;
  }

  /* 接触阴影贴片：圆心朝边缘 alpha 递减的圆片，平铺在 XZ 面上（法线朝 +Y）。
     移动端 shadowMap 关闭时，它是唯一能钉住物件的落地感来源。 */
  function shadowDecal(radius) {
    const key = radius.toFixed(4);
    const cached = decalCache.get(key);
    if (cached) return cached;

    const positions = [0, 0, 0];
    const colors = [1, 1, 1, DECAL_ALPHAS[0]];
    const indices = [];
    const ringStart = [0];

    for (let ring = 1; ring < DECAL_RINGS.length; ring += 1) {
      ringStart[ring] = positions.length / 3;
      const r = DECAL_RINGS[ring] * radius;
      for (let i = 0; i <= DECAL_SEGMENTS; i += 1) {
        const angle = (i / DECAL_SEGMENTS) * Math.PI * 2;
        positions.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        colors.push(1, 1, 1, DECAL_ALPHAS[ring]);
      }
    }

    for (let i = 0; i < DECAL_SEGMENTS; i += 1) {
      indices.push(0, ringStart[1] + i + 1, ringStart[1] + i);
    }
    for (let ring = 1; ring < DECAL_RINGS.length - 1; ring += 1) {
      const inner = ringStart[ring];
      const outer = ringStart[ring + 1];
      for (let i = 0; i < DECAL_SEGMENTS; i += 1) {
        indices.push(inner + i, outer + i + 1, outer + i);
        indices.push(inner + i, inner + i + 1, outer + i + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const tracked = track(geometry);
    decalCache.set(key, tracked);
    return tracked;
  }

  function dispose() {
    owned.forEach((geometry) => geometry.dispose());
    owned.clear();
    boxCache.clear();
    decalCache.clear();
  }

  return { roundedBox, shadowDecal, dispose };
}

/* 棚拍环境贴图：自发光盒体（上亮 / 四周中 / 下暗 + 一块更亮的侧板）经核心
   PMREMGenerator.fromScene() 预卷积成 IBL。哑光塑料的柔和明暗主要来自它，
   不依赖任何 examples/jsm 扩展（vendor 里没有 environments 目录）。
   返回 { texture, dispose }：texture 交给 scene.environment，环境换了要 dispose。 */
export function createStudioEnvironment(THREE, renderer, options = {}) {
  const horizon = options.horizon || "#c9cee0";
  const ceiling = options.ceiling || "#ffffff";
  const ground = options.ground || "#5d5674";
  const keyPanel = options.keyPanel || "#ffffff";

  const scene = new THREE.Scene();
  const built = [];

  function addPanel(width, height, position, rotation, color) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    scene.add(mesh);
    built.push(geometry, material);
    return mesh;
  }

  const hallGeometry = new THREE.BoxGeometry(20, 20, 20);
  const hallMaterial = new THREE.MeshBasicMaterial({
    color: horizon,
    side: THREE.BackSide,
    toneMapped: false
  });
  scene.add(new THREE.Mesh(hallGeometry, hallMaterial));
  built.push(hallGeometry, hallMaterial);

  addPanel(18, 18, [0, 9.6, 0], [Math.PI / 2, 0, 0], ceiling);
  addPanel(18, 18, [0, -9.6, 0], [-Math.PI / 2, 0, 0], ground);
  addPanel(8, 7, [-5.6, 6.2, 5.6], [0, -Math.PI / 4, Math.PI / 9], keyPanel);

  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.03, 0.1, 120);
  generator.dispose();
  built.forEach((item) => item.dispose());
  scene.clear();

  return {
    texture: target.texture,
    dispose() {
      target.dispose();
    }
  };
}
