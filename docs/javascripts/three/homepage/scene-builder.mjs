/* 主页灰盒房间群：所有房间同尺寸（地面正方形 w = d）、同朝向，沿右上—左下串成链。
   摄像机从左顶角向内看，因此去掉最近三面（顶面、正面、左侧）；
   保留地板、背墙和右侧墙。每间房下方有独立的实心支柱和底座；
   这里只搭结构，不实现各楼层道具。 */

import { FLOORS, ROOM_SIZE } from "./floor-registry.mjs";

const FRAME = 0.22;
const SUPPORT_HEIGHT = 1.2;
const BASE_HEIGHT = 0.34;

export function createSceneBuilder(THREE, materials) {
  const group = new THREE.Group();
  group.name = "nmd-room-chain";

  const geometries = [];
  const outlines = [];
  const roomGroups = new Map();
  const accentMeshes = new Map();
  const supportGroups = new Map();

  const { width, height, depth } = ROOM_SIZE;

  function track(geometry) {
    geometries.push(geometry);
    return geometry;
  }

  function addOutline(parent, geometry, position) {
    const lines = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 28),
      materials.palette.outline
    );
    lines.position.copy(position);
    parent.add(lines);
    outlines.push(lines);
    return lines;
  }

  function addMesh(parent, geometry, position, material, outlined) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    parent.add(mesh);
    if (outlined) addOutline(parent, geometry, position);
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

  const floorGeometry = track(new THREE.BoxGeometry(width, 0.24, depth));
  const backWallGeometry = track(new THREE.BoxGeometry(width, height, FRAME));
  const sideWallGeometry = track(new THREE.BoxGeometry(FRAME, height, depth));
  const beamGeometry = track(new THREE.BoxGeometry(width - FRAME, FRAME, FRAME));
  const postGeometry = track(new THREE.BoxGeometry(FRAME, height, FRAME));
  const accentGeometry = track(new THREE.BoxGeometry(width * 0.42, 0.18, 0.06));
  // 占位体按房间尺寸取比例，避免房间改为正方形（w = d）后穿出右侧墙。
  const placeholderGeometry = track(new THREE.BoxGeometry(width * 0.5, 1.1, depth * 0.55));
  const pillarGeometry = track(new THREE.BoxGeometry(width * 0.28, SUPPORT_HEIGHT, depth * 0.28));
  const baseGeometry = track(new THREE.BoxGeometry(width * 0.42, BASE_HEIGHT, depth * 0.42));

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
      materials.palette.roomFloor,
      true
    );
    addMesh(
      room,
      backWallGeometry,
      new THREE.Vector3(0, 0, -depth / 2 + FRAME / 2),
      materials.palette.roomWall,
      true
    );
    addMesh(
      room,
      sideWallGeometry,
      new THREE.Vector3(width / 2 - FRAME / 2, 0, 0),
      materials.palette.roomWall,
      true
    );

    // 白色厚边框围住正面开口：上下横梁 + 两根立柱。
    addMesh(
      room,
      beamGeometry,
      new THREE.Vector3(0, height / 2 - FRAME / 2, depth / 2 - FRAME / 2),
      materials.palette.roomFrame,
      true
    );
    addMesh(
      room,
      beamGeometry,
      new THREE.Vector3(0, -height / 2 + FRAME / 2, depth / 2 - FRAME / 2),
      materials.palette.roomFrame,
      true
    );
    addMesh(
      room,
      postGeometry,
      new THREE.Vector3(-(width / 2 - FRAME / 2), 0, depth / 2 - FRAME / 2),
      materials.palette.roomFrame,
      true
    );
    addMesh(
      room,
      postGeometry,
      new THREE.Vector3(width / 2 - FRAME / 2, 0, depth / 2 - FRAME / 2),
      materials.palette.roomFrame,
      true
    );

    const accent = new THREE.Mesh(accentGeometry, materials.accentMaterials.get(item.floor));
    accent.position.set(0, height * 0.25, -depth / 2 + FRAME + 0.03);
    room.add(accent);
    accentMeshes.set(item.floor, accent);

    // 灰盒占位体：后续由 floors/<id>.mjs 替换成该层真实内容。
    addMesh(
      room,
      placeholderGeometry,
      new THREE.Vector3(width * 0.16, -height / 2 + 0.55, depth * 0.15),
      materials.palette.interior,
      false
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
      materials.palette.pillar,
      true
    );
    addMesh(
      support,
      baseGeometry,
      new THREE.Vector3(0, -height / 2 - SUPPORT_HEIGHT - BASE_HEIGHT / 2, 0),
      materials.palette.base,
      true
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

    accentMeshes.forEach((accent, roomFloor) => {
      const active = roomFloor === floor;
      accent.scale.x = active ? 1.6 : 1;
      accent.material.opacity = active ? 1 : 0.72;
      accent.material.transparent = true;
    });
  }

  function dispose() {
    geometries.forEach((geometry) => geometry.dispose());
    outlines.forEach((lines) => lines.geometry.dispose());
    group.clear();
    geometries.length = 0;
    outlines.length = 0;
    roomGroups.clear();
    accentMeshes.clear();
    supportGroups.clear();
  }

  return { group, update, setActiveFloor, dispose };
}
