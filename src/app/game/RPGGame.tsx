"use client";

import { useEffect, useRef, useState } from "react";
import { CLASSES, ITEMS, SHOP_STOCK, ZONES } from "./content";
import {
  acceptQuest,
  advance,
  applyItem,
  applyVictory,
  arriveAt,
  attemptFlee,
  charById,
  checkEnd,
  createPlayer,
  dungeonBlockedReason,
  enemyAct,
  heroAttack,
  heroDefend,
  heroSkill,
  livingParty,
  npcQuestState,
  recordTalk,
  recordVisit,
  recruit,
  restAtInn,
  restCost,
  reviveAfterDefeat,
  skillsFor,
  startDungeonBattle,
  turnInQuest,
} from "./engine";
import { npcsAt } from "./world";
import { clearSave, hasSave, loadGame, saveGame } from "./save";
import type { BattleState, Character, ClassId, ItemId, Npc, Place, Player, Screen } from "./types";
import { Bar, Button, Panel, PartyList } from "./ui";
import Overworld from "./Overworld";
import QuestLog from "./QuestLog";
import Dialogue from "./Dialogue";
import Party from "./Party";
import Journal from "./Journal";

export default function RPGGame() {
  const [screen, setScreen] = useState<Screen>("title");
  const [prevScreen, setPrevScreen] = useState<Screen>("world");
  const [player, setPlayer] = useState<Player | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [place, setPlaceState] = useState<Place | null>(null);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [showPack, setShowPack] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saveExists, setSaveExists] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSaveExists(hasSave()), []);
  useEffect(() => {
    if (player) saveGame(player);
  }, [player]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battle?.log.length]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  // ---- Lifecycle ------------------------------------------------------------

  const continueGame = () => {
    const p = loadGame();
    if (p) {
      setPlayer(p);
      setScreen("world");
    } else {
      flash("No save found.");
      setSaveExists(false);
    }
  };

  const beginNew = () => {
    clearSave();
    setName("");
    setScreen("class");
  };

  const chooseClass = (classId: ClassId) => {
    const p = createPlayer(name, classId);
    setPlayer(p);
    setScreen("world");
    flash(`Welcome, ${p.party[0].name}. A star has fallen — seek Castle Aurelis.`);
  };

  // ---- Overworld ------------------------------------------------------------

  const handleArrive = (x: number, y: number): boolean => {
    if (!player) return true;
    const { player: np, event } = arriveAt(player, x, y);
    setPlayer(np);
    if (event.kind === "moved") return false;
    if (event.kind === "encounter") {
      setBattle(event.battle);
      setScreen("battle");
      return true;
    }
    if (event.kind !== "place") return false;
    const pl = event.place;
    if (pl.kind === "dungeon") {
      const reason = dungeonBlockedReason(np, pl);
      if (reason) {
        flash(`🕳️ ${pl.name}: ${reason}`);
        return false;
      }
      const visited = recordVisit(np, pl.id);
      setPlayer(visited);
      setBattle(startDungeonBattle(visited, pl));
      setScreen("battle");
      return true;
    }
    setPlayer(recordVisit(np, pl.id));
    setPlaceState(pl);
    setScreen("town");
    return true;
  };

  const goScreen = (s: Screen, from: Screen) => {
    setPrevScreen(from);
    setShowMenu(false);
    setScreen(s);
  };

  // ---- Town / NPC -----------------------------------------------------------

  const talkTo = (npc: Npc) => {
    if (!player) return;
    setPlayer(recordTalk(player, npc.id));
    setActiveNpc(npc);
  };

  const onAcceptQuest = (questId: string) => {
    if (!player) return;
    setPlayer(acceptQuest(player, questId));
    setActiveNpc(null);
    flash("Quest accepted! Check 📖 Story / 📜 Quests.");
  };

  const onTurnInQuest = (questId: string) => {
    if (!player) return;
    const res = turnInQuest(player, questId);
    setPlayer(res.player);
    setActiveNpc(null);
    flash(`Quest complete! ${res.messages.join(" · ")}`);
  };

  const onRecruit = (companionId: string) => {
    if (!player) return;
    const res = recruit(player, companionId);
    setActiveNpc(null);
    if (res.joined) {
      setPlayer(res.player);
      const who = res.player.party[res.player.party.length - 1];
      flash(`🎉 ${who.name} joined your party!`);
    } else {
      flash("They cannot join right now.");
    }
  };

  const buyItem = (itemId: ItemId) => {
    if (!player) return;
    const item = ITEMS[itemId];
    if (player.gold < item.price) {
      flash("Not enough Gil.");
      return;
    }
    setPlayer({
      ...player,
      gold: player.gold - item.price,
      inventory: { ...player.inventory, [itemId]: (player.inventory[itemId] ?? 0) + 1 },
    });
    flash(`Bought ${item.name}.`);
  };

  const rest = () => {
    if (!player) return;
    const res = restAtInn(player);
    if (res.player === player) {
      flash(`Need ${res.cost} Gil to rest the party.`);
      return;
    }
    setPlayer(res.player);
    flash(`The party rests. Fully restored (−${res.cost} Gil).`);
  };

  const useFieldItem = (itemId: ItemId, targetId: string) => {
    if (!player) return;
    const res = applyItem(player, itemId, targetId);
    setPlayer(res.player);
    flash(res.consumed ? res.message.charAt(0).toUpperCase() + res.message.slice(1) : res.message);
  };

  // ---- Battle ---------------------------------------------------------------

  const resolveOutcome = (p: Player, b: BattleState) => {
    if (b.outcome === "win") {
      const res = applyVictory(p, b);
      setPlayer(res.player);
      setBattle({ ...b, log: [...b.log, ...res.messages] });
      window.setTimeout(() => setScreen("victory"), 400);
    } else if (b.outcome === "lose") {
      window.setTimeout(() => setScreen("defeat"), 400);
    }
  };

  // Apply a resolved action, then either end the battle or advance the turn.
  const finishTurn = (p: Player, b: BattleState) => {
    const settled = checkEnd(p, b);
    if (settled.outcome) {
      setPlayer(p);
      setBattle(settled);
      resolveOutcome(p, settled);
      return;
    }
    const adv = advance(p, settled);
    setPlayer(adv.player);
    setBattle(adv.battle);
  };

  // Drive the enemy's turn automatically whenever it comes up.
  useEffect(() => {
    if (screen !== "battle" || !player || !battle || battle.outcome) return;
    if (battle.queue[0] !== "enemy") return;
    const id = window.setTimeout(() => {
      const res = enemyAct(player, battle);
      const settled = checkEnd(res.player, res.battle);
      if (settled.outcome) {
        setPlayer(res.player);
        setBattle(settled);
        resolveOutcome(res.player, settled);
        return;
      }
      const adv = advance(res.player, settled);
      setPlayer(adv.player);
      setBattle(adv.battle);
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, battle?.queue[0], battle?.round, battle?.outcome]);

  const actorId = battle?.queue[0] ?? null;
  const actor: Character | null =
    player && battle && actorId && actorId !== "enemy" ? charById(player, actorId) ?? null : null;

  const doAttack = () => {
    if (!player || !battle || !actor || battle.outcome) return;
    const res = heroAttack(player, battle, actor.id);
    finishTurn(res.player, res.battle);
  };
  const doDefend = () => {
    if (!player || !battle || !actor || battle.outcome) return;
    const res = heroDefend(player, battle, actor.id);
    finishTurn(res.player, res.battle);
  };
  const doSkill = (skillId: string, targetId?: string) => {
    if (!player || !battle || !actor || battle.outcome) return;
    const skill = skillsFor(actor).find((s) => s.id === skillId);
    if (!skill) return;
    if (actor.mp < skill.mpCost) {
      flash("Not enough MP!");
      return;
    }
    const res = heroSkill(player, battle, actor.id, skill, targetId);
    finishTurn(res.player, res.battle);
  };
  const doItem = (itemId: ItemId, targetId: string) => {
    if (!player || !battle || !actor || battle.outcome) return;
    const res = applyItem(player, itemId, targetId);
    if (!res.consumed) {
      flash(res.message);
      return;
    }
    finishTurn(res.player, { ...battle, log: [...battle.log, `${actor.name}: ${res.message}`] });
  };
  const doFlee = () => {
    if (!player || !battle || !actor || battle.outcome) return;
    if (attemptFlee(player, battle)) {
      flash("The party escapes!");
      setBattle(null);
      setScreen(battle.returnTo);
    } else {
      finishTurn(player, { ...battle, log: [...battle.log, "Couldn't escape!"] });
    }
  };

  const continueAfterVictory = () => {
    const back = battle?.returnTo ?? "world";
    setBattle(null);
    setScreen(back);
  };

  const revive = () => {
    if (!player) return;
    setPlayer(reviveAfterDefeat(player));
    setBattle(null);
    setPlaceState(null);
    setScreen("world");
    flash("The party awakens, battered but alive, in Rivenholde…");
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-3 pb-6 pt-4">
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="rounded-full bg-black/85 px-4 py-2 text-center text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
            {toast}
          </div>
        </div>
      )}

      {screen === "title" && (
        <TitleScreen saveExists={saveExists} onNew={beginNew} onContinue={continueGame} />
      )}

      {screen === "class" && (
        <ClassScreen name={name} setName={setName} onChoose={chooseClass} onBack={() => setScreen("title")} />
      )}

      {screen === "world" && player && (
        <Overworld
          player={player}
          onArrive={handleArrive}
          onOpenMenu={() => setShowMenu(true)}
          onOpenPack={() => setShowPack(true)}
        />
      )}

      {screen === "town" && player && place && (
        <TownScreen
          player={player}
          place={place}
          onTalk={talkTo}
          onRest={rest}
          onBuy={buyItem}
          onOpenMenu={() => setShowMenu(true)}
          onLeave={() => setScreen("world")}
        />
      )}

      {screen === "quests" && player && <QuestLog player={player} onBack={() => setScreen(prevScreen)} />}
      {screen === "party" && player && <Party player={player} onBack={() => setScreen(prevScreen)} />}
      {screen === "journal" && player && <Journal player={player} onBack={() => setScreen(prevScreen)} />}

      {screen === "battle" && player && battle && (
        <BattleScreen
          player={player}
          battle={battle}
          actor={actor}
          logRef={logRef}
          onAttack={doAttack}
          onDefend={doDefend}
          onSkill={doSkill}
          onItem={doItem}
          onFlee={doFlee}
        />
      )}

      {screen === "victory" && player && battle && (
        <ResultScreen kind="victory" battle={battle} onContinue={continueAfterVictory} />
      )}
      {screen === "defeat" && player && battle && (
        <ResultScreen kind="defeat" battle={battle} onContinue={revive} />
      )}

      {/* Overlays */}
      {activeNpc && player && (
        <Dialogue
          npc={activeNpc}
          player={player}
          onAccept={onAcceptQuest}
          onTurnIn={onTurnInQuest}
          onRecruit={onRecruit}
          onClose={() => setActiveNpc(null)}
        />
      )}

      {showPack && player && (
        <PackMenu player={player} onUse={useFieldItem} onClose={() => setShowPack(false)} />
      )}

      {showMenu && player && (
        <MenuOverlay
          onQuests={() => goScreen("quests", screen)}
          onParty={() => goScreen("party", screen)}
          onStory={() => goScreen("journal", screen)}
          onPack={() => {
            setShowMenu(false);
            setShowPack(true);
          }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Screens & overlays
// ----------------------------------------------------------------------------

function TitleScreen({
  saveExists,
  onNew,
  onContinue,
}: {
  saveExists: boolean;
  onNew: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div>
        <div className="mb-3 text-6xl">🗡️✨</div>
        <h1 className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Aether Wilds
        </h1>
        <p className="mt-2 text-sm text-muted">A party-based tale of fallen stars and corrupted Wardens.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        {saveExists && (
          <Button variant="primary" onClick={onContinue}>
            Continue Journey
          </Button>
        )}
        <Button variant={saveExists ? "default" : "primary"} onClick={onNew}>
          New Game
        </Button>
      </div>
      <p className="text-xs text-muted/70">Recruit up to four heroes · progress saves to this device.</p>
    </div>
  );
}

function ClassScreen({
  name,
  setName,
  onChoose,
  onBack,
}: {
  name: string;
  setName: (v: string) => void;
  onChoose: (c: ClassId) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <button onClick={onBack} className="self-start text-sm text-muted">
        ← Back
      </button>
      <h2 className="text-2xl font-bold">Create your hero</h2>
      <p className="-mt-2 text-xs text-muted">You'll gather companions as your story unfolds.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        placeholder="Name your hero"
        className="w-full rounded-xl bg-panel2 px-4 py-3 text-white outline-none ring-1 ring-line placeholder:text-muted/60 focus:ring-brand"
      />
      <div className="flex flex-col gap-3">
        {(Object.keys(CLASSES) as ClassId[]).map((id) => {
          const c = CLASSES[id];
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className="flex items-center gap-4 rounded-2xl bg-panel p-4 text-left ring-1 ring-line transition active:scale-[0.98] hover:bg-panel2"
            >
              <span className="text-4xl">{c.sprite}</span>
              <span className="flex-1">
                <span className="block text-lg font-bold">{c.name}</span>
                <span className="block text-xs text-muted">{c.blurb}</span>
                <span className="mt-1 block text-[11px] text-muted/80">
                  HP {c.base.maxHp} · MP {c.base.maxMp} · ATK {c.base.atk} · DEF {c.base.def} · MAG{" "}
                  {c.base.mag} · SPD {c.base.spd}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TownScreen({
  player,
  place,
  onTalk,
  onRest,
  onBuy,
  onOpenMenu,
  onLeave,
}: {
  player: Player;
  place: Place;
  onTalk: (npc: Npc) => void;
  onRest: () => void;
  onBuy: (id: ItemId) => void;
  onOpenMenu: () => void;
  onLeave: () => void;
}) {
  const cost = restCost(player);
  const npcs = npcsAt(place.id);
  const hasInn = place.kind !== "dungeon";
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-4 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {place.kind === "castle" ? "🏰 " : "🏘️ "}
            {place.name}
          </h2>
          <Button variant="ghost" onClick={onLeave} className="!px-3 !py-2 text-xs">
            ← Leave
          </Button>
        </div>
        {place.intro && <p className="mt-1 text-xs text-white/70">{place.intro}</p>}
      </div>

      <PartyList player={player} />

      <Panel>
        <h3 className="mb-2 text-sm font-bold text-muted">🧑 Townsfolk</h3>
        <div className="flex flex-col gap-2">
          {npcs.map((npc) => {
            const { state } = npcQuestState(player, npc);
            const badge =
              npc.recruit && !player.recruited.includes(npc.recruit)
                ? "✨"
                : state === "available"
                  ? "❗"
                  : state === "turnin"
                    ? "✅"
                    : state === "active"
                      ? "…"
                      : "";
            return (
              <button
                key={npc.id}
                onClick={() => onTalk(npc)}
                className="flex items-center gap-3 rounded-xl bg-panel2 px-3 py-2.5 text-left ring-1 ring-line transition active:scale-[0.99] hover:bg-line"
              >
                <span className="text-2xl">{npc.sprite}</span>
                <span className="flex-1 text-sm font-medium">{npc.name}</span>
                {badge && <span className="text-lg">{badge}</span>}
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        {hasInn && <Button onClick={onRest}>🛏️ Inn ({cost} Gil)</Button>}
        <Button variant="primary" onClick={onOpenMenu} className={hasInn ? "" : "col-span-2"}>
          ☰ Menu
        </Button>
      </div>

      <Panel>
        <h3 className="mb-2 text-sm font-bold text-muted">🛒 Shop</h3>
        <div className="flex flex-col gap-2">
          {SHOP_STOCK.map((id) => {
            const item = ITEMS[id];
            const owned = player.inventory[id] ?? 0;
            return (
              <div key={id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {item.name} <span className="text-muted">×{owned}</span>
                  </div>
                  <div className="text-[11px] text-muted">{item.desc}</div>
                </div>
                <button
                  disabled={player.gold < item.price}
                  onClick={() => onBuy(id)}
                  className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
                >
                  {item.price}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function BattleScreen({
  player,
  battle,
  actor,
  logRef,
  onAttack,
  onDefend,
  onSkill,
  onItem,
  onFlee,
}: {
  player: Player;
  battle: BattleState;
  actor: Character | null; // the party member whose turn it is (null on enemy turn)
  logRef: React.RefObject<HTMLDivElement>;
  onAttack: () => void;
  onDefend: () => void;
  onSkill: (id: string, targetId?: string) => void;
  onItem: (id: ItemId, targetId: string) => void;
  onFlee: () => void;
}) {
  const [menu, setMenu] = useState<"main" | "skill" | "item" | "target">("main");
  const [pending, setPending] = useState<{ kind: "skill"; skillId: string } | { kind: "item"; itemId: ItemId } | null>(
    null,
  );
  const zone = ZONES[battle.zoneIndex];
  const enemyTurn = battle.queue[0] === "enemy";
  const skills = actor ? skillsFor(actor) : [];
  const packItems = SHOP_STOCK.filter(
    (id) => (ITEMS[id].effect.hp || ITEMS[id].effect.mp || ITEMS[id].effect.revive) && (player.inventory[id] ?? 0) > 0,
  );
  const canAct = !!actor && !enemyTurn && !battle.outcome;

  // Reset the menu whenever the acting member changes.
  const activeId = actor?.id ?? "enemy";
  const lastActive = useRef(activeId);
  if (lastActive.current !== activeId) {
    lastActive.current = activeId;
    if (menu !== "main") setMenu("main");
    if (pending) setPending(null);
  }

  const targetList = (() => {
    if (!pending) return [];
    if (pending.kind === "item" && ITEMS[pending.itemId].effect.revive) {
      return player.party.filter((c) => c.hp <= 0);
    }
    return livingParty(player);
  })();

  const chooseTarget = (id: string) => {
    if (!pending) return;
    if (pending.kind === "skill") onSkill(pending.skillId, id);
    else onItem(pending.itemId, id);
    setPending(null);
    setMenu("main");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col gap-3">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${zone.bg} p-4 pt-6 ring-1 ring-line`}>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white/90">
            {battle.enemy.name}
            {battle.isBoss && " 👑"}
          </div>
          <div className="mt-1 w-44 max-w-full">
            <Bar
              value={battle.enemy.hp}
              max={battle.enemy.maxHp}
              color="bg-gradient-to-r from-red-500 to-orange-400"
              label="Enemy HP"
            />
          </div>
        </div>
        <div className="my-4 flex justify-center">
          <span className={`text-7xl drop-shadow-lg ${enemyTurn ? "animate-bounce" : ""}`}>
            {battle.enemy.sprite}
          </span>
        </div>
        <div className="text-center text-[11px] text-white/70">
          {enemyTurn ? `${battle.enemy.name} is acting…` : actor ? `▶ ${actor.name}'s turn` : ""} · Round {battle.round}
        </div>
      </div>

      <div
        ref={logRef}
        className="scroll-thin h-20 overflow-y-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-slate-200 ring-1 ring-line"
      >
        {battle.log.slice(-30).map((line, i) => (
          <div key={i} className="mb-0.5">
            {line}
          </div>
        ))}
      </div>

      <PartyList player={player} activeId={enemyTurn ? null : actor?.id} />

      <div className="mt-auto">
        {menu === "main" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={onAttack} disabled={!canAct}>
              ⚔️ Attack
            </Button>
            <Button onClick={() => setMenu("skill")} disabled={!canAct || skills.length === 0}>
              ✨ Skill
            </Button>
            <Button onClick={() => setMenu("item")} disabled={!canAct || packItems.length === 0}>
              🎒 Item
            </Button>
            <Button onClick={onDefend} disabled={!canAct}>
              🛡️ Defend
            </Button>
            <Button variant="ghost" onClick={onFlee} disabled={!canAct || battle.isBoss} className="col-span-2">
              {battle.isBoss ? "🚫 Can't flee a boss" : "🏃 Flee"}
            </Button>
          </div>
        )}

        {menu === "skill" && actor && (
          <div className="flex flex-col gap-2">
            {skills.map((s) => (
              <button
                key={s.id}
                disabled={!canAct || actor.mp < s.mpCost}
                onClick={() => {
                  if (s.kind === "heal") {
                    setPending({ kind: "skill", skillId: s.id });
                    setMenu("target");
                  } else {
                    onSkill(s.id);
                    setMenu("main");
                  }
                }}
                className="flex items-center justify-between rounded-xl bg-panel2 px-4 py-3 text-left text-sm ring-1 ring-line disabled:opacity-40"
              >
                <span>
                  <span className="font-semibold">{s.name}</span>
                  <span className="block text-[11px] text-muted">{s.desc}</span>
                </span>
                <span className="shrink-0 text-xs text-cyan-300">{s.mpCost} MP</span>
              </button>
            ))}
            <Button variant="ghost" onClick={() => setMenu("main")}>
              ← Back
            </Button>
          </div>
        )}

        {menu === "item" && (
          <div className="flex flex-col gap-2">
            {packItems.map((id) => (
              <button
                key={id}
                disabled={!canAct}
                onClick={() => {
                  setPending({ kind: "item", itemId: id });
                  setMenu("target");
                }}
                className="flex items-center justify-between rounded-xl bg-panel2 px-4 py-3 text-left text-sm ring-1 ring-line disabled:opacity-40"
              >
                <span>
                  <span className="font-semibold">{ITEMS[id].name}</span>
                  <span className="block text-[11px] text-muted">{ITEMS[id].desc}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">×{player.inventory[id]}</span>
              </button>
            ))}
            <Button variant="ghost" onClick={() => setMenu("main")}>
              ← Back
            </Button>
          </div>
        )}

        {menu === "target" && (
          <div className="flex flex-col gap-2">
            <div className="px-1 text-[11px] text-muted">
              {pending?.kind === "item" && ITEMS[pending.itemId].effect.revive
                ? "Revive whom?"
                : "Use on whom?"}
            </div>
            {targetList.length === 0 && (
              <div className="rounded-xl bg-panel2 px-4 py-3 text-sm text-muted ring-1 ring-line">
                No valid target.
              </div>
            )}
            {targetList.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseTarget(c.id)}
                className="flex items-center justify-between rounded-xl bg-panel2 px-4 py-3 text-left text-sm ring-1 ring-line"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">{c.sprite}</span>
                  <span className="font-semibold">{c.name}</span>
                </span>
                <span className="text-[11px] text-muted">
                  {c.hp <= 0 ? "KO" : `${Math.round(c.hp)}/${c.stats.maxHp} HP`}
                </span>
              </button>
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setMenu("main");
              }}
            >
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PackMenu({
  player,
  onUse,
  onClose,
}: {
  player: Player;
  onUse: (id: ItemId, targetId: string) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<ItemId | null>(null);
  const items = SHOP_STOCK.filter((id) => (player.inventory[id] ?? 0) > 0);
  const usable = (id: ItemId) => ITEMS[id].effect.hp || ITEMS[id].effect.mp || ITEMS[id].effect.revive;
  const targets = pending
    ? ITEMS[pending].effect.revive
      ? player.party.filter((c) => c.hp <= 0)
      : player.party.filter((c) => c.hp > 0)
    : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-panel p-4 ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">🎒 Pack</h3>
          <span className="text-xs text-muted">🪙 {player.gold} Gil</span>
        </div>

        {!pending && (
          <div className="flex flex-col gap-2">
            {items.length === 0 && <p className="text-sm text-muted">Your pack is empty.</p>}
            {items.map((id) => (
              <div key={id} className="flex items-center gap-2 rounded-xl bg-panel2 px-3 py-2 ring-1 ring-line">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {ITEMS[id].name} <span className="text-muted">×{player.inventory[id]}</span>
                  </div>
                  <div className="text-[11px] text-muted">{ITEMS[id].desc}</div>
                </div>
                {usable(id) && (
                  <button
                    onClick={() => setPending(id)}
                    className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Use
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {pending && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-muted">
              {ITEMS[pending].effect.revive ? "Revive whom?" : `Use ${ITEMS[pending].name} on whom?`}
            </div>
            {targets.length === 0 && <p className="text-sm text-muted">No valid target.</p>}
            {targets.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onUse(pending, c.id);
                  setPending(null);
                }}
                className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-2 text-left text-sm ring-1 ring-line"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">{c.sprite}</span>
                  <span className="font-semibold">{c.name}</span>
                </span>
                <span className="text-[11px] text-muted">
                  {c.hp <= 0 ? "KO" : `${Math.round(c.hp)}/${c.stats.maxHp} HP`}
                </span>
              </button>
            ))}
            <Button variant="ghost" onClick={() => setPending(null)}>
              ← Back
            </Button>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function MenuOverlay({
  onQuests,
  onParty,
  onStory,
  onPack,
  onClose,
}: {
  onQuests: () => void;
  onParty: () => void;
  onStory: () => void;
  onPack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-panel p-4 ring-1 ring-line">
        <h3 className="mb-3 font-bold">☰ Menu</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={onStory}>
            📖 Story
          </Button>
          <Button onClick={onQuests}>📜 Quests</Button>
          <Button onClick={onParty}>🛡️ Party</Button>
          <Button onClick={onPack}>🎒 Pack</Button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  kind,
  battle,
  onContinue,
}: {
  kind: "victory" | "defeat";
  battle: BattleState;
  onContinue: () => void;
}) {
  const win = kind === "victory";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="text-7xl">{win ? "🎉" : "💀"}</div>
      <h2 className={`text-3xl font-black ${win ? "text-emerald-300" : "text-rose-400"}`}>
        {win ? "Victory!" : "The party falls..."}
      </h2>
      <Panel className="w-full max-w-xs text-left">
        <div className="max-h-40 overflow-y-auto text-xs leading-relaxed text-slate-200">
          {battle.log.slice(-14).map((line, i) => (
            <div key={i} className="mb-0.5">
              {line}
            </div>
          ))}
        </div>
      </Panel>
      <Button variant="primary" onClick={onContinue} className="w-full max-w-xs">
        {win ? "Continue" : "Awaken in Rivenholde"}
      </Button>
    </div>
  );
}
