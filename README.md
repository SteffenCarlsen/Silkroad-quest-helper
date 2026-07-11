# Silkroad Quest Helper

A dark-only, static quest planner for Silkroad Online. Search 90 level 1–80 quests and 697 NPCs, focus NPCs on the xSROMap world map, display known Crown monster habitats for selected and planned quests, and keep an ordered plan in a browser cookie.

## Run locally

On Windows, use either entry point from PowerShell:

```powershell
.\start-dev.ps1   # Development server with live reload
.\start-prod.ps1  # Production build and preview server
```

Both scripts install the exact locked dependencies before starting. The equivalent manual development commands are:

```powershell
npm ci
npm run dev
```

The complete local quality gate is:

```powershell
npm run check
```

This validates all source relationships, runs behavior tests, type-checks the app, and builds the static site in `dist/`.

## Data

- Quest facts: [Shinakuma's level 1–80 quest list](https://shinakuma.wordpress.com/2007/02/23/questler-lvl-1-80/)
- Map/NPC data: [JellyBitz/xSROMap](https://github.com/JellyBitz/xSROMap), pinned to commit `52bfffef4467`
- Monster guide habitats: Crown `Media.cro` client guide files exported by the sibling Crown DPS Calculator tooling

Normalized, checked-in data lives in `src/data/`. Refresh it with `npm run import:data`, review `src/data/mapping-audit.json`, and run `npm run validate:data` before accepting the change. The validator expects the pinned snapshots to contain 88 quests and 697 NPCs.

The supplied quest article provides 88 quests. Two level-50 quests confirmed by in-game screenshots, “Noise Pollution” and “The Powerful Looking Accessory,” are included as supplemental records. Missing rewards elsewhere remain unknown rather than being invented.

Monster overlays are client guide regions with representative guide pins, not exact server spawn locations. To refresh them, first run the Crown exporter against `Media.cro`, then import its catalog:

```powershell
& "..\Crown-DPS-Calculator\tools\crown-media-exporter\target\release\crown-media-exporter.exe" --archive "C:\path\to\Media.cro" --out "$env:TEMP\crown-catalog.json"
npm run import:crown-monsters -- "$env:TEMP\crown-catalog.json"
npm run import:data
npm run check
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` validates and deploys `dist/` after a push to `main`, or when run manually. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The map tile pyramid remains hosted by the xSROMap GitHub Pages site instead of being copied into this repository. This keeps the repository small and means the base map requires network access to that site.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution.
