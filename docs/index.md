---
title: 墨海寻珠
hide:
  - navigation
  - toc
---

<!--
  墨海寻珠 · 首页框架（v7 左顶角机位方向）
  设计总纲：.documents/首页设计/场景设计概述.md
  前端规则：.documents/前端框架规则.md
  只提供结构骨架与房间 section；正式文案在 P0 阶段逐层绑定。
-->

<script type="importmap">
{
  "imports": {
    "three": "./javascripts/vendor/three/build/three.module.js",
    "three/addons/": "./javascripts/vendor/three/examples/jsm/"
  }
}
</script>

<div class="nmd-home" data-nmd-home>
  <div class="nmd-scene-column">
    <div id="convenience-scene" class="nmd-scene-layer" role="img" aria-label="墨海寻珠左顶角链式房间场景">
      <div class="nmd-scene-fallback" aria-hidden="true">
        <div class="nmd-scene-sky"></div>
        <div class="nmd-scene-rooms"></div>
        <div class="nmd-scene-ground"></div>
        <div class="nmd-scene-glow"></div>
      </div>
    </div>

    <ol class="nmd-floor-rail" data-nmd-floor-rail aria-label="房间导航">
      <li><a href="#nmd-home-0" data-floor="0">F0</a></li>
      <li><a href="#nmd-home-10" data-floor="10">F10</a></li>
      <li><a href="#nmd-home-9" data-floor="9">F9</a></li>
      <li><a href="#nmd-home-8" data-floor="8">F8</a></li>
      <li><a href="#nmd-home-7" data-floor="7">F7</a></li>
      <li><a href="#nmd-home-6" data-floor="6">F6</a></li>
      <li><a href="#nmd-home-5" data-floor="5">F5</a></li>
      <li><a href="#nmd-home-4" data-floor="4">F4</a></li>
      <li><a href="#nmd-home-3" data-floor="3">F3</a></li>
      <li><a href="#nmd-home-2" data-floor="2">F2</a></li>
      <li><a href="#nmd-home-1" data-floor="1">F1</a></li>
    </ol>
  </div>

  <div class="nmd-story nmd-copy-column">
    <section class="nmd-chapter nmd-chapter-cover" id="nmd-home-0" data-floor="0" aria-label="封面">
      <h1 class="nmd-cover-title">墨海寻珠</h1>
    </section>

    <section class="nmd-chapter" id="nmd-home-10" data-floor="10" aria-labelledby="nmd-home-10-title">
      <p class="nmd-chapter-index" aria-hidden="true">F10</p>
      <h2 class="nmd-chapter-title" id="nmd-home-10-title">屋顶露台</h2>
      <p class="nmd-chapter-lead">在房间链的最高处，遮阳伞、沙滩椅与一圈错落的绿植，把学习的终点变成一座可以眺望整条路径的漂浮花园。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-9" data-floor="9" aria-labelledby="nmd-home-9-title">
      <p class="nmd-chapter-index" aria-hidden="true">F9</p>
      <h2 class="nmd-chapter-title" id="nmd-home-9-title">天文台</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-8" data-floor="8" aria-labelledby="nmd-home-8-title">
      <p class="nmd-chapter-index" aria-hidden="true">F8</p>
      <h2 class="nmd-chapter-title" id="nmd-home-8-title">工作室</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-7" data-floor="7" aria-labelledby="nmd-home-7-title">
      <p class="nmd-chapter-index" aria-hidden="true">F7</p>
      <h2 class="nmd-chapter-title" id="nmd-home-7-title">实验室</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-6" data-floor="6" aria-labelledby="nmd-home-6-title">
      <p class="nmd-chapter-index" aria-hidden="true">F6</p>
      <h2 class="nmd-chapter-title" id="nmd-home-6-title">教室</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-5" data-floor="5" aria-labelledby="nmd-home-5-title">
      <p class="nmd-chapter-index" aria-hidden="true">F5</p>
      <h2 class="nmd-chapter-title" id="nmd-home-5-title">音乐室</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-4" data-floor="4" aria-labelledby="nmd-home-4-title">
      <p class="nmd-chapter-index" aria-hidden="true">F4</p>
      <h2 class="nmd-chapter-title" id="nmd-home-4-title">咖啡馆</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-3" data-floor="3" aria-labelledby="nmd-home-3-title">
      <p class="nmd-chapter-index" aria-hidden="true">F3</p>
      <h2 class="nmd-chapter-title" id="nmd-home-3-title">便利店</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-2" data-floor="2" aria-labelledby="nmd-home-2-title">
      <p class="nmd-chapter-index" aria-hidden="true">F2</p>
      <h2 class="nmd-chapter-title" id="nmd-home-2-title">图书馆</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>

    <section class="nmd-chapter" id="nmd-home-1" data-floor="1" aria-labelledby="nmd-home-1-title">
      <p class="nmd-chapter-index" aria-hidden="true">F1</p>
      <h2 class="nmd-chapter-title" id="nmd-home-1-title">汉堡店</h2>
      <p class="nmd-chapter-lead">文案待绑定。</p>
    </section>
  </div>
</div>
