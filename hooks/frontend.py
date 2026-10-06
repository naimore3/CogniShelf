"""构建期把 frontend/ 下的站点资源注入构建产物 site/。

前端源码只在 frontend/ 维护，docs/ 只放 Markdown，两者互不污染；
`mkdocs build` 完成后把 frontend/javascripts、frontend/stylesheets
拷进 site/ 同名目录。注入失败直接让构建报错，不产出缺 JS/CSS 的假绿灯站点。
"""

from __future__ import annotations

import filecmp
import shutil
from pathlib import Path

from mkdocs.exceptions import PluginError

# 需要注入的顶层目录（相对 frontend/ 与相对 site/ 的目标同名）
DIRS = ("javascripts", "stylesheets")


def _copy_tree(src: Path, dst: Path) -> int:
    """把 src 整棵树复制到 dst，内容一致的文件跳过，返回实际写入的数量。"""
    written = 0
    for path in sorted(src.rglob("*")):
        if not path.is_file():
            continue
        target = dst / path.relative_to(src)
        if target.is_file() and filecmp.cmp(path, target, shallow=False):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        written += 1
    return written


def on_post_build(config, **kwargs):
    site_dir = Path(config["site_dir"]).resolve()
    config_file = getattr(config, "config_file_path", None)
    project_root = Path(config_file).resolve().parent if config_file else Path.cwd()
    source_root = project_root / "frontend"

    missing = [name for name in DIRS if not (source_root / name).is_dir()]
    if missing:
        raise PluginError(
            "前端源码缺失：找不到 "
            + "、".join(f"{source_root / name}" for name in missing)
            + "；请确认 frontend/ 未被误删或未被打包忽略。"
        )

    for name in DIRS:
        written = _copy_tree(source_root / name, site_dir / name)
        if written:
            print(f"[frontend] 注入 site/{name}/：{written} 个文件")
