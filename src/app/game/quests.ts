// Quest definitions: a three-part main storyline plus a few side quests.
// Objectives are tracked automatically by the engine as you fight and level.

import type { Quest } from "./types";

export const QUESTS: Record<string, Quest> = {
  main_slime: {
    id: "main_slime",
    name: "The Slime King's Reign",
    giver: "king",
    isMain: true,
    summary:
      "Grumble, the Slime King, has overrun Slimewarren Burrow south of Rivenholde. End his reign.",
    objectives: [{ kind: "boss", bossId: "boss_grumble", label: "Defeat the Slime King" }],
    reward: { gold: 120, xp: 40, item: "hi_potion", itemQty: 2 },
    acceptText:
      "The southern burrow festers with ooze. Slay their king, and the meadow breathes again.",
    completeText:
      "Grumble is no more? Rivenholde owes you a debt. The Hollow's beasts are next — go.",
  },
  main_wolf: {
    id: "main_wolf",
    name: "Alpha Predator",
    giver: "king",
    isMain: true,
    prerequisite: "main_slime",
    summary:
      "Fang, alpha of the Emberfang pack, hunts the Ashen Hollow. Bring the pack to heel.",
    objectives: [{ kind: "boss", bossId: "boss_fang", label: "Defeat Fang in Emberfang Den" }],
    reward: { gold: 260, xp: 90, item: "phoenix", itemQty: 1 },
    acceptText:
      "The pack answers only to its alpha. Cut off the head and the Hollow is ours.",
    completeText:
      "Fang has fallen. Only the Everburning remains atop the Frostspire. This is the true test.",
  },
  main_dragon: {
    id: "main_dragon",
    name: "The Everburning",
    giver: "king",
    isMain: true,
    prerequisite: "main_wolf",
    summary:
      "Pyraxis the Everburning coils atop Frostspire Summit. Climb, and end the age of dragons.",
    objectives: [{ kind: "boss", bossId: "boss_pyre", label: "Defeat Pyraxis atop the Frostspire" }],
    reward: { gold: 600, xp: 200 },
    acceptText:
      "No blade of Aurelis ever reached the summit. Perhaps a hero can. The realm holds its breath.",
    completeText:
      "The Everburning is ash. You have saved the Aether Wilds, and your name will outlive us all. 🏆",
  },
  side_pests: {
    id: "side_pests",
    name: "Pest Control",
    giver: "merchant",
    summary: "Merchant Pell wants the meadow slimes culled — they keep eating her stock.",
    objectives: [{ kind: "kill", enemyId: "slime", target: 5, label: "Slay Green Slimes" }],
    reward: { gold: 60, xp: 20, item: "potion", itemQty: 3 },
    acceptText: "Five of the little horrors and we'll call it square. Off you go!",
    completeText: "Bless you. Here — potions, on the house. Well, mostly.",
  },
  side_wolves: {
    id: "side_wolves",
    name: "Wolfsbane",
    giver: "hunter",
    prerequisite: "main_slime",
    summary: "Hunter Corin needs the Dire Wolves of the Hollow thinned before they reach town.",
    objectives: [{ kind: "kill", enemyId: "wolf", target: 4, label: "Hunt Dire Wolves" }],
    reward: { gold: 140, xp: 55, item: "ether", itemQty: 2 },
    acceptText: "Four wolves. Bring me their howls silenced and there's coin in it.",
    completeText: "Cleanly done. The pack will think twice now. Take this for your trouble.",
  },
  side_strength: {
    id: "side_strength",
    name: "Proof of Strength",
    giver: "smith",
    summary: "Smith Dara won't forge for a weakling. Reach level 6 and prove your mettle.",
    objectives: [{ kind: "level", target: 6, label: "Reach Level 6" }],
    reward: { gold: 100, xp: 0, item: "hi_potion", itemQty: 2 },
    acceptText: "Come back when you can swing that thing like you mean it. Level six, at least.",
    completeText: "Ha! Now there's a warrior. Take these — you've earned a smith's respect.",
  },
};

export function getQuest(id: string): Quest | undefined {
  return QUESTS[id];
}
