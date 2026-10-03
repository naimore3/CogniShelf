/* 主页章节显现：只负责 .nmd-chapter 的进入/离开状态。 */
export function createChapterReveal({ root, prefersReduced = false } = {}) {
  const chapters = root ? Array.from(root.querySelectorAll(".nmd-chapter")) : [];
  let observer = null;

  if (!root || chapters.length === 0) {
    return { destroy() {} };
  }

  if (prefersReduced || !("IntersectionObserver" in window)) {
    chapters.forEach((chapter) => chapter.classList.add("is-active"));
    return {
      destroy() {
        chapters.forEach((chapter) => chapter.classList.remove("is-active"));
      }
    };
  }

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-active", entry.isIntersecting);
    });
  }, { rootMargin: "-12% 0px -12% 0px", threshold: 0 });

  chapters.forEach((chapter) => observer.observe(chapter));
  root.classList.add("nmd-reveal-ready");

  return {
    destroy() {
      if (observer) observer.disconnect();
      root.classList.remove("nmd-reveal-ready");
      chapters.forEach((chapter) => chapter.classList.remove("is-active"));
      observer = null;
    }
  };
}
