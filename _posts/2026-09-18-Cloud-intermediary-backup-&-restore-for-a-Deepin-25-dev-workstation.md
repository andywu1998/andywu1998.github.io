---
layout: post
title: "Cloud-intermediary backup & restore for a Deepin 25 dev workstation"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-18 18:13:42 +0800
tags:
  - "个人助理"
  - "topics"
---

> 来源：`notes/topics/environment_backup_restore/cloud-options-research.md`
# Cloud-intermediary backup & restore for a Deepin 25 dev workstation

Research date: **2026-09-18**. Machine: Deepin 25, user `admin`, ~33 GB used on `/home`.
Hard constraint: **the cloud must be the only transport** — no scp/rsync/direct sync between the user's own machines.

All numbers below come from primary sources (official pricing pages, official docs, official quota pages, project repos). Where a number could not be pulled from a primary source it is explicitly marked **UNVERIFIED**. Secondary-only or experiential claims are labelled as such.

---

## 1. TL;DR recommendation

1. Split the backup into two layers: a **small Git repo for declarative config** and a **restic repository in mainland-China object storage for bulk data**.
2. Bulk data (`/home`, `/etc` subset, `/opt`, systemd units) goes to **restic on Aliyun OSS** (or Tencent COS). Restic encrypts client-side, deduplicates, is incremental, and supports single-file restore via `restic restore --include` / `restic mount`.
3. 100 GB in Aliyun OSS Standard (local redundancy) costs roughly **¥0.12/GB-month = ~¥12/month** plus egress at **¥0.25/GB (00:00–08:00) or ¥0.50/GB (08:00–24:00)**; Tencent COS gives **50 GB free for 6 months** for new users.
4. If you want a free tier first, **Cloudflare R2** is the best free option (10 GB-month free, egress free, $0.015/GB-month after) but it has **no mainland-China region**; test upload/download speed from the Deepin box before committing. **Backblaze B2** is the cheapest paid option (~$0.70/month for 100 GB) but also has no documented mainland region.
5. Do **not** use GitHub as the primary bulk store: repo files are hard-blocked above **100 MiB**, repos should stay **under 1 GB**, free Git LFS is only **10 GiB storage + 10 GiB/month bandwidth**, Actions artifacts are **500 MB on Free and expire after 90 days**, and the AUP lets GitHub throttle/suspend for "excessive bandwidth".
6. GitHub **Releases** (up to 1000 assets, each < 2 GiB, no documented total/bandwidth limit) and **ghcr.io** (OCI blobs, 10 GB/layer, storage currently free) are usable for *small* artifacts only, and are subject to the same bandwidth-abuse clause.
7. Config layer: use **chezmoi** (single-command new-machine setup, per-machine templates/secrets) + an **Ansible** playbook or shell bootstrap + exported package manifests. Keep it well under 1 GB, push to **Gitee** (already in use, domestic and fast) or GitHub.
8. Package manifests to export: `apt-mark showmanual`, `dpkg --get-selections`, and **`ll-cli list`** for Linyaps/Linglong apps. Deepin 25's "Solid" immutable system makes `/usr` read-only and rolls back failed updates, so reinstalling apt packages on a fresh box may need Deepin-specific handling — verify before relying on it.
9. **Avoid** relying on Syncthing / Tailscale / ZeroTier as the backup transport: all default to direct peer-to-peer, which violates the hard constraint. They can be forced through a cloud relay (Syncthing relay, Tailscale DERP, ZeroTier `forceTcpRelay`), but public Syncthing relays are explicitly "not managed or vetted", and Tailscale has **no mainland-China DERP** (nearest: Hong Kong/Tokyo/Singapore).
10. **Avoid** unofficial cloud-drive bridges (阿里云盘 / 百度网盘 / 夸克网盘): rclone has **no official backend** for any of the three; the official Baidu and Aliyun Drive portals are partner/app-oriented and account-ban risk for scripted personal backup is real but unquantified.

---

## 2. Comparison table

Cost column assumes **100 GB stored**, rounded, using only the cited official rates. Currency conversions are approximate.

| Option | Free tier | Paid cost for ~100 GB | Egress / restore cost | Mainland-China reachability | Best use here |
| --- | --- | --- | --- | --- | --- |
| **GitHub repo (plain Git)** | Unlimited public/private repos within size guidance | $0 | $0 | Slow/intermittent from mainland (user experience; **UNVERIFIED**) | Dotfiles, scripts, manifests (tiny files) |
| **GitHub Git LFS** | 10 GiB storage + 10 GiB/month bandwidth (Free) | Overage billed; exact per-GiB price **UNVERIFIED** | Counts against 10 GiB/month free | Same as GitHub | Small binaries only |
| **GitHub Releases** | Up to 1000 assets/release, each < 2 GiB, no documented total/bandwidth cap | $0 | $0; AUP bandwidth clause applies | Same as GitHub | Installers/bootstrap tarballs |
| **GitHub Actions artifacts** | 500 MB storage, 2000 min/month (Free); 90-day default retention | Not cost-effective | n/a | Same as GitHub | CI temp files only — **not a backup** |
| **ghcr.io (OCI blobs)** | Container image storage + bandwidth **currently free** | $0 today, may change with ≥1 month notice | Free today | Same as GitHub | Small encrypted blobs via OCI artifact |
| **Gitee** | Domestic Git host; exact quotas **UNVERIFIED** | n/a | n/a | Fast in mainland (domestic) | Config repo |
| **Cloudflare R2** | 10 GB-month storage, 1M Class A + 10M Class B ops/month, egress free | ~$0.60–$1.35 | **Free** | No mainland region (location hints: wnam/enam/weur/eeur/apac/oc); China Network needs Enterprise + ICP | Best free-tier candidate; test speed |
| **Backblaze B2** | First 10 GB free, free egress up to 3× average monthly storage | ~$0.28–$0.63 ($6.95/TB) | Free up to 3× stored, then $0.01/GB | No mainland region documented (**UNVERIFIED**); test speed | Cheapest paid bulk store |
| **AWS S3 (global)** | Free tier now up to $200 credits, free plan 6 months (new accounts) | Per-GB rate not extracted → **UNVERIFIED** | $0.09/GB example (Ireland) | No mainland region | Not recommended for China |
| **AWS China (Beijing/Ningxia)** | 5 GB Standard + 20k GET + 2k PUT per month for 1 year | ¥0.1755/GB-month tier 1 → ~¥17.6 | Data transfer **not** in free tier; rate not extracted → **UNVERIFIED** | Mainland regions, operated by Sinnet/NWCD, separate accounts | Possible, pricier than OSS/COS |
| **Aliyun OSS** | 20 GB Standard-LRS + 2 GB egress for 3 months (new users) | ¥0.12/GB-month → ~¥12 (**~$1.7**) | ¥0.25/GB (00:00–08:00), ¥0.50/GB (08:00–24:00) | Mainland regions, fast; custom domains need ICP filing (**partially UNVERIFIED**) | **Primary recommendation** |
| **Tencent COS** | 50 GB Standard free for 6 months (180 days) | Official intl example uses $0.024/GB-month → ~$2.4; mainland rate not extracted → **UNVERIFIED** | Not covered by free quota; mainland rate not extracted → **UNVERIFIED** | Mainland regions, fast | Strong alternative to OSS |
| **Qiniu Kodo** | 10 GB storage + 10 GB CDN-origin traffic + 100k PUT + 1M GET per month | ¥0.115/GB-month → ~¥11.5 | ¥0.26/GB (0–100 TB) | Mainland regions, fast | Viable alternative |
| **Volcengine TOS** | Could not extract → **UNVERIFIED** | Could not extract → **UNVERIFIED** | Could not extract → **UNVERIFIED** | Mainland regions | Only if already on Volcengine |
| **阿里云盘 (Aliyun Drive)** | Consumer free tier; portal not scraped | Consumer pricing | n/a | Domestic, fast | **Risky**: no official rclone backend |
| **百度网盘 (Baidu Netdisk)** | Consumer free tier | Partner/app model | n/a | Domestic, fast | **Risky**: partner-oriented open API, no rclone backend |
| **夸克网盘 (Quark)** | Consumer free tier | n/a | n/a | Domestic, fast | **Risky**: no official API/rclone backend found |
| **OneDrive** | Free tier not verified from primary source → **UNVERIFIED** | Microsoft 365 plans | n/a | Reachable but often slow in mainland (**UNVERIFIED**) | Not recommended as primary |
| **Syncthing (public relay)** | Free | $0 | Free; relay bandwidth is slow | 13 CN + 15 HK + 19 SG + 14 JP relays in live pool | Convenience only, **not** a backup store |
| **Tailscale (DERP relay)** | Free plan (personal) | $0 | Free | No mainland DERP; nearest HK/Tokyo/Singapore | Not suitable as backup transport |
| **ZeroTier (TCP relay)** | Free plan | $0 | Free | Global roots + TCP relay | Already in use for one machine; same caveat |

---

## 3. Per-option detail (with sources)

### 3.1 Git as an artifact store

**GitHub repository and file size limits** — GitHub warns at **50 MiB** and **blocks files larger than 100 MiB**; it recommends repositories stay **below 1 GB**, with **below 5 GB strongly recommended**, and may ask you to shrink repos that strain infrastructure.
Source: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

**Git LFS free quota and per-file limits** — GitHub Free includes **10 GiB bandwidth and 10 GiB storage** per month; per-file maximum is **2 GB** on Free/Pro, 4 GB on Team, 5 GB on Enterprise Cloud. Exceeding the per-file limit rejects the file.
Sources: https://docs.github.com/en/billing/concepts/product-billing/git-lfs , https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage

**Git LFS overage behaviour** — with no payment method on file, exceeding the storage quota means you can still clone but only receive pointer files and cannot push new LFS files; exceeding the bandwidth quota disables LFS until the next month. The doc states overage is billed per GiB but **does not publish the per-GiB rate** (it points to the GitHub pricing calculator) — **UNVERIFIED**.
Source: https://docs.github.com/en/billing/concepts/product-billing/git-lfs

**GitHub Releases** — up to **1000 assets per release**, each file **under 2 GiB**; "There is no limit on the total size of a release, nor bandwidth usage" as a product statement, but see the AUP clause below.
Source: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

**GitHub Actions artifacts** — **90-day default retention** (configurable), and the Free plan includes only **500 MB of artifact storage** and 2000 minutes/month; the storage is shared with GitHub Packages.
Sources: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts , https://docs.github.com/en/actions/reference/limits

**ghcr.io / GitHub Container registry as a generic blob store** — supports **OCI specifications**, has a **10 GB per-layer size limit** and a **10-minute upload timeout**. GitHub states "Container image storage and bandwidth for the Container registry is currently free" and promises at least one month's notice before any change. A 33–100 GB backup split into <10 GB OCI layers is technically possible (e.g. via OCI artifacts), but it is a registry, not a backup service.
Sources: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry , https://docs.github.com/en/billing/concepts/product-billing/github-packages

**GitHub Packages quota** — GitHub Free: **500 MB storage + 1 GB data transfer per month**, shared with Actions artifacts; public packages are free and data transfer in is free.
Source: https://docs.github.com/en/billing/concepts/product-billing/github-packages

**GitHub Acceptable Use Policy risk** — Section 9 "Excessive Bandwidth Use": GitHub may "suspend your Account, throttle your file hosting, or otherwise limit your activity", and may "delete repositories" placing undue strain on infrastructure. This is the strongest argument against using GitHub Releases/LFS as a bulk backup target.
Source: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

**Gitee** — the user already hosts at least one repo there and it is a domestic Chinese service (fast, no cross-border issues). I could **not** verify Gitee's current repo/file/LFS quotas: the Gitee Help Center is a Docusaurus SPA whose article HTML is anti-bot obfuscated. **UNVERIFIED** — check the in-product limits pages when logged in.
Attempted source: https://gitee.com/help/articles/4232

### 3.2 Object storage

**Cloudflare R2** — free tier: **10 GB-month storage, 1 million Class A operations, 10 million Class B operations per month, egress free**. Standard paid storage **$0.015/GB-month**, Class A **$4.50/million**, Class B **$0.36/million**. Egress is free for the S3 API and r2.dev. No China region; location hints are only `wnam/enam/weur/eeur/apac/oc`.
Sources: https://developers.cloudflare.com/r2/pricing/ , https://developers.cloudflare.com/r2/reference/data-location/

**Cloudflare China Network** — mainland delivery runs on JD Cloud data centers, is a **separate Enterprise-plan subscription**, and requires a **valid ICP filing per apex domain**. This does not give R2 a mainland endpoint.
Source: https://developers.cloudflare.com/china-network/

**Backblaze B2** — **first 10 GB storage always free**; **$6.95/TB/month** ($0.00695/GB-month); **free egress up to 3× average monthly storage**, then **$0.01/GB**; Class A/B/C API calls free, Class D $0.004/10,000 with the first 2,500/day free. 100 GB ≈ **$0.70/month**. B2's region list could not be fetched from a primary page (docs returned 404, help center 403) — **UNVERIFIED**, but the pricing/docs describe US and EU storage only; treat mainland speed as untested.
Source: https://www.backblaze.com/cloud-storage/pricing

**AWS S3 (global)** — new accounts get **up to $200 Free Tier credits**; the free plan is available for **6 months** after account creation. The per-GB Standard storage rate could not be extracted from the dynamically-rendered pricing table (**UNVERIFIED**); a worked example on the same page prices Data Transfer OUT from Ireland at **$0.09/GB**, so a 100 GB restore costs ~$9 before storage.
Source: https://aws.amazon.com/s3/pricing/

**AWS China (Beijing/Ningxia)** — S3 Free Tier includes **5 GB Standard Storage, 20,000 GET and 2,000 PUT per month for one year**; **data transfer is not included**. S3 Standard is **¥0.1755/GB-month** (tier 1) → 100 GB ≈ **¥17.6/month**. These regions are operated by Sinnet (Beijing) and NWCD (Ningxia) and are separate from AWS global.
Sources: https://www.amazonaws.cn/en/free/ , https://www.amazonaws.cn/en/s3/pricing/

**Aliyun OSS** — new users (real-name verified, OSS not previously activated) get **20 GB Standard-LRS storage and 2 GB outbound traffic for 3 months**. Standard-LRS is **¥0.12/GB-month**; outbound internet traffic is **¥0.25/GB during 00:00–08:00 and ¥0.50/GB during 08:00–24:00**; CDN-origin traffic is ¥0.15/GB. 100 GB ≈ **¥12/month**. Note: those new-user free amounts are the only free quota; the 5 GB/month perpetual quota applies only to certain overseas regions (Hong Kong, Singapore, etc.), not mainland.
Sources: https://help.aliyun.com/zh/oss/free-quota-for-new-users , https://help.aliyun.com/zh/oss/product-overview/billing-overview , https://www.aliyun.com/price/detail/oss

**Tencent COS** — new users get a **50 GB STANDARD storage package free for 6 months (180 days)**; it offsets **only STANDARD storage**, not requests or traffic. The official billing example uses **$0.024/GB-month** for standard storage. The mainland RMB per-GB storage and egress rates could not be extracted (docs are JS-rendered) — **UNVERIFIED**.
Source: https://www.tencentcloud.com/document/product/436/6240

**Qiniu Kodo** — real-name-verified users get, monthly: **10 GB standard storage, 10 GB standard CDN-origin traffic, 100,000 PUT/DELETE, 1,000,000 GET, unlimited upload traffic**. Mainland standard storage is **¥0.115/GB-month**; outbound traffic **¥0.26/GB** for 0–100 TB. 100 GB ≈ **¥11.5/month**.
Source: https://www.qiniu.com/prices/kodo

**Volcengine TOS** — the official docs/pricing pages are JS-rendered and I could not extract free tier or rates. **UNVERIFIED.** It is a mainland service and S3-compatible, so rclone can use it through the generic `Other` S3 provider with a custom endpoint, but no first-class rclone provider exists.
Source: https://www.volcengine.com/docs/6349/129563

### 3.3 Backup tools that write to object storage

**restic** — native repository backends: **Local, SFTP, REST server, Amazon S3 and S3-compatible storage, OpenStack Swift, Backblaze B2, Azure Blob, Google Cloud Storage, and "other services via rclone"**. Repositories are encrypted; `restic restore --include /path` restores a single file, and `restic mount` exposes snapshots over FUSE for browsing.
Sources: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html , https://restic.readthedocs.io/en/stable/050_restore.html

**Borg / borgmatic** — Borg deduplicates with content-defined chunking (across machines sharing a repo), compresses with lz4/zstd/zlib/lzma, and uses **256-bit AES with HMAC-SHA256, client-side**. Remote repositories are **over SSH only** in Borg 1.x. borgmatic's configuration schema describes the repository as a "local path or Borg URL" (`ssh://user@host/./repo`), i.e. **no native object-storage backend**. To use Borg with S3/B2 you must add a server/VM or an rclone mount — which adds a machine the user does not want.
Sources: https://borgbackup.readthedocs.io/en/stable/ , https://torsion.org/borgmatic/docs/reference/configuration/

**rclone** — the broadest backend catalogue. The official backend list includes **S3, Backblaze B2, WebDAV, Microsoft OneDrive, Google Drive, pCloud, Proton Drive, QingStor, SFTP, etc.**, and a **Crypt overlay** that encrypts any other remote. The S3 provider list includes **Alibaba Cloud OSS, Cloudflare R2, Qiniu, Tencent COS, Huawei OBS, Netease NOS, China Mobile Ecloud**. Notably absent: **Aliyun Drive, Baidu Netdisk, Quark**. rclone is a sync/copy tool, not a deduplicating snapshot tool, so it complements restic rather than replacing it.
Sources: https://rclone.org/overview/ , https://rclone.org/s3/ , https://rclone.org/onedrive/

**Duplicity** — encrypted incremental backups using GnuPG and librsync; native URL backends include **`b2://`, `s3://`, `azure://`, `onedrive://`, `webdav://`, `box://`, `mega://`, and `rclone://`**. Single-file restore is possible only by extracting from the tar volumes, which is clunkier than restic.
Source: https://duplicity.gitlab.io/stable/duplicity.1.html

**Kopia** — repository backends: **Amazon S3 and S3-compatible, Azure Blob, Backblaze B2, Google Drive (native and via rclone), WebDAV, SFTP**, and "some cloud storages supported by Rclone". Kopia notes its rclone support is **experimental** and tested only with Dropbox, OneDrive and Google Drive.
Source: https://kopia.io/docs/repositories/

**Practical choice:** restic for snapshots + dedup + encryption + single-file restore; rclone for moving large one-off archives or mirrors; skip Borg unless an always-on server is acceptable.

### 3.4 Bidirectional / multi-machine sync over a cloud relay

**Syncthing** — relay traffic is bounced via public relays when a direct connection is impossible; the connection is end-to-end encrypted and the relay "only retransmits the encrypted data". However, "a device must register with a relay ... so the relay knows your IP and device ID", and the relay operator can see traffic volume. The relay status page disclaims: relays "are not managed or vetted by the Syncthing project."
Sources: https://docs.syncthing.net/users/relaying.html , https://relays.syncthing.net/

Live relay pool (fetched 2026-09-18 from Syncthing's own status endpoint `https://relays.syncthing.net/endpoint/full`): **1009 relays total, 111 in Asia — 13 CN, 15 HK, 19 SG, 14 JP, 8 IN, 6 KR**. So a relay-only Syncthing setup is technically "cloud-intermediated" and has nearby relays, but it is slow and third-party-operated.

**Tailscale** — DERP (Designated Encrypted Relay for Packets) servers negotiate NAT traversal and act as fallback relays; traffic is WireGuard-encrypted end-to-end and a DERP server "blindly forwards already-encrypted traffic". Tailscale prefers peer relays, then DERP. DERP locations include **Hong Kong, Tokyo, Singapore** but **no mainland China**.
Source: https://tailscale.com/kb/1232/derp-servers

**ZeroTier** — by default "ZeroTier makes direct, peer to peer connections over UDP"; when NAT punching/UDP fails, the agent falls back to a **TCP relay service run by ZeroTier Inc.**, or a self-hosted `pylon` relay with `forceTcpRelay: true`. Roots ("planets") are a global pool run by ZeroTier Inc.; private "moons" can be added.
Sources: https://docs.zerotier.com/relay/ , https://docs.zerotier.com/roots/

Verdict for the hard constraint: **default configurations of all three violate "no machine-to-machine"** (they try direct P2P first). They can be forced onto a cloud relay, but the cleanest compliant design is to make object storage the system of record and treat these tools, if used at all, as convenience sync for a small subset.

### 3.5 Declarative environment provisioning

**chezmoi** — manages dotfiles from a single source state, explicitly supports "Using chezmoi across multiple machines", "Set up a new machine with a single command", per-machine differences, templates, and secret managers. Best fit for this user.
Sources: https://www.chezmoi.io/quick-start/ , https://www.chezmoi.io/

**Ansible** — `ansible.builtin.apt` manages apt package state (`present`, `latest`, `absent`, `fixed`, `build-dep`) and supports install-time `.deb` files; `ansible.builtin.dpkg_selections` sets dpkg selection states. Ansible is agentless over SSH, but here it can also be run locally from the bootstrap on the restored machine.
Sources: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_module.html , https://docs.ansible.com/ansible/latest/collections/ansible/builtin/dpkg_selections_module.html , https://github.com/ansible/ansible/blob/devel/lib/ansible/modules/apt.py

**Nix + Home Manager** — "declarative configuration of user specific (non-global) packages and dotfiles", with generations and rollbacks. Powerful but a large conceptual jump for a Deepin box and overlaps poorly with apt/linglong.
Source: https://nix-community.github.io/home-manager/

**GNU Guix** — `guix home` instantiates a declarative home configuration, and Guix offers declarative package management via manifests. Same overlap caveat, plus Guix on Deepin is non-native.
Source: https://guix.gnu.org/manual/en/html_node/Invoking-guix-home.html

**dotbot** — "bootstraps your dotfiles", VCS-agnostic, self-contained, no external dependencies; simpler than chezmoi but no templating/secrets.
Source: https://github.com/anishathalye/dotbot

**GNU Stow** — a "symlink farm manager" that makes files from separate package trees appear in `$HOME`; useful for dotfiles but no templating and no package management.
Source: https://www.gnu.org/software/stow/manual/stow.html

**Deepin 25 specifics**

- **Solid / deepin Immutable System**: core directories such as `/usr/bin` are force-mounted read-only; updates are atomic with auto-rollback on failure. This means apt installs into `/usr` are not a durable provisioning strategy on stock Deepin 25.
  Source: https://www.deepin.org/en/deepin-25-release/
- The local note `notes/documents/通过跳板机把_Deepin_25_虚拟机接入_ZeroTier_网络.md` documents `deepin-immutable-ctl`, `deepin-immutable-writable`, and `ClearAfterReboot: true`, and worked around it by installing ZeroTier under `/opt`. This is a **local observation, not an official Deepin doc — UNVERIFIED** against primary sources.
- **Package export/import (Debian tools)**: `dpkg --get-selections > file`, `dpkg --clear-selections`, `dpkg --set-selections < file` are documented in the dpkg man page; `apt-mark showmanual` lists manually-installed packages so you can reconstruct the "explicit" set.
  Sources: https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html , https://manpages.debian.org/bookworm/apt/apt-mark.8.en.html , https://www.debian.org/doc/manuals/debian-faq/pkg-basics.en.html
- **Linglong / Linyaps**: `ll-cli list` lists installed apps, `ll-cli list --upgradable` shows upgrades; apps install with `ll-cli install <app-id>` and run with `ll-cli run <app-id>`. On Deepin 25 the repo is `https://ci.deepin.com/repo/obs/linglong:/CI:/release/Deepin_25/` and packages are `linglong-bin` + `linglong-installer`.
  Sources: https://linyaps.org.cn/guide/start/manage-apps-with-cli.html , https://linyaps.org.cn/guide/start/install.html , https://github.com/linuxdeepin/linglong

### 3.6 Cloud drive services

**OneDrive** — rclone has an official OneDrive backend (also usable via WebDAV/duplicity/kopia). Microsoft's plan pages blocked automated fetches (403), so the free tier and plan sizes are **UNVERIFIED** from primary sources in this session. Reachability from mainland is variable; treat as a secondary target only.
Sources: https://rclone.org/onedrive/ , https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans (not fetched)

**百度网盘** — there is an official 百度网盘开放平台 developer site (API-based upload/download/manage, explicitly aimed at partners: "满足不同行业不同阶段合作伙伴的个性化需求"). There is **no official rclone backend**, and the doc landing page is dated 2022-03-24 (possibly stale). Using third-party bridges risks account restrictions.
Source: https://pan.baidu.com/union/doc/

**阿里云盘 / Aliyun Drive** — an official "阿里云盘开发者门户" exists at https://www.alipan.com/developer (page title confirms it), but it is a JS app; scope, approval process and ToS were not verifiable. rclone's official backend list does **not** include it, and the rclone changelog does not mention an aliyundrive/baidu/quark backend.
Sources: https://www.alipan.com/developer , https://rclone.org/overview/ , https://github.com/rclone/rclone/blob/master/docs/content/changelog.md

**夸克网盘 / Quark** — no official developer/open-platform docs found, no rclone backend. **Risk: high, reliability unknown.**

---

## 4. Concrete tooling design (restic + rclone + chezmoi + Ansible)

### 4.1 What to back up (and where)

| Tier | Content | Destination | Tool |
| --- | --- | --- | --- |
| Bulk | `/home` (33 GB), `/etc`, `/opt` (e.g. the custom ZeroTier install), `/var/lib` selected services | Aliyun OSS / Tencent COS (or R2/B2 if speed is fine) | restic |
| Config | `~/.config`, dotfiles, SSH/GPG **public** material, shell config | Gitee/GitHub repo | chezmoi |
| Manifests | `apt-mark showmanual`, `dpkg --get-selections`, `ll-cli list`, `crontab -l`, systemd unit list | Git repo | scripts + Ansible |
| Secrets | restic password, age/GPG keys, cloud credentials | Password manager + offline paper; **never** only in the same cloud repo | — |

### 4.2 restic to a China-friendly S3-compatible bucket

restic supports S3-compatible storage natively. Aliyun OSS / Tencent COS / Qiniu / R2 / B2 all work with the S3 backend; for providers not listed in rclone, pass the endpoint explicitly.

```bash
export RESTIC_REPOSITORY="s3:https://oss-cn-hangzhou.aliyuncs.com/<bucket>/restic"
export RESTIC_PASSWORD_FILE="$HOME/.config/restic/pass"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

restic init
restic backup /home /etc /opt \
  --exclude-caches --exclude '**/.cache' --exclude '**/node_modules'
restic snapshots
restic check --read-data-subset=5%
```

Restore a whole machine, or just one file:

```bash
restic restore latest --target /                 # full restore
restic restore latest --target /tmp/restore \
  --include /home/admin/.config/foo/bar.conf     # single file
restic mount /mnt/restic                         # browse all snapshots
```

Sources: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html , https://restic.readthedocs.io/en/stable/050_restore.html

### 4.3 Config/bootstrap repo with chezmoi

```bash
# on the current machine
chezmoi init --apply <your-git-repo>
chezmoi add ~/.bashrc ~/.config/...
chezmoi cd && git add -A && git commit -m "..." && git push

# on a brand-new machine
chezmoi init --apply <your-git-repo>
```

chezmoi supports machine-to-machine differences and templates, so one repo can cover a laptop and a desktop.
Source: https://www.chezmoi.io/quick-start/

### 4.4 Package manifests

```bash
mkdir -p ~/dotfiles/packages
apt-mark showmanual                > ~/dotfiles/packages/apt-manual.txt
dpkg --get-selections              > ~/dotfiles/packages/dpkg-selections.txt
ll-cli list                        > ~/dotfiles/packages/linglong-list.txt
```

Restore apt selections (only if Deepin 25's immutable root permits it — see the caveat above):

```bash
sudo dpkg --clear-selections
sudo dpkg --set-selections < ~/dotfiles/packages/dpkg-selections.txt
sudo apt-get dselect-upgrade
# or, for the explicit set:
xargs -a ~/dotfiles/packages/apt-manual.txt sudo apt-get install -y
```

Sources: https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html , https://manpages.debian.org/bookworm/apt/apt-mark.8.en.html

Restore Linglong apps:

```bash
sudo apt install linglong-bin linglong-installer   # if not preinstalled
ll-cli list --json | ...                            # script the install list
ll-cli install <app-id>
```

Sources: https://linyaps.org.cn/guide/start/manage-apps-with-cli.html , https://linyaps.org.cn/guide/start/install.html

### 4.5 Ansible

Keep a small `playbook.yml` in the chezmoi/Git repo that installs apt packages, writes `/etc` files, and enables systemd units. Ansible's apt and dpkg_selections modules are the documented primitives; run it locally on the freshly restored machine (`ansible-playbook -i localhost, -c local`).
Sources: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_module.html , https://docs.ansible.com/ansible/latest/collections/ansible/builtin/dpkg_selections_module.html

### 4.6 Suggested monthly cost for 33 GB `/home` with restic dedup

restic deduplicates and compresses, so the repository is usually smaller than the raw 33 GB, but plan for up to 50–100 GB of repository growth over time.

- Aliyun OSS Standard-LRS, 100 GB: ~**¥12/month** (~$1.7); a full restore downloads up to 100 GB → **¥25–50** depending on time of day.
- Tencent COS, 100 GB: **UNVERIFIED** mainland rate; intl doc example implies ~$2.4; first 50 GB free for 6 months.
- Qiniu, 100 GB: ~**¥11.5/month**; restore egress ~¥26.
- Backblaze B2, 100 GB after 10 GB free: ~**$0.63/month**; restore free up to 3× stored.
- Cloudflare R2, 100 GB after 10 GB free: ~**$1.35/month**; restore egress free.

---

## 5. What could not be verified

These are explicitly uncertain; do not treat them as facts.

1. **Gitee quotas** (repo size, per-file limit, LFS) — Gitee Help Center is an anti-bot-obfuscated SPA; article https://gitee.com/help/articles/4232 could not be read. Check in-product when logged in.
2. **Exact GitHub Git LFS overage price per GiB** — the official billing doc describes metering but defers pricing to the GitHub pricing calculator.
3. **AWS S3 global Standard storage per-GB rate** — the official pricing table is injected client-side; only the $0.09/GB data-transfer example was extractable. The AWS pricing JSON at `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/s3/USD/current/s3-standard.json` is primary but not human-labelled for the first-50-TB row.
4. **AWS China data-transfer (egress) rates for S3** — not extracted; the free-tier page confirms transfer is excluded from the free tier.
5. **Tencent COS mainland China storage/egress rates** — cloud.tencent.com doc pages are JS-rendered; only the international doc (50 GB/6-month free, $0.024/GB-month example) was extracted.
6. **Volcengine TOS free tier and all pricing** — docs and pricing pages render client-side; nothing extractable.
7. **Backblaze B2 region list** — official docs URLs returned 404 and the help center returned 403; I could not prove the absence of a mainland presence from a primary source. (Practically, none is documented.)
8. **Aliyun OSS ICP/备案 requirement for custom domains** — the doc page is JS-rendered and the English mirror 404'd. The general rule (custom domain binding in mainland requires filing) is widely stated but **not verified here from a primary source**.
9. **OneDrive free tier and plan sizes** — Microsoft pages returned 403 / bot-block pages.
10. **阿里云盘 developer portal scope/ToS** — the portal is a JS app; whether personal automation is allowed is unverified. No official rclone backend exists.
11. **Baidu Netdisk open platform eligibility** (doc page dated 2022-03-24, partner-oriented) — likely stale and not aimed at personal backup.
12. **Quark Netdisk API** — no official developer docs found at all (negative finding).
13. **Deepin 25 immutable-system tooling (`deepin-immutable-ctl`, `ClearAfterReboot`)** — confirmed only by the user's local note; the official release notes confirm the read-only/atomic/rollback behaviour but not the CLI details.
14. **China mainland network speed to R2/B2/GitHub/OneDrive** — no primary source can state this; must be measured on the actual Deepin box.
15. **Whether restic on an immutable Deepin 25 can restore `/usr` in place** — untested; likely you restore user data/system config and re-provision packages, not raw `/usr`.

---

## 6. Full source URL list

GitHub / Gitee

- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
- https://docs.github.com/en/billing/concepts/product-billing/git-lfs
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts
- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- https://docs.github.com/en/billing/concepts/product-billing/github-packages
- https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- https://gitee.com/help/articles/4232 (could not read)

Object storage

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/reference/data-location/
- https://developers.cloudflare.com/china-network/
- https://www.backblaze.com/cloud-storage/pricing
- https://aws.amazon.com/s3/pricing/
- https://www.amazonaws.cn/en/free/
- https://www.amazonaws.cn/en/s3/pricing/
- https://help.aliyun.com/zh/oss/free-quota-for-new-users
- https://help.aliyun.com/zh/oss/product-overview/billing-overview
- https://www.aliyun.com/price/detail/oss
- https://www.tencentcloud.com/document/product/436/6240
- https://www.qiniu.com/prices/kodo
- https://www.volcengine.com/docs/6349/129563

Backup / sync tools

- https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html
- https://restic.readthedocs.io/en/stable/050_restore.html
- https://borgbackup.readthedocs.io/en/stable/
- https://torsion.org/borgmatic/docs/reference/configuration/
- https://rclone.org/overview/
- https://rclone.org/s3/
- https://rclone.org/onedrive/
- https://duplicity.gitlab.io/stable/duplicity.1.html
- https://kopia.io/docs/repositories/
- https://docs.syncthing.net/users/relaying.html
- https://relays.syncthing.net/
- https://relays.syncthing.net/endpoint/full
- https://tailscale.com/kb/1232/derp-servers
- https://docs.zerotier.com/relay/
- https://docs.zerotier.com/roots/

Provisioning / Deepin

- https://www.chezmoi.io/quick-start/
- https://www.chezmoi.io/
- https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_module.html
- https://docs.ansible.com/ansible/latest/collections/ansible/builtin/dpkg_selections_module.html
- https://github.com/ansible/ansible/blob/devel/lib/ansible/modules/apt.py
- https://nix-community.github.io/home-manager/
- https://guix.gnu.org/manual/en/html_node/Invoking-guix-home.html
- https://github.com/anishathalye/dotbot
- https://www.gnu.org/software/stow/manual/stow.html
- https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html
- https://manpages.debian.org/bookworm/apt/apt-mark.8.en.html
- https://www.debian.org/doc/manuals/debian-faq/pkg-basics.en.html
- https://www.deepin.org/en/deepin-25-release/
- https://www.deepin.org/en/deepin-25/
- https://linyaps.org.cn/guide/start/manage-apps-with-cli.html
- https://linyaps.org.cn/guide/start/install.html
- https://github.com/linuxdeepin/linglong

Cloud drives

- https://pan.baidu.com/union/doc/
- https://www.alipan.com/developer
- https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans (not fetchable)
