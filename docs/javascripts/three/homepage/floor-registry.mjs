/* 主页房间注册表：滚动顺序、房间坐标、统一机位与单层组件加载的唯一事实来源。

   空间语义：
   - F10（屋顶露台）是顶楼，F1 是底层；
   - 向下滚动的顺序是 F0 → F10 → F9 → … → F1；
   - 所有房间同尺寸、同朝向，沿画面右上到左下串成一条链；
   - 每间房右上角接上一间、左下角接下一间，只在对角顶点接触；
   - 摄像机固定在房间左顶角外侧，沿左顶角向房间中心向内看；
   - 摄像机水平偏移沿房间链在地面的投影，保证所有机位落在过链的同一竖直面上；
   - 下一间中心偏移固定为 Δx = -w、Δy = -h、Δz = +d；
   - 上一间左下前角与下一间右上后角只在一点接触，链整体朝相机方向前进；
   - 每间房下方有实心支柱和底座。
   ============================================================= */

/* 房间尺寸：地面为正方形（width = depth，即 w = d），height 独立；
   数值只锁定比例、不放大整体尺寸（占地 4.2×2.2 → 3.0×3.0，高不变）。
   依据：.documents/首页设计/场景设计概述.md v3.12。 */
export const ROOM_SIZE = {
  width: 3.0,
  height: 3.2,
  depth: 3.0
};

export const ROOM_COUNT = 10;
export const ROOM_STEP_X = -ROOM_SIZE.width;
export const ROOM_STEP_Y = -ROOM_SIZE.height;
export const ROOM_STEP_Z = ROOM_SIZE.depth;
export const ROOM_CHAIN_START = {
  x: ((ROOM_COUNT - 1) * ROOM_SIZE.width) / 2,
  y: ((ROOM_COUNT - 1) * ROOM_SIZE.height) / 2,
  z: 0
};

/* 所有房间共享同一套局部机位；镜头固定在左顶角外侧，沿左顶角向内看。 */
export const ROOM_CAMERA = {
  boxCorner: "left-top-front",
  offset: [-7.5, 2.2, 3.9],
  lookAt: [0, 0.05, 0],
  fov: 32,
  targetHeight: 0.65
};

/* 摄像机从左顶角向内看时最近的三个面就是开口面。 */
export const ROOM_OPENING_FACES = ["top", "front", "left"];
export const ROOM_KEEP_FACES = ["floor", "back", "right"];

function roomPosition(index) {
  return [
    ROOM_CHAIN_START.x + ROOM_STEP_X * index,
    ROOM_CHAIN_START.y + ROOM_STEP_Y * index,
    ROOM_CHAIN_START.z + ROOM_STEP_Z * index
  ];
}

export const FLOORS = [
  { id: "cover", floor: 0, title: "封面", sectionId: "nmd-home-0", accentVar: "--nmd-floor-cover", position: [0, 0, 0], load: () => import("./floors/cover.mjs") },
  { id: "roof", floor: 10, title: "屋顶露台", sectionId: "nmd-home-10", accentVar: "--nmd-floor-roof", position: roomPosition(0), load: () => import("./floors/roof-terrace.mjs") },
  { id: "observatory", floor: 9, title: "天文台", sectionId: "nmd-home-9", accentVar: "--nmd-floor-observatory", position: roomPosition(1), load: () => import("./floors/observatory.mjs") },
  { id: "studio", floor: 8, title: "工作室", sectionId: "nmd-home-8", accentVar: "--nmd-floor-studio", position: roomPosition(2), load: () => import("./floors/studio.mjs") },
  { id: "lab", floor: 7, title: "实验室", sectionId: "nmd-home-7", accentVar: "--nmd-floor-lab", position: roomPosition(3), load: () => import("./floors/laboratory.mjs") },
  { id: "class", floor: 6, title: "教室", sectionId: "nmd-home-6", accentVar: "--nmd-floor-class", position: roomPosition(4), load: () => import("./floors/classroom.mjs") },
  { id: "music", floor: 5, title: "音乐室", sectionId: "nmd-home-5", accentVar: "--nmd-floor-music", position: roomPosition(5), load: () => import("./floors/music-room.mjs") },
  { id: "cafe", floor: 4, title: "咖啡馆", sectionId: "nmd-home-4", accentVar: "--nmd-floor-cafe", position: roomPosition(6), load: () => import("./floors/cafe.mjs") },
  { id: "store", floor: 3, title: "便利店", sectionId: "nmd-home-3", accentVar: "--nmd-floor-store", position: roomPosition(7), load: () => import("./floors/convenience-store.mjs") },
  { id: "library", floor: 2, title: "图书馆", sectionId: "nmd-home-2", accentVar: "--nmd-floor-library", position: roomPosition(8), load: () => import("./floors/library.mjs") },
  { id: "burger", floor: 1, title: "汉堡店", sectionId: "nmd-home-1", accentVar: "--nmd-floor-burger", position: roomPosition(9), load: () => import("./floors/burger-shop.mjs") }
];

export function getFloorItem(floor) {
  return FLOORS.find((item) => item.floor === Number(floor)) || FLOORS[0];
}

export function getFloorPosition(floor) {
  return getFloorItem(floor).position;
}

export function getFloorY(floor) {
  return getFloorPosition(floor)[1];
}

export function getNextFloor(floor) {
  const value = Number(floor);
  if (value <= 1) return value;
  return value - 1;
}

export function getNextFloorPosition(floor) {
  return getFloorPosition(getNextFloor(floor));
}

export function getNextFloorY(floor) {
  return getNextFloorPosition(floor)[1];
}

export function getNeighbourFloors(floor) {
  const index = FLOORS.findIndex((item) => item.floor === Number(floor));
  if (index < 0) return [Number(floor)];
  return [index - 1, index, index + 1]
    .filter((value) => value >= 0 && value < FLOORS.length)
    .map((value) => FLOORS[value].floor);
}

export function getChainBounds() {
  const rooms = FLOORS.filter((item) => item.floor !== 0);
  const xs = rooms.map((item) => item.position[0]);
  const ys = rooms.map((item) => item.position[1]);
  const zs = rooms.map((item) => item.position[2]);
  const minX = Math.min.apply(null, xs) - ROOM_SIZE.width / 2;
  const maxX = Math.max.apply(null, xs) + ROOM_SIZE.width / 2;
  const minY = Math.min.apply(null, ys) - ROOM_SIZE.height / 2;
  const maxY = Math.max.apply(null, ys) + ROOM_SIZE.height / 2;
  const minZ = Math.min.apply(null, zs) - ROOM_SIZE.depth / 2;
  const maxZ = Math.max.apply(null, zs) + ROOM_SIZE.depth / 2;
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    spanX: maxX - minX,
    spanY: maxY - minY,
    spanZ: maxZ - minZ
  };
}
