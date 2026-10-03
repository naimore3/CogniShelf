/* 滚动区间映射：按右侧文案 section 的实际位置计算每层 hold / descend。 */

const HOLD_RATIO = 0.65;

export function createScrollMap(sections) {
  const list = Array.from(sections || []).filter((section) => section.dataset.floor != null);
  let ranges = [];

  function measure() {
    const docEl = document.documentElement;
    const max = Math.max(1, docEl.scrollHeight - window.innerHeight);
    ranges = list.map((section, index) => {
      const rect = section.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY);
      const height = Math.max(1, rect.height || window.innerHeight);
      const start = Math.min(1, top / max);
      const end = Math.min(1, (top + height) / max);
      return {
        floor: Number(section.dataset.floor),
        sectionId: section.id || `nmd-home-${section.dataset.floor}`,
        start,
        end: Math.max(start, end),
        index
      };
    });

    ranges.sort((a, b) => a.start - b.start);
    if (ranges.length) {
      ranges[0].start = 0;
      ranges[ranges.length - 1].end = 1;
    }
  }

  function getState(progress) {
    if (!ranges.length) return { floor: 0, local: 0, phase: "hold", phaseT: 0 };
    const value = Math.min(1, Math.max(0, progress || 0));

    let range = ranges[0];
    for (let i = 0; i < ranges.length; i += 1) {
      if (value >= ranges[i].start && value <= ranges[i].end) {
        range = ranges[i];
        break;
      }
    }

    const span = Math.max(0.0001, range.end - range.start);
    const local = Math.min(1, Math.max(0, (value - range.start) / span));
    const phase = local < HOLD_RATIO ? "hold" : "descend";
    const phaseT = phase === "hold"
      ? local / HOLD_RATIO
      : (local - HOLD_RATIO) / (1 - HOLD_RATIO);

    return { floor: range.floor, local, phase, phaseT, sectionId: range.sectionId };
  }

  measure();

  return {
    measure,
    getState,
    destroy() {
      ranges = [];
    }
  };
}
