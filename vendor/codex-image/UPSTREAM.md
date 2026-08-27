# Codex-Image Upstream

This directory vendors the dependency-free Codex-Image runtime and offline tests
used by any-Cowart's bitmap workflows.

- Upstream: `https://github.com/cookaihq/codex-image`
- Version: `3.2.0`
- Commit: `0027c47191288f1ec85281c84b41906a256cb1ff`
- License: MIT; see `LICENSE`

The standalone Agent Skill registration and automatic update checker are not
vendored. any-Cowart's own skills call the bundled runtime directly with the
upstream convention:

```bash
node vendor/codex-image/scripts/generate-image.mjs --prompt "..." --json
```

Update this directory from a verified upstream release as one unit. Do not make
private runtime changes that cause its CLI or JSON contract to diverge from the
recorded upstream version.
