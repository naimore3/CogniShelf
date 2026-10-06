/* 主页画布入口：只做装配，不含具体实现。 */

import * as THREE from "three";

import { createRenderer } from "./scene/renderer.mjs";
import { createCamera } from "./scene/camera.mjs";
import { createObjects } from "./scene/objects.mjs";
import { applyTheme, watchTheme } from "./scene/theme.mjs";
import { startRenderLoop } from "./render-loop.mjs";

const canvas = document.querySelector("#nmd-canvas");
const column = document.querySelector(".nmd-scene-column");

const renderer = createRenderer(canvas, column);
const scene = new THREE.Scene();
const camera = createCamera();
const objects = createObjects();

scene.add(objects.group);

applyTheme(renderer, objects);
watchTheme(renderer, objects);
startRenderLoop(renderer, scene, camera, objects);
