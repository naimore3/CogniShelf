"""构建期把 npm 安装的 three 注入构建产物 site/javascripts/vendor/three/。

three 由 package.json 声明、npm 安装，仓库不提交三方源码，docs/ 不被污染；
运行时 URL（importmap 的 three / three/addons/）保持不变。缺依赖直接让构建报错，
不产出首页 3D 静默降级的假绿灯站点。
"""

from __future__ import annotations

import filecmp
import json
import shutil
from pathlib import Path

from mkdocs.exceptions import PluginError

# 源路径相对 node_modules/three/，目标路径相对 site/javascripts/vendor/three/
#
# 升级到 three >= 0.167 时 build/ 会多出 three.core.js（three.module.js 只是
# 再导出它），必须把 "build/three.core.js" 加进来，否则远端拿不到核心模块。
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


def on_post_build(config, **kwargs):
    site_dir = Path(config["site_dir"]).resolve()
    config_file = getattr(config, "config_file_path", None)
    project_root = Path(config_file).resolve().parent if config_file else Path.cwd()
    src_root = project_root / "node_modules" / "three"

    if not (src_root / "build" / "three.module.js").is_file():
        raise PluginError(
            f"three 未安装：找不到 {src_root / 'build' / 'three.module.js'}。\n"
            "  本地：先执行 npm install\n"
            "  Cloudflare Pages：构建命令设为 npm ci && mkdocs build"
        )

    missing = [rel for rel in FILES if not (src_root / rel).is_file()]
    if missing:
        raise PluginError(
            f"three@{_three_version(src_root)} 缺少预期文件：{', '.join(missing)}；"
            "升级 three 后请同步 hooks/threejs.py 的 FILES 清单。"
        )

    dest_root = site_dir / VENDOR_SUBDIR
    written = [rel for rel in FILES if _copy_if_changed(src_root / rel, dest_root / rel)]
    if written:
        print(f"[three] three@{_three_version(src_root)} 注入 site/{VENDOR_SUBDIR}：{len(written)} 个文件")
