"""构建期把 npm 安装的 three 注入站点。

背景：仓库不再提交三方源码（docs/javascripts/vendor/ 已 gitignore），
three 由 package.json 声明、npm 安装，只在构建期落到站点里。

设计约束：
- 运行时 URL 路径保持不变（docs/javascripts/vendor/three/**），
  与 docs/index.md 的 importmap、convenience-scene.mjs 的相对兜底 import 一致，
  因此本次迁移不触碰任何业务代码与 importmap；
- 内容一致时跳过写入：mkdocs serve 的 watchdog 会监听 docs/，
  无脑覆写会触发"写入 → 重建 → 再写入"的死循环；
- 缺依赖时直接让构建失败，而不是产出一个首页 3D 静默降级的假绿灯站点。
"""

from __future__ import annotations

import filecmp
import json
import shutil
from pathlib import Path

from mkdocs.exceptions import PluginError

# 需要随站点发布的文件：源路径相对 node_modules/three/，目标路径相对 docs/javascripts/vendor/three/
#
# 升级到 three >= 0.167 时，build/ 目录会多出 three.core.js
# （three.module.js 只是再导出它），必须把 "build/three.core.js" 加进本清单，
# 否则远端首页拿不到核心模块 → 场景静默降级。
FILES = (
    "build/three.module.js",                    # importmap 的 "three"
    "examples/jsm/controls/OrbitControls.js",   # importmap 的 "three/addons/"
    "examples/jsm/objects/Reflector.js",
    "examples/jsm/utils/BufferGeometryUtils.js",
)

VENDOR_SUBDIR = Path("javascripts") / "vendor" / "three"


def _three_version(src_root: Path) -> str:
    """从 node_modules/three/package.json 读版本，读不到就返回 unknown。"""
    try:
        return json.loads((src_root / "package.json").read_text(encoding="utf-8"))["version"]
    except (OSError, ValueError, KeyError):
        return "unknown"


def _copy_if_changed(src: Path, dst: Path) -> bool:
    """内容一致则不写盘，返回是否真的写入了。"""
    if dst.is_file() and filecmp.cmp(src, dst, shallow=False):
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return True


def on_pre_build(config, **kwargs):
    docs_dir = Path(config["docs_dir"]).resolve()
    config_file = getattr(config, "config_file_path", None)
    project_root = Path(config_file).resolve().parent if config_file else Path.cwd()
    src_root = project_root / "node_modules" / "three"

    if not (src_root / "build" / "three.module.js").is_file():
        raise PluginError(
            "three 未安装：找不到 node_modules/three/build/three.module.js。\n"
            "  本地：先执行 npm install\n"
            "  Cloudflare Pages：构建命令设为 npm ci && mkdocs build"
        )

    missing = [rel for rel in FILES if not (src_root / rel).is_file()]
    if missing:
        raise PluginError(
            f"three@{_three_version(src_root)} 缺少预期文件：{', '.join(missing)}；"
            "升级 three 后请同步 hooks/vendor_three.py 的 FILES 清单。"
        )

    dest_root = docs_dir / VENDOR_SUBDIR
    written = [rel for rel in FILES if _copy_if_changed(src_root / rel, dest_root / rel)]

    # 保留三方许可证，保证 vendored 代码的来源可追溯
    if (src_root / "LICENSE").is_file() and _copy_if_changed(src_root / "LICENSE", dest_root / "LICENSE"):
        written.append("LICENSE")

    # 落一份来源版本，便于排查"远端 three 与本地不一致"
    version = _three_version(src_root)
    stamp = (
        f"three@{version}\n\n"
        "# 构建期由 hooks/vendor_three.py 从 node_modules/three 生成，勿手工修改：\n"
        "#   npm install                          # 本地\n"
        "#   npm ci && mkdocs build               # Cloudflare Pages 构建命令\n"
        "# 升级 three 时同步 package.json 与 hooks/vendor_three.py 的 FILES 清单。\n"
    )
    version_dst = dest_root / "VERSION"
    if not version_dst.is_file() or version_dst.read_text(encoding="utf-8") != stamp:
        version_dst.parent.mkdir(parents=True, exist_ok=True)
        version_dst.write_text(stamp, encoding="utf-8")
        written.append("VERSION")

    if written:
        print(f"[vendor_three] three@{version} 注入 {VENDOR_SUBDIR}：{', '.join(written)}")
