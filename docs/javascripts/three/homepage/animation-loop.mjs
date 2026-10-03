/* 主页场景 rAF 主循环：统一 delta、暂停与销毁。 */

export function createAnimationLoop({ onFrame } = {}) {
  let raf = null;
  let last = 0;
  let paused = false;

  function frame(now) {
    raf = null;
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!paused && typeof onFrame === "function") onFrame(delta, now);
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (raf || paused) return;
    last = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = null;
    last = 0;
  }

  function setPaused(next) {
    paused = Boolean(next);
    if (paused) stop();
    else start();
  }

  return { start, stop, setPaused, get paused() { return paused; } };
}
