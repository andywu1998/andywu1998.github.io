# Kuaifa WeChat Draft Publishing

This repository can publish a Jekyll post to a WeChat Official Account draft through the `kuaifa` CLI.

## One-time setup

Install/check the CLI:

```bash
npx -y kuaifa --version
```

Configure kuaifa locally. Values are stored in `~/.kuaifa/config.json`, not in this repository.

```bash
npx -y kuaifa config set api-key <KUAIFA_API_KEY>
npx -y kuaifa config set appid <WECHAT_APPID>
npx -y kuaifa config set appsecret <WECHAT_APPSECRET>
npx -y kuaifa config set default-author "andywu1998"
npx -y kuaifa config verify-wechat
```

Optional:

```bash
npx -y kuaifa template list
npx -y kuaifa config set default-template <template-id-or-slug>
```

## Publish a draft

```bash
python3 scripts/publish_kuaifa_draft.py \
  "_posts/2026-06-05-cc-connect-使用手册.md" \
  --cover /path/to/cover.jpg
```

With a template:

```bash
python3 scripts/publish_kuaifa_draft.py \
  "_posts/2026-06-05-cc-connect-使用手册.md" \
  --cover /path/to/cover.jpg \
  --template mint
```

The script strips Jekyll front matter before sending the Markdown to kuaifa. It publishes to WeChat drafts by default, then you review and publish manually in the WeChat Official Account backend.

Dry run:

```bash
python3 scripts/publish_kuaifa_draft.py "_posts/xxx.md" --cover cover.jpg --dry-run
```
