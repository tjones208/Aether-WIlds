// Pure game logic: characters & party, stat scaling, party-based combat, world
// movement, recruitment, and quest progression. The React layer stays thin — it
// renders state and calls these functions, which return fresh state.

import { CLASSES, ENEMIES, ITEMS, SKILLS, ZONES } from "./content";
import { QUESTS } from "./quests";
import { COMPANIONS } from "./story";
import { SPAWN, encounterChance, placeAt, regionForPos } from "./world";
import type {
  BattleState,
  Character,
  ClassId,
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
import { MAX_PARTY } from "./types";

// ---- RNG --------------------------------------------------------------------

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

export function makeCharacter(
  id: string,
  name: string,
  classId: ClassId,
  sprite: string,
  level: number,
): Character {
  const stats = statsForLevel(classId, level);
  const skills = SKILLS.filter((s) => s.classes.includes(classId) && s.learnAtLevel <= level).map(
    (s) => s.id,
  );
  return {
    id,
    name,
    classId,
    sprite,
    level,
    xp: 0,
    xpToNext: xpForLevel(level + 1),
    hp: stats.maxHp,
    mp: stats.maxMp,
    stats,
    skills,
    statuses: [],
  };
}

export function createPlayer(name: string, classId: ClassId): Player {
  const hero = makeCharacter("hero", name.trim() || "Wanderer", classId, CLASSES[classId].sprite, 1);
  return {
    party: [hero],
    gold: 30,
    inventory: { potion: 3, hi_potion: 0, ether: 1, phoenix: 0 },
    battlesWon: 0,
    pos: { ...SPAWN },
    quests: {},
    bosses: [],
    talkedNpcs: [],
    visitedPlaces: [],
    recruited: [],
    steps: 0,
  };
}

export function leader(player: Player): Character {
  return player.party[0];
}

export function skillsFor(char: Character): Skill[] {
  return SKILLS.filter((s) => char.skills.includes(s.id));
}

export function livingParty(player: Player): Character[] {
  return player.party.filter((c) => c.hp > 0);
}

export function charById(player: Player, id: string): Character | undefined {
  return player.party.find((c) => c.id === id);
}

// ---- XP & leveling ----------------------------------------------------------

function grantXpChar(char: Character, amount: number): { char: Character; messages: string[] } {
  const messages: string[] = [];
  let c: Character = { ...char, xp: char.xp + amount };
  while (c.xp >= c.xpToNext) {
    c.xp -= c.xpToNext;
    const level = c.level + 1;
    const stats = statsForLevel(c.classId, level);
    c = { ...c, level, stats, hp: stats.maxHp, mp: stats.maxMp, xpToNext: xpForLevel(level + 1) };
    messages.push(`⭐ ${c.name} reached level ${level}!`);
    const learned = SKILLS.filter(
      (s) => s.classes.includes(c.classId) && s.learnAtLevel === level && !c.skills.includes(s.id),
    );
    for (const s of learned) {
      c.skills = [...c.skills, s.id];
      messages.push(`✨ ${c.name} learned ${s.name}!`);
    }
  }
  return { char: c, messages };
}

// XP goes to every living member (downed members earn nothing — revive them!).
export function grantPartyXp(player: Player, amount: number): { player: Player; messages: string[] } {
  const messages: string[] = [];
  if (amount > 0) messages.push(`The party gains ${amount} XP.`);
  const party = player.party.map((c) => {
    if (c.hp <= 0) return c;
    const r = grantXpChar(c, amount);
    messages.push(...r.messages);
    return r.char;
  });
  return { player: { ...player, party }, messages };
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

// ---- Turn order -------------------------------------------------------------

function buildQueue(player: Player, enemy: Enemy): string[] {
  const c: { id: string; spd: number }[] = [];
  for (const m of player.party) if (m.hp > 0) c.push({ id: m.id, spd: m.stats.spd });
  if (enemy.hp > 0) c.push({ id: "enemy", spd: enemy.spd });
  c.sort((a, b) => b.spd - a.spd || (a.id < b.id ? -1 : 1));
  return c.map((x) => x.id);
}

export function startBattle(
  player: Player,
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
    queue: buildQueue(player, enemy),
    round: 1,
    log: [opts.boss ? `A boss appears — ${enemy.name}!` : `A wild ${enemy.name} appears!`],
    rewardXp: enemy.xp,
    rewardGold: enemy.gold,
    outcome: null,
    returnTo: opts.returnTo ?? "world",
  };
}

export function startDungeonBattle(player: Player, place: Place): BattleState {
  return startBattle(player, place.regionIndex, { boss: true, returnTo: "world" });
}

export function activeId(battle: BattleState): string {
  return battle.queue[0];
}

// The active party member, or null when it's the enemy's turn.
export function activeChar(player: Player, battle: BattleState): Character | null {
  const id = battle.queue[0];
  if (id === "enemy") return null;
  return player.party.find((c) => c.id === id && c.hp > 0) ?? null;
}

// ---- World movement ---------------------------------------------------------

export type MoveEvent =
  | { kind: "blocked" }
  | { kind: "moved" }
  | { kind: "encounter"; battle: BattleState }
  | { kind: "place"; place: Place };

// The overworld renderer animates the walk and calls this on each tile arrival.
export function arriveAt(player: Player, x: number, y: number): { player: Player; event: MoveEvent } {
  const p: Player = { ...player, pos: { x, y }, steps: player.steps + 1 };
  const place = placeAt(x, y);
  if (place) return { player: p, event: { kind: "place", place } };
  if (chance(encounterChance(x, y))) {
    const region = regionForPos(p.pos);
    return { player: p, event: { kind: "encounter", battle: startBattle(p, region, { returnTo: "world" }) } };
  }
  return { player: p, event: { kind: "moved" } };
}

export function dungeonBlockedReason(player: Player, place: Place): string | null {
  if (place.requiresBoss && !player.bosses.includes(place.requiresBoss)) {
    return `The way is sealed. First defeat ${ENEMIES[place.requiresBoss].name}.`;
  }
  return null;
}

// ---- Combat math ------------------------------------------------------------

function effDef(base: number, statuses: { kind: string; amount?: number }[]) {
  let def = base;
  for (const s of statuses) {
    if (s.kind === "defend") def += Math.round(base * 0.6) + 2;
    if (s.kind === "defup") def += s.amount ?? 0;
  }
  return def;
}

function effAtk(base: number, statuses: { kind: string; amount?: number }[]) {
  let atk = base;
  for (const s of statuses) if (s.kind === "atkup") atk += s.amount ?? 0;
  return atk;
}

function computeHit(power: number, targetDef: number, spd: number, variance = 0.2) {
  const crit = chance(Math.min(0.05 + spd * 0.01, 0.35));
  let dmg = Math.max(1, power - targetDef * 0.5);
  const v = 1 - variance + rng() * (variance * 2);
  dmg = Math.round(dmg * v * (crit ? 1.7 : 1));
  return { dmg: Math.max(1, dmg), crit };
}

function replaceChar(player: Player, char: Character): Player {
  return { ...player, party: player.party.map((c) => (c.id === char.id ? char : c)) };
}

export type BattleTurn = { player: Player; battle: BattleState };

export function heroAttack(player: Player, battle: BattleState, actorId: string): BattleTurn {
  const actor = charById(player, actorId)!;
  const enemy = { ...battle.enemy };
  const { dmg, crit } = computeHit(
    effAtk(actor.stats.atk, actor.statuses) * 1.5,
    effDef(enemy.def, enemy.statuses),
    actor.stats.spd,
  );
  enemy.hp = Math.max(0, enemy.hp - dmg);
  return {
    player,
    battle: {
      ...battle,
      enemy,
      log: [...battle.log, `${actor.name} strikes ${enemy.name} for ${dmg}${crit ? " (CRIT!)" : ""}.`],
    },
  };
}

export function heroDefend(player: Player, battle: BattleState, actorId: string): BattleTurn {
  const actor = charById(player, actorId)!;
  const updated: Character = {
    ...actor,
    statuses: [...actor.statuses.filter((s) => s.kind !== "defend"), { kind: "defend", turns: 1 }],
  };
  return {
    player: replaceChar(player, updated),
    battle: { ...battle, log: [...battle.log, `${actor.name} takes a defensive stance.`] },
  };
}

export function heroSkill(
  player: Player,
  battle: BattleState,
  actorId: string,
  skill: Skill,
  targetId?: string,
): BattleTurn {
  const actor = charById(player, actorId)!;
  if (actor.mp < skill.mpCost) {
    return { player, battle: { ...battle, log: [...battle.log, "Not enough MP!"] } };
  }
  let p = player;
  let actorC: Character = { ...actor, mp: actor.mp - skill.mpCost };
  let enemy = { ...battle.enemy };
  const log = [...battle.log];

  if (skill.kind === "attack") {
    const { dmg, crit } = computeHit(
      actorC.stats.mag * skill.power + actorC.stats.atk * 0.4,
      effDef(enemy.def, enemy.statuses),
      actorC.stats.spd,
    );
    enemy.hp = Math.max(0, enemy.hp - dmg);
    log.push(`${actorC.name}'s ${skill.name} hits ${enemy.name} for ${dmg}${crit ? " (CRIT!)" : ""}!`);
    p = replaceChar(p, actorC);
  } else if (skill.kind === "heal") {
    const target = charById(p, targetId ?? actorId) ?? actorC;
    const heal = Math.round(actorC.stats.mag * skill.power + 6);
    const healed: Character = { ...target, hp: Math.min(target.stats.maxHp, target.hp + heal) };
    log.push(`${actorC.name}'s ${skill.name} restores ${healed.hp - target.hp} HP to ${target.name}.`);
    p = replaceChar(p, actorC);
    p = replaceChar(p, healed);
  } else if (skill.kind === "buff" && skill.buff) {
    const kind = skill.buff.stat === "def" ? ("defup" as const) : ("atkup" as const);
    actorC = {
      ...actorC,
      statuses: [
        ...actorC.statuses.filter((s) => s.kind !== kind),
        { kind, turns: skill.buff.turns, amount: skill.buff.amount },
      ],
    };
    log.push(`${actorC.name} uses ${skill.name} — ${skill.buff.stat.toUpperCase()} rises.`);
    p = replaceChar(p, actorC);
  }

  return { player: p, battle: { ...battle, enemy, log } };
}

export function heroItem(
  player: Player,
  battle: BattleState,
  actorId: string,
  itemId: ItemId,
  targetId: string,
): BattleTurn {
  const res = applyItem(player, itemId, targetId);
  const actor = charById(player, actorId)!;
  return {
    player: res.player,
    battle: { ...battle, log: [...battle.log, `${actor.name}: ${res.message}`] },
  };
}

// Shared item application (used in battle and in the field).
export function applyItem(
  player: Player,
  itemId: ItemId,
  targetId: string,
): { player: Player; message: string; consumed: boolean } {
  if ((player.inventory[itemId] ?? 0) <= 0) {
    return { player, message: "None left.", consumed: false };
  }
  const item = ITEMS[itemId];
  const target = charById(player, targetId);
  if (!target) return { player, message: "No target.", consumed: false };

  if (item.effect.revive) {
    if (target.hp > 0) return { player, message: `${target.name} is not down.`, consumed: false };
    const revived: Character = { ...target, hp: Math.round(target.stats.maxHp / 2), statuses: [] };
    return {
      player: consume(replaceChar(player, revived), itemId),
      message: `revived ${target.name}!`,
      consumed: true,
    };
  }
  if (target.hp <= 0) return { player, message: `${target.name} is down.`, consumed: false };

  let t = target;
  let msg = `used ${item.name}`;
  if (item.effect.hp) {
    const before = t.hp;
    t = { ...t, hp: Math.min(t.stats.maxHp, t.hp + item.effect.hp) };
    msg = `restored ${t.hp - before} HP to ${t.name}`;
  }
  if (item.effect.mp) {
    const before = t.mp;
    t = { ...t, mp: Math.min(t.stats.maxMp, t.mp + item.effect.mp) };
    msg = `restored ${t.mp - before} MP to ${t.name}`;
  }
  return { player: consume(replaceChar(player, t), itemId), message: msg, consumed: true };
}

function consume(player: Player, itemId: ItemId): Player {
  return { ...player, inventory: { ...player.inventory, [itemId]: player.inventory[itemId] - 1 } };
}

// ---- Enemy turn -------------------------------------------------------------

export function enemyAct(player: Player, battle: BattleState): BattleTurn {
  const living = livingParty(player);
  if (living.length === 0) return { player, battle };
  // Prefer a weakened target now and then; otherwise pick at random.
  const target = chance(0.4)
    ? [...living].sort((a, b) => a.hp - b.hp)[0]
    : pick(living);
  const enemy = battle.enemy;

  const usesMagic = enemy.mag > enemy.atk && chance(0.6);
  const power = usesMagic ? enemy.mag * 1.7 : enemy.atk * 1.5;
  const { dmg, crit } = computeHit(power, effDef(target.stats.def, target.statuses), enemy.spd);
  const hurt: Character = { ...target, hp: Math.max(0, target.hp - dmg) };
  const log = [
    ...battle.log,
    `${enemy.name} ${usesMagic ? "blasts" : "strikes"} ${target.name} for ${dmg}${crit ? " (CRIT!)" : ""}.`,
  ];
  if (hurt.hp <= 0) log.push(`💫 ${target.name} is knocked out!`);
  return { player: replaceChar(player, hurt), battle: { ...battle, log } };
}

// ---- Turn / round advancement ----------------------------------------------

function tickStatuses(player: Player): Player {
  return {
    ...player,
    party: player.party.map((c) => ({
      ...c,
      statuses: c.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0),
    })),
  };
}

// Advance to the next actor, skipping the downed and rolling into a fresh round
// (which ticks buffs) when the queue empties.
export function advance(player: Player, battle: BattleState): BattleTurn {
  let p = player;
  let q = battle.queue.slice(1);
  const dead = (id: string) =>
    id === "enemy" ? battle.enemy.hp <= 0 : (charById(p, id)?.hp ?? 0) <= 0;
  while (q.length && dead(q[0])) q = q.slice(1);
  let round = battle.round;
  if (q.length === 0) {
    p = tickStatuses(p);
    q = buildQueue(p, battle.enemy);
    round += 1;
  }
  return { player: p, battle: { ...battle, queue: q, round } };
}

export function checkEnd(player: Player, battle: BattleState): BattleState {
  if (battle.enemy.hp <= 0) return { ...battle, outcome: "win" };
  if (livingParty(player).length === 0) return { ...battle, outcome: "lose" };
  return battle;
}

export function attemptFlee(player: Player, battle: BattleState): boolean {
  if (battle.isBoss) return false;
  const fastest = Math.max(...livingParty(player).map((c) => c.stats.spd), 0);
  return chance(Math.min(0.9, 0.4 + (fastest - battle.enemy.spd) * 0.05));
}

// ---- Post-battle ------------------------------------------------------------

export function applyVictory(player: Player, battle: BattleState): { player: Player; messages: string[] } {
  let p: Player = {
    ...player,
    gold: player.gold + battle.rewardGold,
    battlesWon: player.battlesWon + 1,
    // Clear combat statuses on everyone.
    party: player.party.map((c) => ({ ...c, statuses: [] })),
  };
  const messages = [`Victory! +${battle.rewardGold} Gil.`];
  const enemy = battle.enemy;

  if (enemy.isBoss && !p.bosses.includes(enemy.id)) p = { ...p, bosses: [...p.bosses, enemy.id] };

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

  const xpr = grantPartyXp(p, battle.rewardXp);
  p = xpr.player;
  messages.push(...xpr.messages);
  return { player: p, messages };
}

// A wipe sends the party back to Rivenholde, revived at half strength.
export function reviveAfterDefeat(player: Player): Player {
  const spot = placeAt(9, 13) ? { x: 9, y: 12 } : player.pos;
  return {
    ...player,
    pos: spot,
    party: player.party.map((c) => ({
      ...c,
      hp: Math.max(1, Math.round(c.stats.maxHp / 2)),
      mp: Math.round(c.stats.maxMp / 2),
      statuses: [],
    })),
  };
}

export function restCost(player: Player): number {
  return 12 + leader(player).level * 6 + (player.party.length - 1) * 8;
}

export function restAtInn(player: Player): { player: Player; cost: number } {
  const cost = restCost(player);
  if (player.gold < cost) return { player, cost };
  return {
    player: {
      ...player,
      gold: player.gold - cost,
      party: player.party.map((c) => ({ ...c, hp: c.stats.maxHp, mp: c.stats.maxMp, statuses: [] })),
    },
    cost,
  };
}

// ---- Recruitment ------------------------------------------------------------

export type NpcRecruitState = "none" | "available" | "joined" | "locked" | "full";

export function npcRecruitState(player: Player, npc: Npc): NpcRecruitState {
  if (!npc.recruit) return "none";
  if (player.recruited.includes(npc.recruit)) return "joined";
  if (npc.recruitReqBoss && !player.bosses.includes(npc.recruitReqBoss)) return "locked";
  if (player.party.length >= MAX_PARTY) return "full";
  return "available";
}

export function recruit(player: Player, companionId: string): { player: Player; joined: boolean } {
  const comp = COMPANIONS[companionId];
  if (!comp || player.recruited.includes(companionId) || player.party.length >= MAX_PARTY) {
    return { player, joined: false };
  }
  const level = leader(player).level;
  const member = makeCharacter(comp.id, comp.name, comp.classId, comp.sprite, level);
  return {
    player: { ...player, party: [...player.party, member], recruited: [...player.recruited, companionId] },
    joined: true,
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
      return { value: Math.min(leader(player).level, obj.target), target: obj.target };
    case "talk":
      return { value: player.talkedNpcs.includes(obj.npcId) ? 1 : 0, target: 1 };
  }
}

export function objectiveDone(obj: QuestObjective, player: Player, prog: QuestProgress, i: number): boolean {
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

export function npcQuestState(player: Player, npc: Npc): { state: NpcQuestState; quest?: Quest } {
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
    quests: { ...player.quests, [questId]: { status: "active", counts: quest.objectives.map(() => 0) } },
  };
}

export function turnInQuest(player: Player, questId: string): { player: Player; messages: string[] } {
  const quest = QUESTS[questId];
  const prog = player.quests[questId];
  if (!quest || !prog || prog.status !== "active" || !questComplete(quest, player, prog)) {
    return { player, messages: [] };
  }
  let p: Player = { ...player, quests: { ...player.quests, [questId]: { ...prog, status: "turnedIn" } } };
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
    const xpr = grantPartyXp(p, r.xp);
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
