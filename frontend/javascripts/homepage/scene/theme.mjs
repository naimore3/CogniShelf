import * as THREE from "three";

/**
 * 读取站点主题变量并应用到画布：清屏色跟随页面背景，
 * 物体颜色由背景与中灰混合，保证亮暗主题下都可见。
 */
export function applyTheme(renderer, objects) {
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--md-default-bg-color")
    .trim();

  renderer.setClearColor(bg, 1);
  objects.box.material.color.set(bg).lerp(new THREE.Color("#808080"), 0.45);
}

/** 监听明暗主题切换，变化时重新应用配色。 */
export function watchTheme(renderer, objects) {
  const observer = new MutationObserver(() => applyTheme(renderer, objects));
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });
  return observer;
}
