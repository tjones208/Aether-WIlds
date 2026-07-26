// Persistence via localStorage. Small, forgiving, and never throws to the UI.
// Understands both the new party-based save and the older single-hero one,
// migrating the latter into a one-member party so nobody loses progress.

import { SPAWN } from "./world";
import { CLASSES } from "./content";
import type { Character, ItemId, Player } from "./types";

const KEY = "aether-wilds-save-v1";

const DEFAULT_INVENTORY: Record<ItemId, number> = { potion: 3, hi_potion: 0, ether: 1, phoenix: 0 };

export function saveGame(player: Player): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently.
  }
}

// Shared world/inventory fields, with defaults for anything a save predates.
function withDefaults(p: any, party: Character[]): Player {
  return {
    party,
    gold: typeof p.gold === "number" ? p.gold : 30,
    inventory: p.inventory ?? { ...DEFAULT_INVENTORY },
    battlesWon: p.battlesWon ?? 0,
    pos: p.pos ?? { ...SPAWN },
    quests: p.quests ?? {},
    bosses: p.bosses ?? [],
    talkedNpcs: p.talkedNpcs ?? [],
    visitedPlaces: p.visitedPlaces ?? [],
    recruited: p.recruited ?? [],
    steps: p.steps ?? 0,
  };
}

// Old single-hero saves stored the character's stats at the root; fold them into
// a one-member party.
function migrateSingleHero(p: any): Player | null {
  if (!p.stats || !p.classId) return null;
  const hero: Character = {
    id: "hero",
    name: p.name ?? "Wanderer",
    classId: p.classId,
    sprite: CLASSES[p.classId as keyof typeof CLASSES]?.sprite ?? "🗡️",
    level: p.level ?? 1,
    xp: p.xp ?? 0,
    xpToNext: p.xpToNext ?? 100,
    hp: p.hp ?? p.stats.maxHp,
    mp: p.mp ?? p.stats.maxMp,
    stats: p.stats,
    skills: p.skills ?? [],
    statuses: [],
  };
  return withDefaults(p, [hero]);
}

export function loadGame(): Player | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as any;
    if (!p) return null;
    // New party save.
    if (Array.isArray(p.party) && p.party.length > 0 && p.party[0]?.stats) {
      return withDefaults(p, p.party as Character[]);
    }
    // Legacy single-hero save.
    return migrateSingleHero(p);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}
