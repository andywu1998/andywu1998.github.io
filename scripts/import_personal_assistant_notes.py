#!/usr/bin/env python3
"""Import Codex personal assistant notes into this Jekyll blog."""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path


DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "codex_personal_assistant" / "notes"
DEFAULT_POSTS = Path(__file__).resolve().parents[1] / "_posts"
DEFAULT_DATABASE = DEFAULT_SOURCE.parent / "data" / "daily_log.sqlite3"


EXCLUDE_PARTS = {
    ".tmp",
    ".venv",
    ".venv_mobi_tools",
    "source_materials",
    "__pycache__",
}


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def normalize_title(path: Path, content: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return path.stem


def strip_existing_front_matter(content: str) -> str:
    if not content.startswith("---\n"):
        return content
    marker = content.find("\n---\n", 4)
    if marker == -1:
        return content
    return content[marker + 5 :].lstrip()


def safe_filename_part(value: str) -> str:
    value = value.strip().replace(os.sep, "-")
    value = re.sub(r"[\s]+", "-", value)
    value = re.sub(r'[\\/:*?"<>|#`]+', "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "untitled"


def infer_tags(path: Path, source_root: Path) -> list[str]:
    rel = path.relative_to(source_root)
    parts = rel.parts
    tags = ["个人助理"]
    if parts[0] == "books" and len(parts) >= 2:
        tags.extend(["读书笔记", parts[1]])
    elif parts[0] == "projects" and len(parts) >= 2:
        tags.extend(["项目", parts[1]])
    elif path.name == "knowledge_base.md":
        tags.append("知识库")
    else:
        tags.append(parts[0])
    return tags


def unpublished_note_paths(source_root: Path, database: Path) -> set[str]:
    """`publish_enabled=0` 的笔记路径（相对 notes/），博客不导入它们。

    ADR-0011 把「去不去博客」交给 `publish_enabled`；ticket 01 已把全量回填成 1，
    所以这一步今天一条也不少。数据库缺失就照实报错，别静默全量导入。
    """
    if not database.exists():
        raise FileNotFoundError(f"note registry database not found: {database}")
    connection = sqlite3.connect(database)
    try:
        rows = connection.execute(
            "SELECT path FROM notes WHERE publish_enabled = 0"
        ).fetchall()
    finally:
        connection.close()
    paths = set()
    for (raw_path,) in rows:
        rel = str(raw_path).strip()
        if rel.startswith("notes/"):
            rel = rel[len("notes/"):]
        paths.add(rel)
    return paths


def iter_notes(
    source_root: Path, days: int | None, *, excluded: set[str] | None = None
) -> list[Path]:
    cutoff = None
    if days is not None:
        cutoff = datetime.now().timestamp() - days * 24 * 60 * 60

    excluded = excluded or set()
    notes: list[Path] = []
    for path in source_root.rglob("*.md"):
        if any(part in EXCLUDE_PARTS for part in path.parts):
            continue
        if path.relative_to(source_root).as_posix() in excluded:
            continue
        if cutoff is not None and path.stat().st_mtime < cutoff:
            continue
        notes.append(path)
    return sorted(notes, key=lambda item: (item.stat().st_mtime, str(item)))


def render_post(path: Path, source_root: Path) -> tuple[str, str]:
    raw = path.read_text(encoding="utf-8")
    content = strip_existing_front_matter(raw)
    title = normalize_title(path, content)
    modified = datetime.fromtimestamp(path.stat().st_mtime)
    tags = infer_tags(path, source_root)
    source_rel = path.relative_to(source_root.parent)

    front_matter = [
        "---",
        "layout: post",
        f"title: {yaml_quote(title)}",
        f"subtitle: {yaml_quote('Codex 个人助理沉淀')}",
        f"date: {modified.strftime('%Y-%m-%d %H:%M:%S +0800')}",
        "tags:",
        *[f"  - {yaml_quote(tag)}" for tag in tags],
        "---",
        "",
        f"> 来源：`{source_rel}`",
        "",
    ]

    return title, "\n".join(front_matter) + content.rstrip() + "\n"


def write_post(
    posts_dir: Path,
    date_prefix: str,
    title: str,
    body: str,
    used_names: set[str],
    dry_run: bool,
) -> Path:
    slug = safe_filename_part(title)
    candidate = posts_dir / f"{date_prefix}-{slug}.md"
    suffix = 2
    while candidate.name in used_names or (candidate.exists() and candidate.read_text(encoding="utf-8") != body):
        candidate = posts_dir / f"{date_prefix}-{slug}-{suffix}.md"
        suffix += 1
    used_names.add(candidate.name)

    if not dry_run:
        candidate.write_text(body, encoding="utf-8")
    return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument(
        "--database",
        type=Path,
        default=None,
        help="Note registry SQLite file; defaults to <source>/../data/daily_log.sqlite3.",
    )
    parser.add_argument("--posts", type=Path, default=DEFAULT_POSTS)
    parser.add_argument("--days", type=int, default=None, help="Only import notes modified in the last N days.")
    parser.add_argument("--clean", action="store_true", help="Remove previously generated personal assistant posts first.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source_root = args.source.resolve()
    posts_dir = args.posts.resolve()
    if not source_root.exists():
        raise SystemExit(f"source directory does not exist: {source_root}")
    if not args.dry_run:
        posts_dir.mkdir(parents=True, exist_ok=True)

    if args.clean and posts_dir.exists() and not args.dry_run:
        for post in posts_dir.glob("*.md"):
            text = post.read_text(encoding="utf-8", errors="ignore")
            if "Codex 个人助理沉淀" in text or "来源：`codex_personal_assistant/notes/" in text:
                post.unlink()

    database = args.database or (source_root.parent / "data" / "daily_log.sqlite3")
    excluded = unpublished_note_paths(source_root, database)

    imported: list[Path] = []
    used_names: set[str] = set()
    for note in iter_notes(source_root, args.days, excluded=excluded):
        title, body = render_post(note, source_root)
        date_prefix = datetime.fromtimestamp(note.stat().st_mtime).strftime("%Y-%m-%d")
        imported.append(write_post(posts_dir, date_prefix, title, body, used_names, args.dry_run))

    for post in imported:
        print(post)
    print(f"Imported {len(imported)} notes into {posts_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
