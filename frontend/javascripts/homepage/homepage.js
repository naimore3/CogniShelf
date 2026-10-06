/* =============================================================
   墨海寻珠 · 主页 JS 框架入口
   规则文档：.documents/前端框架规则.md
   设计文档：.documents/首页设计/场景设计概述.md

   职责边界：
   - 只做主页生命周期、模块编排、navigation.instant 重初始化与清理；
   - 不写章节显现、滚动进度、聚光等具体业务；
   - 不存在主页根节点时不加载子模块，非主页保持零业务开销。
   ============================================================= */
(function () {
  "use strict";

  var HOME_SELECTOR = ".nmd-home, .nmd-story";
  var docEl = document.documentElement;
  var prefersReduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  docEl.classList.add("nmd-js");

  var current = null; // { root, modules[] }
  var pendingRoot = null;
  var initToken = 0;

  function loadModules() {
    return Promise.all([
      import("./viewport-vars.mjs"),
      import("./scroll-progress.mjs"),
      import("./chapter-reveal.mjs"),
      import("./spotlight.mjs"),
      import("./floor-rail.mjs")
    ]);
  }

  function findHomeRoot() {
    return document.querySelector(HOME_SELECTOR);
  }

  function teardown() {
    initToken += 1;
    if (pendingRoot) {
      delete pendingRoot.dataset.nmdInit;
      pendingRoot = null;
    }
    if (!current) {
      docEl.classList.remove("nmd-home-page");
      docEl.style.setProperty("--nmd-scroll", "0");
      return;
    }
    for (var i = current.modules.length - 1; i >= 0; i -= 1) {
      var mod = current.modules[i];
      if (mod && typeof mod.destroy === "function") {
        try {
          mod.destroy();
        } catch (error) {
          console.warn("[homepage] module cleanup failed", error);
        }
      }
    }
    if (current.root) {
      delete current.root.dataset.nmdInit;
    }
    current = null;
    docEl.classList.remove("nmd-home-page");
    docEl.style.setProperty("--nmd-scroll", "0");
  }

  async function initHome() {
    var root = findHomeRoot();
    if (!root) {
      docEl.classList.remove("nmd-home-page");
      teardown();
      return;
    }
    if (pendingRoot === root || (current && current.root === root)) return;
    delete root.dataset.nmdInit;

    docEl.classList.add("nmd-home-page");
    pendingRoot = root;
    root.dataset.nmdInit = "1";
    var token = ++initToken;
    var loaded;

    try {
      loaded = await loadModules();
    } catch (error) {
      if (pendingRoot === root) pendingRoot = null;
      delete root.dataset.nmdInit;
      console.warn("[homepage] module loading failed", error);
      return;
    }

    if (token !== initToken || !root.isConnected || root !== findHomeRoot()) {
      if (pendingRoot === root) pendingRoot = null;
      if (!root.isConnected) delete root.dataset.nmdInit;
      return;
    }

    var modules = [];
    try {
      modules.push(loaded[0].createViewportVars());
      modules.push(loaded[1].createScrollProgress({ root: root }));
      modules.push(loaded[2].createChapterReveal({ root: root, prefersReduced: prefersReduced }));
      modules.push(loaded[3].createSpotlight({ root: root }));
      modules.push(loaded[4].createFloorRail({ root: root }));
    } catch (error) {
      for (var i = modules.length - 1; i >= 0; i -= 1) {
        if (modules[i] && typeof modules[i].destroy === "function") modules[i].destroy();
      }
      if (pendingRoot === root) pendingRoot = null;
      delete root.dataset.nmdInit;
      console.warn("[homepage] module init failed", error);
      return;
    }

    pendingRoot = null;
    current = { root: root, modules: modules };
  }

  function nodeRemoved(removedNodes, node) {
    for (var i = 0; i < removedNodes.length; i += 1) {
      var removed = removedNodes[i];
      if (removed === node || (removed.contains && removed.contains(node))) return true;
    }
    return false;
  }

  initHome();

  if ("MutationObserver" in window) {
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (current && mutations[i].removedNodes.length &&
            nodeRemoved(mutations[i].removedNodes, current.root)) {
          teardown();
          break;
        }
      }
      initHome();
    }).observe(docEl, { childList: true, subtree: true });
  }
})();
