/* 主页视口尺寸变量：把经典滚动条宽度写入 --nmd-sb。 */
export function createViewportVars() {
  const docEl = document.documentElement;

  function update() {
    const scrollbar = Math.max(0, window.innerWidth - docEl.clientWidth);
    docEl.style.setProperty("--nmd-sb", `${scrollbar}px`);
  }

  update();
  window.addEventListener("resize", update, { passive: true });

  return {
    update,
    destroy() {
      window.removeEventListener("resize", update);
    }
  };
}
