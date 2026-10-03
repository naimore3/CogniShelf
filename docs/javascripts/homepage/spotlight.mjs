/* 主页卡片聚光：把指针位置写入卡片的 --mx / --my。 */
export function createSpotlight({ root } = {}) {
  const cards = root ? Array.from(root.querySelectorAll(".nmd-spot")) : [];
  const listeners = [];

  cards.forEach((card) => {
    const onMove = (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    card.addEventListener("mousemove", onMove);
    listeners.push([card, onMove]);
  });

  return {
    destroy() {
      listeners.forEach(([card, onMove]) => {
        card.removeEventListener("mousemove", onMove);
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
      });
      listeners.length = 0;
    }
  };
}
