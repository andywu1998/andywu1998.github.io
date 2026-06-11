#!/usr/bin/env python3
"""Build static data for the VSCode-style reader page."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "_posts"
OUTPUT = ROOT / "assets" / "data" / "reader-posts.json"


def split_front_matter(text: str) -> tuple[dict[str, object], str]:
    if not text.startswith("---\n"):
        return {}, text

    end = text.find("\n---", 4)
    if end == -1:
        return {}, text

    raw_front_matter = text[4:end].strip("\n")
    body = text[end + 4 :].lstrip("\n")
    return parse_front_matter(raw_front_matter), body


def parse_front_matter(raw: str) -> dict[str, object]:
    data: dict[str, object] = {}
    current_list_key = ""

    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        if current_list_key and stripped.startswith("- "):
            values = data.setdefault(current_list_key, [])
            if isinstance(values, list):
                values.append(clean_value(stripped[2:]))
            continue

        current_list_key = ""
        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()

        if not value:
            data[key] = []
            current_list_key = key
        else:
            data[key] = clean_value(value)

    return data


def clean_value(value: str) -> str | list[str]:
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]

    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [clean_value(part.strip()) for part in inner.split(",") if part.strip()]  # type: ignore[list-item]

    return value


def post_id(path: Path) -> str:
    return path.stem


def post_date(path: Path, front_matter: dict[str, object]) -> str:
    raw_date = str(front_matter.get("date", "")).strip()
    if raw_date:
        return raw_date

    match = re.match(r"(\d{4}-\d{1,2}-\d{1,2})-", path.name)
    if match:
        return match.group(1)

    return "1970-01-01 00:00:00 +0000"


def sortable_date(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        return "1970-01-01T00:00:00"

    if re.match(r"^\d{4}-\d{1,2}-\d{1,2}$", normalized):
        normalized = f"{normalized} 00:00:00 +0000"

    for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, fmt).isoformat()
        except ValueError:
            continue

    match = re.match(r"(\d{4}-\d{1,2}-\d{1,2})", normalized)
    if match:
        return datetime.strptime(match.group(1), "%Y-%m-%d").isoformat()

    return "1970-01-01T00:00:00"


def title_from_path(path: Path) -> str:
    match = re.match(r"\d{4}-\d{1,2}-\d{1,2}-(.+)", path.stem)
    if match:
        return match.group(1).replace("-", " ")
    return path.stem


def post_url(path: Path) -> str:
    match = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})-(.+)", path.stem)
    if not match:
        return ""

    year, month, day, slug = match.groups()
    clean_slug = re.sub(r"\s+", "-", slug.strip())
    return f"/{year}-{int(month):02d}-{int(day):02d}-{quote(clean_slug)}/"


def build() -> None:
    posts = []

    for path in sorted(POSTS_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        front_matter, body = split_front_matter(raw)
        raw_tags = front_matter.get("tags", [])
        tags = raw_tags if isinstance(raw_tags, list) else [str(raw_tags)]
        date = post_date(path, front_matter)

        posts.append(
            {
                "id": post_id(path),
                "title": str(front_matter.get("title") or title_from_path(path)),
                "subtitle": str(front_matter.get("subtitle") or ""),
                "date": date,
                "sortDate": sortable_date(date),
                "tags": [str(tag) for tag in tags if str(tag).strip()],
                "url": post_url(path),
                "sourcePath": str(path.relative_to(ROOT)),
                "markdown": raw,
                "body": body,
            }
        )

    posts.sort(key=lambda item: item["sortDate"], reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"posts": posts}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(posts)} posts to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
