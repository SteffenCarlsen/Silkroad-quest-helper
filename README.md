# Silkroad Quest Helper

A dark-only, static quest planner for Silkroad Online. Search 98 level 1–80 quests and 697 NPCs, focus NPCs on the xSROMap world map, display known monster habitats extracted from PK2 files for selected and planned quests, and keep an ordered plan in a browser cookie.

**[Open the live Silkroad Quest Helper](https://steffencarlsen.github.io/Silkroad-quest-helper/)**

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
- Monster guide habitats: extracted from PK2 client files

Normalized, checked-in data lives in `src/data/`. Refresh it with `npm run import:data`, review `src/data/mapping-audit.json`, and run `npm run validate:data` before accepting the change. The validator expects the pinned snapshots to contain 88 quests and 697 NPCs.

The supplied quest article provides 88 quests. Ten additional quests confirmed by in-game screenshots are included as supplemental records. Missing rewards elsewhere remain unknown rather than being invented.

Monster overlays are client guide regions with representative guide pins, not exact server spawn locations. To refresh them, extract a compatible catalog from the PK2 files and import it:

```powershell
npm run import:pk2-monsters -- "C:\path\to\catalog-with-guides.json"
npm run import:data
npm run check
```

## GitHub Pages

The live site is available at [steffencarlsen.github.io/Silkroad-quest-helper](https://steffencarlsen.github.io/Silkroad-quest-helper/). The workflow in `.github/workflows/pages.yml` validates and deploys `dist/` after a push to `main`, or when run manually.

The map tile pyramid remains hosted by the xSROMap GitHub Pages site instead of being copied into this repository. This keeps the repository small and means the base map requires network access to that site.

## Credits

- Quest information is based on [Shinakuma's “Questler LvL 1-80”](https://shinakuma.wordpress.com/2007/02/23/questler-lvl-1-80/).
- World map, map tiles, and NPC data are provided by [JellyBitz/xSROMap](https://github.com/JellyBitz/xSROMap).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution.
