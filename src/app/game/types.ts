// Core type definitions for the Aether Wilds mobile RPG.

export type ClassId = "warrior" | "mage" | "rogue";

export type Stats = {
  maxHp: number;
  maxMp: number;
  atk: number; // physical power
  def: number; // damage reduction
  mag: number; // magical power
  spd: number; // turn order + flee/crit
};

export type SkillKind = "attack" | "heal" | "buff";

export type Skill = {
  id: string;
  name: string;
  kind: SkillKind;
  mpCost: number;
  power: number; // scaling multiplier applied to mag (attack/heal)
  // For buffs: the temporary def/atk bonus and how many turns it lasts.
  buff?: { stat: "def" | "atk"; amount: number; turns: number };
  desc: string;
  learnAtLevel: number;
  classes: ClassId[];
};

export type ItemId = "potion" | "hi_potion" | "ether" | "phoenix";

export type Item = {
  id: ItemId;
  name: string;
  price: number;
  desc: string;
  // Effect applied to the player when used.
  effect: { hp?: number; mp?: number; revive?: boolean };
};

export type StatusEffect = {
  kind: "poison" | "defend" | "atkup" | "defup";
  turns: number;
  amount?: number; // magnitude for buffs / poison damage
};

export type Combatant = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  mag: number;
  spd: number;
  statuses: StatusEffect[];
};

export type Enemy = Combatant & {
  id: string;
  xp: number;
  gold: number;
  sprite: string; // emoji sprite
  isBoss?: boolean;
};

export type Zone = {
  id: string;
  name: string;
  blurb: string;
  minLevel: number;
  enemyPool: string[]; // enemy ids
  boss: string; // enemy id
  bg: string; // background gradient classes
};

// ---- World / overworld ------------------------------------------------------

export type WorldPos = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";

export type PlaceKind = "town" | "castle" | "dungeon";

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  pos: WorldPos;
  regionIndex: number; // maps to ZONES index (enemy pool / boss)
  npcs?: string[]; // npc ids present here
  bossId?: string; // dungeons: the boss that lurks here
  // Dungeons: the boss id you must have already defeated to enter.
  requiresBoss?: string;
  intro?: string;
};

export type Npc = {
  id: string;
  name: string;
  sprite: string;
  place: string; // place id where they stand
  lines: string[]; // idle chatter
  questId?: string; // quest this npc gives / turns in
};

// ---- Quests -----------------------------------------------------------------

export type QuestObjective =
  | { kind: "kill"; enemyId?: string; target: number; label: string }
  | { kind: "boss"; bossId: string; label: string }
  | { kind: "level"; target: number; label: string }
  | { kind: "talk"; npcId: string; label: string };

export type QuestReward = {
  gold?: number;
  xp?: number;
  item?: ItemId;
  itemQty?: number;
};

export type Quest = {
  id: string;
  name: string;
  giver: string; // npc id
  summary: string;
  objectives: QuestObjective[];
  reward: QuestReward;
  prerequisite?: string; // quest id that must be turned in first
  isMain?: boolean;
  acceptText: string;
  completeText: string;
};

export type QuestStatus = "available" | "active" | "completed" | "turnedIn";

export type QuestProgress = {
  status: QuestStatus;
  counts: number[]; // per-objective progress (used for kill objectives)
};

// ---- Player -----------------------------------------------------------------

export type Player = {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  mp: number;
  stats: Stats;
  gold: number; // displayed as "Gil"
  skills: string[]; // learned skill ids
  inventory: Record<ItemId, number>;
  statuses: StatusEffect[];
  battlesWon: number;
  // World state
  pos: WorldPos;
  quests: Record<string, QuestProgress>;
  bosses: string[]; // defeated boss ids
  talkedNpcs: string[];
  visitedPlaces: string[];
  steps: number;
};

export type Screen =
  | "title"
  | "class"
  | "world"
  | "town"
  | "battle"
  | "quests"
  | "victory"
  | "defeat";

export type BattleState = {
  enemy: Enemy;
  zoneIndex: number;
  isBoss: boolean;
  turn: "player" | "enemy" | "over";
  log: string[];
  playerDefending: boolean;
  rewardXp: number;
  rewardGold: number;
  outcome: "win" | "lose" | null;
  // Where to return after the battle resolves.
  returnTo: "world" | "town";
};
