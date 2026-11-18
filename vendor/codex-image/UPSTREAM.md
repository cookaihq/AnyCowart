# Codex-Image Upstream

This directory vendors the dependency-free Codex-Image runtime and offline tests
used by any-Cowart's bitmap workflows.

- Upstream: `https://github.com/cookaihq/codex-image`
- Tag: `v3.4.0`
- Commit: `190da37d635056eca04f80b64614b3e61331266f`
- License: MIT; see `LICENSE`

The standalone Agent Skill registration and automatic update checker are not
vendored. any-Cowart's own skills call the bundled runtime directly with the
upstream convention:

```bash
node vendor/codex-image/scripts/generate-image.mjs --prompt "..." --json
```

The Plugin adds `--config-skill` and its project configuration layers.

Update this directory from a verified upstream release as one unit. Preserve the upstream CLI and JSON contracts when carrying forward the Plugin adaptation.
