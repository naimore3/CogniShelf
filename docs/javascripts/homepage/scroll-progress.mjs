/* 主页滚动进度：写入 --nmd-scroll（0–1），并广播 nmd:scroll 给 Three.js 场景。 */
export function createScrollProgress({ root } = {}) {
  const docEl = document.documentElement;
  let raf = null;
  let resizeObserver = null;

  function read() {
    const max = Math.max(0, docEl.scrollHeight - window.innerHeight);
    const y = window.pageYOffset || docEl.scrollTop || 0;
    return max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
  }

  function update() {
    raf = null;
    const progress = read();
    docEl.style.setProperty("--nmd-scroll", progress.toFixed(4));
    document.dispatchEvent(new CustomEvent("nmd:scroll", {
      detail: { progress }
    }));
  }

  function schedule() {
    if (raf) return;
    raf = window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });

  if ("ResizeObserver" in window && root) {
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
  }

  update();

  return {
    update,
    destroy() {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (resizeObserver) resizeObserver.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
      resizeObserver = null;
      docEl.style.setProperty("--nmd-scroll", "0");
    }
  };
}
