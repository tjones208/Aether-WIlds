// Pure game logic: character creation, stat scaling, combat math, world movement,
// and quest progression. Deterministic given its inputs (RNG lives here but is the
// only source of nondeterminism), which keeps the React layer thin.

import { CLASSES, ENEMIES, ITEMS, SKILLS, ZONES } from "./content";
import { QUESTS } from "./quests";
import {
  SPAWN,
  encounterChance,
  isWalkable,
  placeAt,
  regionForPos,
} from "./world";
import type {
  BattleState,
  ClassId,
  Dir,
  Enemy,
  ItemId,
  Npc,
  Place,
  Player,
  Quest,
  QuestObjective,
  QuestProgress,
  Skill,
  Stats,
} from "./types";

// ---- RNG helpers ------------------------------------------------------------

export const rng = () => Math.random();
const roll = (n: number) => Math.floor(rng() * n);
const chance = (p: number) => rng() < p;
export const pick = <T,>(arr: T[]): T => arr[roll(arr.length)];

// ---- Character creation & growth -------------------------------------------

export function xpForLevel(level: number): number {
  return Math.floor(20 * Math.pow(level, 1.55));
}

export function statsForLevel(classId: ClassId, level: number): Stats {
  const c = CLASSES[classId];
  const g = c.growth;
  const n = level - 1;
  return {
    maxHp: c.base.maxHp + g.maxHp * n,
    maxMp: c.base.maxMp + g.maxMp * n,
    atk: c.base.atk + g.atk * n,
    def: c.base.def + g.def * n,
    mag: c.base.mag + g.mag * n,
    spd: c.base.spd + g.spd * n,
  };
}

export function createPlayer(name: string, classId: ClassId): Player {
  const stats = statsForLevel(classId, 1);
  const skills = SKILLS.filter(
    (s) => s.classes.includes(classId) && s.learnAtLevel <= 1,
  ).map((s) => s.id);
  return {
    name: name.trim() || "Wanderer",
    classId,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(2),
    hp: stats.maxHp,
    mp: stats.maxMp,
    stats,
    gold: 30,
    skills,
    inventory: { potion: 3, hi_potion: 0, ether: 1, phoenix: 0 },
    statuses: [],
    battlesWon: 0,
    pos: { ...SPAWN },
    quests: {},
    bosses: [],
    talkedNpcs: [],
    visitedPlaces: [],
    steps: 0,
  };
}

export function skillsFor(player: Player): Skill[] {
  return SKILLS.filter((s) => player.skills.includes(s.id));
}

// Returns the updated player plus any "you learned X / leveled up" messages.
export function grantXp(
  player: Player,
  amount: number,
): { player: Player; messages: string[] } {
  const messages: string[] = [];
  let p: Player = { ...player, xp: player.xp + amount };
  if (amount > 0) messages.push(`Gained ${amount} XP.`);

  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    const newLevel = p.level + 1;
    const stats = statsForLevel(p.classId, newLevel);
    p = {
      ...p,
      level: newLevel,
      stats,
      hp: stats.maxHp,
      mp: stats.maxMp,
      xpToNext: xpForLevel(newLevel + 1),
    };
    messages.push(`⭐ Level up! You are now level ${newLevel}.`);

    const learned = SKILLS.filter(
      (s) =>
        s.classes.includes(p.classId) &&
        s.learnAtLevel === newLevel &&
        !p.skills.includes(s.id),
    );
    for (const s of learned) {
      p.skills = [...p.skills, s.id];
      messages.push(`✨ Learned ${s.name}!`);
    }
  }
  return { player: p, messages };
}

// ---- Enemy spawning ---------------------------------------------------------

export function spawnEnemy(enemyId: string, zoneIndex: number): Enemy {
  const t = ENEMIES[enemyId];
  const scale = t.isBoss ? 1 : 1 + zoneIndex * 0.12;
  const maxHp = Math.round(t.hpFull * scale);
  return {
    id: t.id,
    name: t.name,
    sprite: t.sprite,
    maxHp,
    hp: maxHp,
    atk: Math.round(t.atk * scale),
    def: Math.round(t.def * scale),
    mag: Math.round(t.mag * scale),
    spd: t.spd,
    xp: t.xp,
    gold: t.gold,
    isBoss: t.isBoss,
    statuses: [],
  };
}

export function startBattle(
  zoneIndex: number,
  opts: { boss?: boolean; returnTo?: "world" | "town" } = {},
): BattleState {
  const zone = ZONES[zoneIndex];
  const enemyId = opts.boss ? zone.boss : pick(zone.enemyPool);
  const enemy = spawnEnemy(enemyId, zoneIndex);
  return {
    enemy,
    zoneIndex,
    isBoss: !!opts.boss,
    turn: "player",
    log: [opts.boss ? `A boss appears — ${enemy.name}!` : `A wild ${enemy.name} appears!`],
    playerDefending: false,
    rewardXp: enemy.xp,
    rewardGold: enemy.gold,
    outcome: null,
    returnTo: opts.returnTo ?? "world",
  };
}

// ---- World movement ---------------------------------------------------------

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export type MoveEvent =
  | { kind: "blocked" }
  | { kind: "moved" }
  | { kind: "encounter"; battle: BattleState }
  | { kind: "place"; place: Place };

export function move(player: Player, dir: Dir): { player: Player; event: MoveEvent } {
  const { dx, dy } = DELTA[dir];
  const nx = player.pos.x + dx;
  const ny = player.pos.y + dy;
  if (!isWalkable(nx, ny)) return { player, event: { kind: "blocked" } };

  const p: Player = { ...player, pos: { x: nx, y: ny }, steps: player.steps + 1 };

  const place = placeAt(nx, ny);
  if (place) return { player: p, event: { kind: "place", place } };

  if (chance(encounterChance(nx, ny))) {
    const region = regionForPos(p.pos);
    return { player: p, event: { kind: "encounter", battle: startBattle(region, { returnTo: "world" }) } };
  }
  return { player: p, event: { kind: "moved" } };
}

// A dungeon may be sealed until you have felled a prerequisite boss.
export function dungeonBlockedReason(player: Player, place: Place): string | null {
  if (place.requiresBoss && !player.bosses.includes(place.requiresBoss)) {
    return `The way is sealed. First defeat ${ENEMIES[place.requiresBoss].name}.`;
  }
  return null;
}

export function startDungeonBattle(place: Place): BattleState {
  return startBattle(place.regionIndex, { boss: true, returnTo: "world" });
}

// ---- Combat math ------------------------------------------------------------

function effectiveDef(base: number, statuses: { kind: string; amount?: number }[]) {
  let def = base;
  for (const s of statuses) {
    if (s.kind === "defend") def += Math.round(base * 0.5);
    if (s.kind === "defup") def += s.amount ?? 0;
  }
  return def;
}

function effectiveAtk(base: number, statuses: { kind: string; amount?: number }[]) {
  let atk = base;
  for (const s of statuses) if (s.kind === "atkup") atk += s.amount ?? 0;
  return atk;
}

function computeHit(
  power: number,
  attackerDef: number,
  spd: number,
  variance = 0.2,
): { dmg: number; crit: boolean } {
  const crit = chance(Math.min(0.05 + spd * 0.01, 0.35));
  let dmg = Math.max(1, power - attackerDef * 0.5);
  const v = 1 - variance + rng() * (variance * 2);
  dmg = Math.round(dmg * v * (crit ? 1.7 : 1));
  return { dmg: Math.max(1, dmg), crit };
}

export type ActionResult = { player: Player; battle: BattleState };

export function playerAttack(player: Player, battle: BattleState): ActionResult {
  const enemy = { ...battle.enemy };
  const atk = effectiveAtk(player.stats.atk, player.statuses);
  const { dmg, crit } = computeHit(atk * 1.5, effectiveDef(enemy.def, enemy.statuses), player.stats.spd);
  enemy.hp = Math.max(0, enemy.hp - dmg);
  const log = [...battle.log, `You strike ${enemy.name} for ${dmg}${crit ? " (CRIT!)" : ""} damage.`];
  return { player, battle: { ...battle, enemy, log, playerDefending: false, turn: "enemy" } };
}

export function playerDefend(player: Player, battle: BattleState): ActionResult {
  const statuses = [
    ...player.statuses.filter((s) => s.kind !== "defend"),
    { kind: "defend" as const, turns: 1 },
  ];
  return {
    player: { ...player, statuses },
    battle: {
      ...battle,
      log: [...battle.log, "You brace for impact. (Defense up this turn.)"],
      playerDefending: true,
      turn: "enemy",
    },
  };
}

export function playerSkill(player: Player, battle: BattleState, skill: Skill): ActionResult {
  if (player.mp < skill.mpCost) {
    return { player, battle: { ...battle, log: [...battle.log, "Not enough MP!"] } };
  }
  let p: Player = { ...player, mp: player.mp - skill.mpCost };
  let enemy = { ...battle.enemy };
  const log = [...battle.log];

  if (skill.kind === "attack") {
    const { dmg, crit } = computeHit(
      p.stats.mag * skill.power + p.stats.atk * 0.4,
      effectiveDef(enemy.def, enemy.statuses),
      p.stats.spd,
    );
    enemy.hp = Math.max(0, enemy.hp - dmg);
    log.push(`${skill.name} hits ${enemy.name} for ${dmg}${crit ? " (CRIT!)" : ""}!`);
  } else if (skill.kind === "heal") {
    const heal = Math.round(p.stats.mag * skill.power + 6);
    const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + heal);
    log.push(`${skill.name} restores ${p.hp - before} HP.`);
  } else if (skill.kind === "buff" && skill.buff) {
    const kind = skill.buff.stat === "def" ? ("defup" as const) : ("atkup" as const);
    p.statuses = [
      ...p.statuses.filter((s) => s.kind !== kind),
      { kind, turns: skill.buff.turns, amount: skill.buff.amount },
    ];
    log.push(`${skill.name}! Your ${skill.buff.stat.toUpperCase()} rises.`);
  }

  return { player: p, battle: { ...battle, enemy, log, playerDefending: false, turn: "enemy" } };
}

export function useItem(
  player: Player,
  battle: BattleState | null,
  itemId: ItemId,
): { player: Player; message: string; consumed: boolean } {
  if ((player.inventory[itemId] ?? 0) <= 0) {
    return { player, message: "You have none left.", consumed: false };
  }
  const item = ITEMS[itemId];
  let p: Player = {
    ...player,
    inventory: { ...player.inventory, [itemId]: player.inventory[itemId] - 1 },
  };
  let message = `Used ${item.name}.`;
  if (item.effect.hp) {
    const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + item.effect.hp);
    message = `Used ${item.name}. Restored ${p.hp - before} HP.`;
  }
  if (item.effect.mp) {
    const before = p.mp;
    p.mp = Math.min(p.stats.maxMp, p.mp + item.effect.mp);
    message = `Used ${item.name}. Restored ${p.mp - before} MP.`;
  }
  return { player: p, message, consumed: true };
}

export function enemyTurn(player: Player, battle: BattleState): ActionResult {
  let enemy = { ...battle.enemy };
  const log = [...battle.log];

  enemy.statuses = enemy.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);

  const usesMagic = enemy.mag > enemy.atk && chance(0.6);
  const power = usesMagic ? enemy.mag * 1.7 : enemy.atk * 1.5;
  const def = effectiveDef(player.stats.def, player.statuses);
  const { dmg, crit } = computeHit(power, def, enemy.spd);

  let p: Player = { ...player, hp: Math.max(0, player.hp - dmg) };
  log.push(
    `${enemy.name} ${usesMagic ? "blasts" : "attacks"} you for ${dmg}${crit ? " (CRIT!)" : ""} damage.`,
  );

  if (p.hp <= 0 && (p.inventory.phoenix ?? 0) > 0) {
    p = {
      ...p,
      hp: Math.round(p.stats.maxHp / 2),
      inventory: { ...p.inventory, phoenix: p.inventory.phoenix - 1 },
    };
    log.push("🪶 A Phoenix Down flares — you rise with half HP!");
  }

  p.statuses = p.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);

  return { player: p, battle: { ...battle, enemy, log, playerDefending: false, turn: "player" } };
}

export function enemyIsFaster(player: Player, enemy: Enemy): boolean {
  if (enemy.spd === player.stats.spd) return chance(0.5);
  return enemy.spd > player.stats.spd;
}

export function attemptFlee(player: Player, enemy: Enemy): boolean {
  if (enemy.isBoss) return false;
  const p = Math.min(0.9, 0.4 + (player.stats.spd - enemy.spd) * 0.05);
  return chance(p);
}

// ---- Post-battle ------------------------------------------------------------

export function checkBattleEnd(battle: BattleState, player: Player): BattleState {
  if (battle.enemy.hp <= 0) return { ...battle, turn: "over", outcome: "win" };
  if (player.hp <= 0) return { ...battle, turn: "over", outcome: "lose" };
  return battle;
}

export function applyVictory(
  player: Player,
  battle: BattleState,
): { player: Player; messages: string[] } {
  let p: Player = {
    ...player,
    gold: player.gold + battle.rewardGold,
    battlesWon: player.battlesWon + 1,
    statuses: [],
  };
  const messages = [`Victory! +${battle.rewardGold} Gil.`];
  const enemy = battle.enemy;

  if (enemy.isBoss && !p.bosses.includes(enemy.id)) {
    p = { ...p, bosses: [...p.bosses, enemy.id] };
  }

  // Advance any active "kill" quest objectives that match this foe.
  const quests = { ...p.quests };
  let changed = false;
  for (const [qid, prog] of Object.entries(quests)) {
    if (prog.status !== "active") continue;
    const q = QUESTS[qid];
    if (!q) continue;
    const counts = [...prog.counts];
    let qc = false;
    q.objectives.forEach((o, i) => {
      if (o.kind === "kill" && (!o.enemyId || o.enemyId === enemy.id) && counts[i] < o.target) {
        counts[i] += 1;
        qc = true;
      }
    });
    if (qc) {
      quests[qid] = { ...prog, counts };
      changed = true;
      if (q.objectives.every((o, i) => objectiveDone(o, p, { ...prog, counts }, i))) {
        messages.push(`📜 Quest ready to turn in: ${q.name}`);
      }
    }
  }
  if (changed) p = { ...p, quests };

  const xpr = grantXp(p, battle.rewardXp);
  p = xpr.player;
  messages.push(...xpr.messages);
  return { player: p, messages };
}

export function restAtInn(player: Player): { player: Player; cost: number } {
  const cost = 10 + player.level * 5;
  if (player.gold < cost) return { player, cost };
  return {
    player: {
      ...player,
      gold: player.gold - cost,
      hp: player.stats.maxHp,
      mp: player.stats.maxMp,
      statuses: [],
    },
    cost,
  };
}

// ---- Quests -----------------------------------------------------------------

export function objectiveProgress(
  obj: QuestObjective,
  player: Player,
  prog: QuestProgress,
  i: number,
): { value: number; target: number } {
  switch (obj.kind) {
    case "kill":
      return { value: prog.counts[i] ?? 0, target: obj.target };
    case "boss":
      return { value: player.bosses.includes(obj.bossId) ? 1 : 0, target: 1 };
    case "level":
      return { value: Math.min(player.level, obj.target), target: obj.target };
    case "talk":
      return { value: player.talkedNpcs.includes(obj.npcId) ? 1 : 0, target: 1 };
  }
}

export function objectiveDone(
  obj: QuestObjective,
  player: Player,
  prog: QuestProgress,
  i: number,
): boolean {
  const { value, target } = objectiveProgress(obj, player, prog, i);
  return value >= target;
}

export function questComplete(quest: Quest, player: Player, prog: QuestProgress): boolean {
  return quest.objectives.every((o, i) => objectiveDone(o, player, prog, i));
}

export function prerequisiteMet(quest: Quest, player: Player): boolean {
  if (!quest.prerequisite) return true;
  return player.quests[quest.prerequisite]?.status === "turnedIn";
}

export type NpcQuestState = "none" | "available" | "active" | "turnin";

export function npcQuestState(
  player: Player,
  npc: Npc,
): { state: NpcQuestState; quest?: Quest } {
  if (!npc.questId) return { state: "none" };
  const quest = QUESTS[npc.questId];
  if (!quest) return { state: "none" };
  const prog = player.quests[quest.id];
  if (!prog || prog.status === "available") {
    return { state: prerequisiteMet(quest, player) ? "available" : "none", quest };
  }
  if (prog.status === "active") {
    return { state: questComplete(quest, player, prog) ? "turnin" : "active", quest };
  }
  return { state: "none", quest };
}

export function acceptQuest(player: Player, questId: string): Player {
  const quest = QUESTS[questId];
  if (!quest) return player;
  return {
    ...player,
    quests: {
      ...player.quests,
      [questId]: { status: "active", counts: quest.objectives.map(() => 0) },
    },
  };
}

export function turnInQuest(
  player: Player,
  questId: string,
): { player: Player; messages: string[] } {
  const quest = QUESTS[questId];
  const prog = player.quests[questId];
  if (!quest || !prog || prog.status !== "active" || !questComplete(quest, player, prog)) {
    return { player, messages: [] };
  }
  let p: Player = {
    ...player,
    quests: { ...player.quests, [questId]: { ...prog, status: "turnedIn" } },
  };
  const messages: string[] = [];
  const r = quest.reward;
  if (r.gold) {
    p = { ...p, gold: p.gold + r.gold };
    messages.push(`+${r.gold} Gil`);
  }
  if (r.item) {
    const qty = r.itemQty ?? 1;
    p = { ...p, inventory: { ...p.inventory, [r.item]: (p.inventory[r.item] ?? 0) + qty } };
    messages.push(`+${qty}× ${ITEMS[r.item].name}`);
  }
  if (r.xp) {
    const xpr = grantXp(p, r.xp);
    p = xpr.player;
    messages.push(...xpr.messages);
  }
  return { player: p, messages };
}

export function recordTalk(player: Player, npcId: string): Player {
  if (player.talkedNpcs.includes(npcId)) return player;
  return { ...player, talkedNpcs: [...player.talkedNpcs, npcId] };
}

export function recordVisit(player: Player, placeId: string): Player {
  if (player.visitedPlaces.includes(placeId)) return player;
  return { ...player, visitedPlaces: [...player.visitedPlaces, placeId] };
}

export function activeQuests(player: Player): { quest: Quest; prog: QuestProgress }[] {
  return Object.entries(player.quests)
    .filter(([, p]) => p.status === "active")
    .map(([id, prog]) => ({ quest: QUESTS[id], prog }))
    .filter((x) => !!x.quest);
}

export function completedQuests(player: Player): Quest[] {
  return Object.entries(player.quests)
    .filter(([, p]) => p.status === "turnedIn")
    .map(([id]) => QUESTS[id])
    .filter(Boolean);
}
