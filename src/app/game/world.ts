// The overworld: a tile grid you walk across, plus the towns, castle, dungeons
// and NPCs scattered over it. Regions map to the ZONES in content.ts and
// determine which enemies you meet in the wild.

import type { Npc, Place, WorldPos } from "./types";

// Tile legend:
//   .  grass    (walkable, light encounters)
//   f  forest   (walkable, heavier encounters)
//   =  road     (walkable, safe — no encounters)
//   M  mountain (blocked)
//   ~  water    (blocked)
//   T  town     C  castle    D  dungeon  (walkable — entering triggers the place)
export const WORLD_MAP: string[] = [
  "MMMMMMMMMMMM",
  "M..f.D..ff.M",
  "M..======.M",
  "M.f=~~=.ff.M",
  "M.==T==.D..M",
  "Mf=...==...M",
  "M.=..==....M",
  "M.==...=...M",
  "M.=C=T=....M",
  "Mf=...=.D..M",
  "MMMMMMMMMMMM",
];

export const MAP_W = WORLD_MAP[0].length;
export const MAP_H = WORLD_MAP.length;

export function tileAt(x: number, y: number): string {
  if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) return "M";
  return WORLD_MAP[y][x];
}

export function isWalkable(x: number, y: number): boolean {
  const t = tileAt(x, y);
  return t !== "M" && t !== "~";
}

// Northern rows are deadlier. Region index feeds ZONES (0 = meadow … 2 = spire).
export function regionForPos(pos: WorldPos): number {
  if (pos.y >= 7) return 0; // meadow (south, home)
  if (pos.y >= 4) return 1; // ashen hollow (middle)
  return 2; // frostspire (north)
}

// Encounter probability per step for the tile you land on.
export function encounterChance(x: number, y: number): number {
  const t = tileAt(x, y);
  if (t === "f") return 0.22;
  if (t === ".") return 0.12;
  return 0; // roads, towns, etc. are safe
}

export const PLAYER_SPRITE = "🧝";

export const TERRAIN_SPRITE: Record<string, string> = {
  ".": "🌿",
  f: "🌲",
  "=": "🟫",
  M: "⛰️",
  "~": "🌊",
  T: "🏘️",
  C: "🏰",
  D: "🕳️",
};

export const SPAWN: WorldPos = { x: 5, y: 7 }; // just outside Rivenholde

export const PLACES: Place[] = [
  {
    id: "rivenholde",
    name: "Rivenholde",
    kind: "town",
    pos: { x: 5, y: 8 },
    regionIndex: 0,
    npcs: ["merchant", "innkeeper", "hunter"],
    intro: "The bells of Rivenholde, last free town of the southern meadow.",
  },
  {
    id: "aurelis",
    name: "Castle Aurelis",
    kind: "castle",
    pos: { x: 3, y: 8 },
    regionIndex: 0,
    npcs: ["king", "sage"],
    intro: "Banners hang low over Castle Aurelis. The court is uneasy.",
  },
  {
    id: "emberton",
    name: "Emberton",
    kind: "town",
    pos: { x: 4, y: 4 },
    regionIndex: 1,
    npcs: ["smith", "wanderer"],
    intro: "Emberton clings to the edge of the Ashen Hollow, smoke on the wind.",
  },
  {
    id: "meadow_dungeon",
    name: "Slimewarren Burrow",
    kind: "dungeon",
    pos: { x: 8, y: 9 },
    regionIndex: 0,
    bossId: "boss_grumble",
    intro: "A damp burrow that reeks of ooze. Something huge shifts within.",
  },
  {
    id: "hollow_dungeon",
    name: "Emberfang Den",
    kind: "dungeon",
    pos: { x: 8, y: 4 },
    regionIndex: 1,
    bossId: "boss_fang",
    requiresBoss: "boss_grumble",
    intro: "Bones litter the den's mouth. The pack's alpha waits in the dark.",
  },
  {
    id: "spire_dungeon",
    name: "Frostspire Summit",
    kind: "dungeon",
    pos: { x: 5, y: 1 },
    regionIndex: 2,
    bossId: "boss_pyre",
    requiresBoss: "boss_fang",
    intro: "Wind screams across the summit. Above the frost, a furnace glows.",
  },
];

export function placeAt(x: number, y: number): Place | undefined {
  return PLACES.find((p) => p.pos.x === x && p.pos.y === y);
}

export function getPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

export const NPCS: Record<string, Npc> = {
  king: {
    id: "king",
    name: "King Aldren",
    sprite: "🤴",
    place: "aurelis",
    lines: [
      "The realm frays at the edges, hero. I am glad you have come.",
      "Prove yourself, and Aurelis will not forget it.",
    ],
    questId: "main_slime",
  },
  sage: {
    id: "sage",
    name: "Court Sage Vell",
    sprite: "🧙",
    place: "aurelis",
    lines: [
      "Three threats gnaw at the wilds: the Slime King, the Alpha, and the Everburning.",
      "Defeat them in turn and the roads north will open to you.",
    ],
  },
  merchant: {
    id: "merchant",
    name: "Merchant Pell",
    sprite: "🧑‍🌾",
    place: "rivenholde",
    lines: ["Potions, ethers, a Phoenix Down if you're brave. Coin first!"],
    questId: "side_pests",
  },
  innkeeper: {
    id: "innkeeper",
    name: "Innkeeper Mara",
    sprite: "👩‍🍳",
    place: "rivenholde",
    lines: ["Rest your bones, love. A warm bed works wonders on the wounded."],
  },
  hunter: {
    id: "hunter",
    name: "Hunter Corin",
    sprite: "🏹",
    place: "rivenholde",
    lines: ["The wolves have grown bold. Someone ought to thin the pack."],
    questId: "side_wolves",
  },
  smith: {
    id: "smith",
    name: "Smith Dara",
    sprite: "🧑‍🏭",
    place: "emberton",
    lines: ["Steel's no good against a dragon's breath. Strength is. Grow it."],
    questId: "side_strength",
  },
  wanderer: {
    id: "wanderer",
    name: "The Wanderer",
    sprite: "🧎",
    place: "emberton",
    lines: [
      "I climbed the Frostspire once. I came back with white hair and one truth:",
      "Pyraxis the Everburning does not sleep. It waits.",
    ],
  },
};

export function npcsAt(placeId: string): Npc[] {
  return Object.values(NPCS).filter((n) => n.place === placeId);
}
