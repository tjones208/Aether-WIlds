// The story of the Aether Wilds: a prologue, three chapters, and an epilogue,
// plus the companions you recruit along the way (party caps at four). The current
// chapter is derived from your progress rather than stored, so it can never drift
// out of sync with the world.

import type { Chapter, Companion, Player } from "./types";

export const COMPANIONS: Record<string, Companion> = {
  elowen: {
    id: "elowen",
    name: "Sister Elowen",
    classId: "mage",
    sprite: "🧝‍♀️",
    role: "Cleric of the Aether",
    joinText:
      "The mark on you — it is the Aether's own light. I have waited for its bearer. My staff and my prayers are yours.",
  },
  garrick: {
    id: "garrick",
    name: "Sir Garrick",
    classId: "warrior",
    sprite: "🧔",
    role: "Knight of Aurelis",
    joinText:
      "You did what the whole garrison could not. By the King's leave, my shield is yours until the Wilds are whole again.",
  },
  kestrel: {
    id: "kestrel",
    name: "Kestrel",
    classId: "rogue",
    sprite: "🏹",
    role: "Ranger of the Hollow",
    joinText:
      "I've tracked the beasts of the Hollow for years and lived. You'll want eyes like mine on the road north. I'm in.",
  },
};

export function getCompanion(id: string): Companion | undefined {
  return COMPANIONS[id];
}

// Ordered narrative. `currentChapter` picks the right one from progress.
export const CHAPTERS: Chapter[] = [
  {
    id: "prologue",
    num: 0,
    title: "Prologue — The Falling Star",
    synopsis:
      "A star fell over the Aether Wilds, and where it struck, the land began to rot. You woke beneath it with a strange light burning on your skin — the Aether's mark. Castle Aurelis has called for the one who bears it.",
    objective: "Travel to Castle Aurelis and answer King Aldren's summons.",
  },
  {
    id: "ch1",
    num: 1,
    title: "Chapter I — The Slime King's Reign",
    synopsis:
      "The court sage names the rot for what it is: the three Wardens who once guarded the Wilds have been corrupted by the blight. The first, Grumble the Slime King, has drowned the southern meadow in ooze from Slimewarren Burrow.",
    objective: "Recruit allies in Rivenholde, then cleanse Slimewarren Burrow of the Slime King.",
  },
  {
    id: "ch2",
    num: 2,
    title: "Chapter II — Alpha of Ash",
    synopsis:
      "With the meadow freed, the road to the Ashen Hollow opens. Fang, Warden of Beasts, leads a pack that hunts the smoke-choked woods. The town of Emberton begs for deliverance.",
    objective: "Cross into the Ashen Hollow, gather your strength, and bring down Fang in Emberfang Den.",
  },
  {
    id: "ch3",
    num: 3,
    title: "Chapter III — The Everburning",
    synopsis:
      "Two Wardens freed, the Aether's mark blazes brighter. The last and greatest waits atop the frozen summit: Pyraxis the Everburning, the heart of the blight itself. This is the climb from which no knight of Aurelis ever returned.",
    objective: "Ascend Frostspire Summit and face Pyraxis the Everburning.",
  },
  {
    id: "epilogue",
    num: 4,
    title: "Epilogue — The Wilds Whole",
    synopsis:
      "The Everburning is ash, the three Wardens laid to rest, and the blight recedes from the Aether Wilds. Bells ring in Rivenholde and Aurelis alike. The mark on you has quieted at last — its work, and yours, is done.",
    objective: "Your journey is complete. Roam the Wilds you saved. 🏆",
  },
];

// Derive the current chapter purely from what the party has accomplished.
export function currentChapter(player: Player): Chapter {
  if (player.bosses.includes("boss_pyre")) return CHAPTERS[4];
  if (player.bosses.includes("boss_fang")) return CHAPTERS[3];
  if (player.bosses.includes("boss_grumble")) return CHAPTERS[2];
  // Chapter I begins once you've taken the King's first quest; prologue before.
  const started = player.quests["main_slime"]?.status;
  if (started === "active" || started === "turnedIn") return CHAPTERS[1];
  return CHAPTERS[0];
}
