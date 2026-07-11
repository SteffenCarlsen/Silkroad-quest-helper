export type Npc = {
  id: number;
  name: string;
  role: string | null;
  town: string | null;
  aliases: string[];
  position: {
    x: number;
    y: number;
    z: number;
    region: number;
    coordinateSystem: "client";
  };
  mapPosition: { lat: number; lng: number };
};

export type Quest = {
  id: number;
  name: string;
  level: number;
  repeatCount: number;
  giverNpcId: number;
  relatedNpcIds: number[];
  targetMonsterIds: number[];
  prerequisiteQuestIds: number[];
  mutuallyExclusiveQuestIds: number[];
  steps: string[];
  rewards: string[];
  notes: string[];
  town: string | null;
  sourceUrl: string;
};

export type MonsterHabitat = {
  id: number;
  codeName: string;
  originCodeName: string;
  name: string;
  level: number;
  guidePosition: { lat: number; lng: number } | null;
  habitatRegions: Array<{
    regionX: number;
    regionY: number;
    bounds: { south: number; west: number; north: number; east: number };
  }>;
};

export type Selection = { type: "quest" | "npc"; id: number } | null;
