/* 楼层编号轨：让 [data-nmd-floor-rail] 中的当前楼层与正文 section 同步高亮。 */
export function createFloorRail({ root } = {}) {
  const rail = root ? root.querySelector("[data-nmd-floor-rail]") : null;
  const sections = root ? Array.from(root.querySelectorAll(".nmd-chapter[data-floor]")) : [];
  const links = rail ? Array.from(rail.querySelectorAll("[data-floor]")) : [];
  let observer = null;

  if (!rail || sections.length === 0 || links.length === 0) {
    return { destroy() {} };
  }

  const byFloor = new Map(links.map((link) => [link.dataset.floor, link]));

  function activate(floor) {
    links.forEach((link) => {
      const current = link.dataset.floor === String(floor);
      link.classList.toggle("is-current", current);
      link.setAttribute("aria-current", current ? "true" : "false");
    });
  }

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible && byFloor.has(visible.target.dataset.floor)) {
        activate(visible.target.dataset.floor);
      }
    }, { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.25, 0.5, 1] });

    sections.forEach((section) => observer.observe(section));
    activate(sections[0].dataset.floor);
  } else {
    activate("0");
  }

  return {
    destroy() {
      if (observer) observer.disconnect();
      links.forEach((link) => {
        link.classList.remove("is-current");
        link.removeAttribute("aria-current");
      });
      observer = null;
    }
  };
}
