import * as THREE from "three";

/**
 * 创建渲染器，并把画布尺寸同步到容器实际像素。
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} column 画布所在列，尺寸以它为准
 */
export function createRenderer(canvas, column) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  function resize() {
    const width = column.clientWidth;
    const height = column.clientHeight;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
    window.addEventListener("resize", resize);
  }

  resize();
  return renderer;
}
