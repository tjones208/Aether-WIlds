// Persistence via localStorage. Small, forgiving, and never throws to the UI.
// Older saves (pre-overworld) are upgraded in place by filling missing fields.

import { SPAWN } from "./world";
import type { Player } from "./types";

const KEY = "aether-wilds-save-v1";

export function saveGame(player: Player): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently.
  }
}

// Fill in any fields added after this save was written, so old saves keep working.
function upgrade(p: Player): Player {
  return {
    ...p,
    pos: p.pos ?? { ...SPAWN },
    quests: p.quests ?? {},
    bosses: p.bosses ?? [],
    talkedNpcs: p.talkedNpcs ?? [],
    visitedPlaces: p.visitedPlaces ?? [],
    steps: p.steps ?? 0,
  };
}

export function loadGame(): Player | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Player;
    if (!p || typeof p.level !== "number" || !p.stats) return null;
    return upgrade(p);
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
