import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const catalogPath = process.argv[2];
if (!catalogPath) throw new Error("Usage: npm run import:pk2-monsters -- <catalog-with-guides.json>");

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

function guideToMap(position) {
  const sectorX = position.regionX + Math.floor(position.positionX / 32);
  const sectorY = position.regionY - Math.floor(position.positionY / 32);
  const localX = (position.positionX % 32) * 60 + 30;
  const localY = (31 - (position.positionY % 32)) * 60 + 30;
  return {
    lat: sectorY + localY / 1920 - 1,
    lng: sectorX + localX / 1920,
  };
}

const monsters = catalog.monsters
  .filter((monster) => monster.guidePosition || monster.habitatRegions?.length)
  .map((monster) => ({
    id: monster.refId,
    codeName: monster.codeName,
    originCodeName: monster.originCodeName,
    name: monster.displayName,
    level: monster.level,
    guidePosition: monster.guidePosition ? guideToMap(monster.guidePosition) : null,
    habitatRegions: (monster.habitatRegions ?? []).map(({ regionX, regionY }) => ({
      regionX,
      regionY,
      bounds: { south: regionY - 4, west: regionX, north: regionY, east: regionX + 4 },
    })),
  }))
  .sort((left, right) => left.id - right.id);

const mujigi = monsters.find((monster) => monster.codeName === "MOB_KT_MUJIGI");
const ujigi = monsters.find((monster) => monster.codeName === "MOB_KT_MUJIGI_CLON");
assert.equal(mujigi?.id, 1991);
assert.equal(ujigi?.id, 2110);
assert.equal(mujigi?.habitatRegions.length, 3);
assert.deepEqual(mujigi?.habitatRegions.map(({ regionX, regionY }) => `${regionX}x${regionY}`), ["130x97", "130x93", "130x89"]);

const output = {
  source: {
    archive: "Silkroad Media PK2 files",
    files: ["worldmapguidedata.txt", "worldmapguidedata_region.txt"],
    precision: "Client guide habitats and representative pins; not exact server spawn points.",
  },
  monsters,
};

await writeFile(new URL("../src/data/monster-habitats.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Exported ${monsters.length} guided PK2 monsters.`);
