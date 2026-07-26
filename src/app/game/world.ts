// The overworld: a tile grid you roam across, plus the towns, castle, dungeons
// and NPCs scattered over it. Regions map to the ZONES in content.ts and
// determine which enemies you meet in the wild. The Overworld renderer paints
// these tiles to a canvas and walks a character smoothly across them.

import type { Npc, Place, WorldPos } from "./types";

// Tile legend:
//   .  grass     f  forest      s  sand
//   ~  water (wadeable)          =  road (safe)
//   M  mountain (blocked)
//   T  town      C  castle       D  dungeon   (walkable — entering triggers it)
export const WORLD_MAP: string[] = [
  "MMMMMMMMMMMMMMMMMMMM",
  "M....f....D...ff...M",
  "M..ff..======..f..M",
  "M...f..=....=......M",
  "M..s~~=.ff..=..MM..M",
  "M..s~~=....=.T=.M..M",
  "M...s=.ff.==.==....M",
  "M..===...D....=....M",
  "M.f=..ff....==.f...M",
  "M..=.....~~~...s...M",
  "M..==...~~~~..ss...M",
  "M...==.s~~~..ss....M",
  "M.ff.===.s..==.....M",
  "M....C===T===D.ff..M",
  "M...f...===...f....M",
  "MMMMMMMMMMMMMMMMMMMM",
];

export const MAP_W = WORLD_MAP[0].length;
export const MAP_H = WORLD_MAP.length;

export function tileAt(x: number, y: number): string {
  if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) return "M";
  return WORLD_MAP[y][x];
}

// Only mountains truly block you — water can be waded through.
export function isWalkable(x: number, y: number): boolean {
  return tileAt(x, y) !== "M";
}

// Northern rows are deadlier. Region index feeds ZONES (0 = meadow … 2 = spire).
export function regionForPos(pos: WorldPos): number {
  if (pos.y >= 11) return 0; // meadow (south, home)
  if (pos.y >= 5) return 1; // ashen hollow (middle)
  return 2; // frostspire (north)
}

// Encounter probability per step for the tile you land on.
export function encounterChance(x: number, y: number): number {
  switch (tileAt(x, y)) {
    case "f":
      return 0.18;
    case ".":
      return 0.1;
    case "s":
      return 0.06;
    case "~":
      return 0.05;
    default:
      return 0; // roads, towns, dungeons, mountains
  }
}

export const SPAWN: WorldPos = { x: 9, y: 12 }; // just north of Rivenholde

export const PLACES: Place[] = [
  {
    id: "rivenholde",
    name: "Rivenholde",
    kind: "town",
    pos: { x: 9, y: 13 },
    regionIndex: 0,
    npcs: ["merchant", "innkeeper", "hunter", "elowen"],
    intro: "The bells of Rivenholde, last free town of the southern meadow.",
  },
  {
    id: "aurelis",
    name: "Castle Aurelis",
    kind: "castle",
    pos: { x: 5, y: 13 },
    regionIndex: 0,
    npcs: ["king", "sage", "garrick"],
    intro: "Banners hang low over Castle Aurelis. The court is uneasy.",
  },
  {
    id: "emberton",
    name: "Emberton",
    kind: "town",
    pos: { x: 12, y: 5 },
    regionIndex: 1,
    npcs: ["smith", "wanderer", "kestrel"],
    intro: "Emberton clings to the edge of the Ashen Hollow, smoke on the wind.",
  },
  {
    id: "meadow_dungeon",
    name: "Slimewarren Burrow",
    kind: "dungeon",
    pos: { x: 13, y: 13 },
    regionIndex: 0,
    bossId: "boss_grumble",
    intro: "A damp burrow that reeks of ooze. Something huge shifts within.",
  },
  {
    id: "hollow_dungeon",
    name: "Emberfang Den",
    kind: "dungeon",
    pos: { x: 9, y: 7 },
    regionIndex: 1,
    bossId: "boss_fang",
    requiresBoss: "boss_grumble",
    intro: "Bones litter the den's mouth. The pack's alpha waits in the dark.",
  },
  {
    id: "spire_dungeon",
    name: "Frostspire Summit",
    kind: "dungeon",
    pos: { x: 10, y: 1 },
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
  // ---- Recruitable companions ----
  elowen: {
    id: "elowen",
    name: "Sister Elowen",
    sprite: "🧝‍♀️",
    place: "rivenholde",
    lines: [
      "You carry the Aether's mark. I have prayed for its bearer to come.",
      "The Wardens were guardians once, before the falling star turned them.",
    ],
    recruit: "elowen",
  },
  garrick: {
    id: "garrick",
    name: "Sir Garrick",
    sprite: "🧔",
    place: "aurelis",
    lines: [
      "The garrison broke against the Slime King. I did not.",
      "Free the meadow and I will follow you into the Hollow and beyond.",
    ],
    recruit: "garrick",
    recruitReqBoss: "boss_grumble",
  },
  kestrel: {
    id: "kestrel",
    name: "Kestrel",
    sprite: "🏹",
    place: "emberton",
    lines: [
      "Stranger with a glowing arm. You'll be going north, then.",
      "Nobody crosses the Hollow without a ranger. Lucky for you, I'm the best.",
    ],
    recruit: "kestrel",
    recruitReqBoss: "boss_grumble",
  },
};

export function npcsAt(placeId: string): Npc[] {
  return Object.values(NPCS).filter((n) => n.place === placeId);
}
