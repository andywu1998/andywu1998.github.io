#!/usr/bin/env python3
"""Publish a Jekyll Markdown post to WeChat draft via kuaifa."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text

    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text

    meta: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line or line.startswith(" "):
            continue
        key, value = line.split(":", 1)
        value = value.strip().strip('"').strip("'")
        meta[key.strip()] = value

    return meta, text[end + 5 :].lstrip()


def default_source_url(post: Path) -> str:
    rel = post.resolve().relative_to(REPO_ROOT).as_posix()
    return "https://github.com/andywu1998/andywu1998.github.io/blob/master/" + rel


def first_paragraph(markdown: str) -> str:
    cleaned = re.sub(r"```.*?```", "", markdown, flags=re.S)
    cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", cleaned)
    cleaned = re.sub(r"\[[^\]]+\]\(([^)]+)\)", "", cleaned)
    for block in re.split(r"\n\s*\n", cleaned):
        block = block.strip()
        if not block or block.startswith(">") or block.startswith("#"):
            continue
        block = re.sub(r"^#+\s*", "", block)
        block = re.sub(r"[*_`>#-]", "", block).strip()
        if len(block) >= 8:
            return block[:120]
    return ""


def build_command(args: argparse.Namespace, title: str, digest: str, temp_post: Path) -> list[str]:
    cmd = ["npx", "-y", "kuaifa"]
    if args.account:
        cmd.extend(["--account", args.account])

    cmd.extend(["publish", str(temp_post), "--draft", "--title", title, "--cover", args.cover])

    if args.author:
        cmd.extend(["--author", args.author])
    if args.digest or digest:
        cmd.extend(["--digest", args.digest or digest])
    if args.template:
        cmd.extend(["--template", args.template])
    if args.source_url:
        cmd.extend(["--source-url", args.source_url])
    elif not args.no_source_url:
        cmd.extend(["--source-url", default_source_url(args.post)])
    if args.recommend:
        cmd.append("--recommend")

    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("post", type=Path, help="Jekyll post Markdown file.")
    parser.add_argument("--cover", required=True, help="Cover image path or URL. Required by WeChat drafts.")
    parser.add_argument("--title", help="Override article title.")
    parser.add_argument("--author", help="Override author.")
    parser.add_argument("--digest", help="Override digest.")
    parser.add_argument("--template", help="kuaifa template ID, preset name, or slug.")
    parser.add_argument("--account", help="kuaifa profile name.")
    parser.add_argument("--source-url", help="Read-original URL.")
    parser.add_argument("--no-source-url", action="store_true", help="Do not set a read-original URL.")
    parser.add_argument("--recommend", action="store_true", help="Insert previous article recommendations.")
    parser.add_argument("--dry-run", action="store_true", help="Print command and converted Markdown only.")
    args = parser.parse_args()

    args.post = args.post.resolve()
    if not args.post.exists():
        raise SystemExit(f"post not found: {args.post}")

    text = args.post.read_text(encoding="utf-8")
    meta, markdown = parse_front_matter(text)
    title = args.title or meta.get("title") or args.post.stem
    digest = first_paragraph(markdown)

    with tempfile.NamedTemporaryFile("w", suffix=".md", encoding="utf-8", delete=False) as tmp:
        tmp.write(markdown)
        temp_post = Path(tmp.name)

    try:
        cmd = build_command(args, title, digest, temp_post)
        if args.dry_run:
            print(" ".join(cmd))
            print("\n--- Markdown preview ---\n")
            print(markdown[:2000])
            return 0

        completed = subprocess.run(cmd, cwd=REPO_ROOT, text=True)
        return completed.returncode
    finally:
        temp_post.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
