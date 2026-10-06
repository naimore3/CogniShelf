/* 主页房间群：所有房间同尺寸（地面正方形 w = d）、同朝向，沿右上—左下串成链。
   摄像机从左顶角向内看，因此去掉最近三面（顶面、正面、左侧）；
   保留地板、背墙和右侧墙。每间房下方有独立的实心支柱和底座；
   这里只搭结构，不实现各楼层道具。

   风格口径（2026-10-03 起）：柔光玩具棚拍 —— 房间壳用哑光塑料 + 全圆角，
   不再用 toon 分档与 EdgesGeometry 描边（圆角箱来自 scene-kit，vendor 里没有
   RoundedBoxGeometry 扩展）。 */

import { FLOORS, ROOM_SIZE } from "./floor-registry.mjs";
import { createShapeKit } from "./scene-kit.mjs";

const FRAME = 0.22;
const SUPPORT_HEIGHT = 1.2;
const BASE_HEIGHT = 0.34;
const SHELL_RADIUS = 0.045;
const FLOOR_RADIUS = 0.06;

export function createSceneBuilder(THREE, materials) {
  const group = new THREE.Group();
  group.name = "nmd-room-chain";

  const shapes = createShapeKit(THREE);
  const geometries = [];
  const roomGroups = new Map();
  const supportGroups = new Map();

  const { width, height, depth } = ROOM_SIZE;

  function addMesh(parent, geometry, position, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  }

  function enableShadows(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      const material = object.material;
      object.castShadow = !(material && material.transparent);
      object.receiveShadow = true;
    });
  }

  /* 圆角箱按 (w,h,d,r) 缓存，10 间房共用同一批几何。 */
  const floorGeometry = shapes.roundedBox(width, 0.24, depth, FLOOR_RADIUS);
  const backWallGeometry = shapes.roundedBox(width, height, FRAME, SHELL_RADIUS);
  const sideWallGeometry = shapes.roundedBox(FRAME, height, depth, SHELL_RADIUS);
  const pillarGeometry = shapes.roundedBox(
    width * 0.28,
    SUPPORT_HEIGHT,
    depth * 0.28,
    SHELL_RADIUS
  );
  const baseGeometry = shapes.roundedBox(
    width * 0.42,
    BASE_HEIGHT,
    depth * 0.42,
    SHELL_RADIUS
  );
  geometries.push(
    floorGeometry,
    backWallGeometry,
    sideWallGeometry,
    pillarGeometry,
    baseGeometry
  );

  const rooms = FLOORS.filter((item) => item.floor !== 0);

  rooms.forEach((item, index) => {
    const room = new THREE.Group();
    room.name = `nmd-room-${item.id}`;
    room.position.set(item.position[0], item.position[1], item.position[2]);
    room.userData.orderIndex = index;

    // 地板、背墙、右侧墙：所有房间保持完全相同的左顶角开口。
    addMesh(
      room,
      floorGeometry,
      new THREE.Vector3(0, -height / 2 + 0.12, 0),
      materials.palette.roomFloor
    );
    addMesh(
      room,
      backWallGeometry,
      new THREE.Vector3(0, 0, -depth / 2 + FRAME / 2),
      materials.palette.roomWall
    );
    addMesh(
      room,
      sideWallGeometry,
      new THREE.Vector3(width / 2 - FRAME / 2, 0, 0),
      materials.palette.roomWall
    );

    enableShadows(room);
    group.add(room);
    roomGroups.set(item.floor, room);

    // 每间房独立支柱 + 底座：直接落在本房间地板下方，不连接到共用塔基。
    const support = new THREE.Group();
    support.name = `nmd-support-${item.id}`;
    support.position.set(item.position[0], item.position[1], item.position[2]);
    support.userData.orderIndex = index;

    addMesh(
      support,
      pillarGeometry,
      new THREE.Vector3(0, -height / 2 - SUPPORT_HEIGHT / 2, 0),
      materials.palette.pillar
    );
    addMesh(
      support,
      baseGeometry,
      new THREE.Vector3(0, -height / 2 - SUPPORT_HEIGHT - BASE_HEIGHT / 2, 0),
      materials.palette.base
    );

    enableShadows(support);
    group.add(support);
    supportGroups.set(item.floor, support);
  });

  function update(tokens) {
    materials.update(tokens);
  }

  function setActiveFloor(floor) {
    const overview = floor === 0;
    const activeIndex = overview
      ? -1
      : rooms.findIndex((item) => item.floor === floor);

    roomGroups.forEach((room) => {
      const index = room.userData.orderIndex;
      room.visible = overview || Math.abs(index - activeIndex) <= 1;
    });

    supportGroups.forEach((support) => {
      const index = support.userData.orderIndex;
      support.visible = overview || Math.abs(index - activeIndex) <= 1;
    });
  }

  function dispose() {
    shapes.dispose();
    group.clear();
    geometries.length = 0;
    roomGroups.clear();
    supportGroups.clear();
  }

  return { group, update, setActiveFloor, dispose };
}
