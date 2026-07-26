"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLASSES, ITEMS, SHOP_STOCK, ZONES } from "./content";
import {
  acceptQuest,
  applyVictory,
  attemptFlee,
  checkBattleEnd,
  createPlayer,
  dungeonBlockedReason,
  arriveAt,
  enemyIsFaster,
  enemyTurn,
  npcQuestState,
  playerAttack,
  playerDefend,
  playerSkill,
  recordTalk,
  recordVisit,
  restAtInn,
  skillsFor,
  startDungeonBattle,
  turnInQuest,
  useItem,
} from "./engine";
import { getPlace, npcsAt } from "./world";
import { clearSave, hasSave, loadGame, saveGame } from "./save";
import type { BattleState, ClassId, ItemId, Npc, Place, Player, Screen } from "./types";
import { Bar, Button, Panel, StatHeader } from "./ui";
import Overworld from "./Overworld";
import QuestLog from "./QuestLog";
import Dialogue from "./Dialogue";

export default function RPGGame() {
  const [screen, setScreen] = useState<Screen>("title");
  const [prevScreen, setPrevScreen] = useState<Screen>("world");
  const [player, setPlayer] = useState<Player | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [place, setPlaceState] = useState<Place | null>(null);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saveExists, setSaveExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSaveExists(hasSave()), []);
  useEffect(() => {
    if (player) saveGame(player);
  }, [player]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battle?.log.length]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

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
    flash(`Welcome, ${p.name} the ${CLASSES[classId].name}! Seek Castle Aurelis.`);
  };

  // ---- Overworld ------------------------------------------------------------

  // Called by the overworld once the hero settles onto a tile. Returns true when
  // it changes screens (encounter / entering a place) so movement stops.
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
        return false; // stay on the map; you can keep walking
      }
      setPlayer(recordVisit(np, pl.id));
      setBattle(startDungeonBattle(pl));
      setScreen("battle");
      return true;
    }
    setPlayer(recordVisit(np, pl.id));
    setPlaceState(pl);
    setScreen("town");
    return true;
  };

  const openQuests = (from: Screen) => {
    setPrevScreen(from);
    setScreen("quests");
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
    flash("Quest accepted! Check your Quest Log (📜).");
  };

  const onTurnInQuest = (questId: string) => {
    if (!player) return;
    const res = turnInQuest(player, questId);
    setPlayer(res.player);
    setActiveNpc(null);
    flash(`Quest complete! ${res.messages.join(" · ")}`);
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
      flash(`Need ${res.cost} Gil to rest.`);
      return;
    }
    setPlayer(res.player);
    flash(`Rested at the inn. Fully restored (−${res.cost} Gil).`);
  };

  const useFieldItem = (itemId: ItemId) => {
    if (!player) return;
    const res = useItem(player, null, itemId);
    if (res.consumed) {
      setPlayer(res.player);
      flash(res.message);
    } else {
      flash(res.message);
    }
  };

  // ---- Battle ---------------------------------------------------------------

  const runEnemyTurn = useCallback((curPlayer: Player, curBattle: BattleState) => {
    setBusy(true);
    window.setTimeout(() => {
      const res = enemyTurn(curPlayer, curBattle);
      const settled = checkBattleEnd(res.battle, res.player);
      setPlayer(res.player);
      setBattle(settled);
      setBusy(false);
      if (settled.outcome) resolveOutcome(res.player, settled);
    }, 620);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveOutcome = (curPlayer: Player, curBattle: BattleState) => {
    if (curBattle.outcome === "win") {
      const res = applyVictory(curPlayer, curBattle);
      setPlayer(res.player);
      setBattle({ ...curBattle, log: [...curBattle.log, ...res.messages] });
      window.setTimeout(() => setScreen("victory"), 400);
    } else if (curBattle.outcome === "lose") {
      window.setTimeout(() => setScreen("defeat"), 400);
    }
  };

  const afterPlayerAction = (nextPlayer: Player, nextBattle: BattleState) => {
    const settled = checkBattleEnd(nextBattle, nextPlayer);
    setPlayer(nextPlayer);
    setBattle(settled);
    if (settled.outcome) resolveOutcome(nextPlayer, settled);
    else runEnemyTurn(nextPlayer, settled);
  };

  const doAttack = () => {
    if (!player || !battle || busy || battle.turn !== "player") return;
    const res = playerAttack(player, battle);
    afterPlayerAction(res.player, res.battle);
  };
  const doDefend = () => {
    if (!player || !battle || busy || battle.turn !== "player") return;
    const res = playerDefend(player, battle);
    afterPlayerAction(res.player, res.battle);
  };
  const doSkill = (skillId: string) => {
    if (!player || !battle || busy || battle.turn !== "player") return;
    const skill = skillsFor(player).find((s) => s.id === skillId);
    if (!skill) return;
    if (player.mp < skill.mpCost) {
      flash("Not enough MP!");
      return;
    }
    const res = playerSkill(player, battle, skill);
    afterPlayerAction(res.player, res.battle);
  };
  const doItemInBattle = (itemId: ItemId) => {
    if (!player || !battle || busy || battle.turn !== "player") return;
    const res = useItem(player, battle, itemId);
    if (!res.consumed) {
      flash(res.message);
      return;
    }
    afterPlayerAction(res.player, { ...battle, log: [...battle.log, res.message], turn: "enemy" });
  };
  const doFlee = () => {
    if (!player || !battle || busy || battle.turn !== "player") return;
    if (attemptFlee(player, battle.enemy)) {
      flash("Got away safely!");
      setBattle(null);
      setScreen("world");
    } else {
      afterPlayerAction(player, { ...battle, log: [...battle.log, "Couldn't escape!"], turn: "enemy" });
    }
  };

  useEffect(() => {
    if (
      screen === "battle" &&
      player &&
      battle &&
      battle.turn === "player" &&
      battle.log.length === 1 &&
      enemyIsFaster(player, battle.enemy)
    ) {
      const withNote: BattleState = {
        ...battle,
        log: [...battle.log, `${battle.enemy.name} is quicker!`],
      };
      setBattle(withNote);
      runEnemyTurn(player, withNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const continueAfterVictory = () => {
    const back = battle?.returnTo ?? "world";
    setBattle(null);
    setScreen(back);
  };

  const revive = () => {
    if (!player) return;
    setPlayer({
      ...player,
      hp: Math.max(1, Math.round(player.stats.maxHp / 2)),
      mp: Math.round(player.stats.maxMp / 2),
      statuses: [],
      pos: getPlace("rivenholde")?.pos ?? player.pos,
    });
    setBattle(null);
    setPlaceState(null);
    setScreen("world");
    flash("You awaken safe in Rivenholde…");
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
          onOpenQuests={() => openQuests("world")}
          onOpenMenu={() => setShowItems(true)}
        />
      )}

      {screen === "town" && player && place && (
        <TownScreen
          player={player}
          place={place}
          onTalk={talkTo}
          onRest={rest}
          onBuy={buyItem}
          onUseItem={useFieldItem}
          onQuests={() => openQuests("town")}
          onLeave={() => setScreen("world")}
        />
      )}

      {screen === "quests" && player && (
        <QuestLog player={player} onBack={() => setScreen(prevScreen)} />
      )}

      {screen === "battle" && player && battle && (
        <BattleScreen
          player={player}
          battle={battle}
          busy={busy}
          logRef={logRef}
          onAttack={doAttack}
          onDefend={doDefend}
          onSkill={doSkill}
          onItem={doItemInBattle}
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
          onClose={() => setActiveNpc(null)}
        />
      )}

      {showItems && player && (
        <ItemMenu player={player} onUse={useFieldItem} onClose={() => setShowItems(false)} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Screens
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
        <p className="mt-2 text-sm text-muted">An open-world turn-based adventure.</p>
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
      <p className="text-xs text-muted/70">Progress saves automatically to this device.</p>
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
  onUseItem,
  onQuests,
  onLeave,
}: {
  player: Player;
  place: Place;
  onTalk: (npc: Npc) => void;
  onRest: () => void;
  onBuy: (id: ItemId) => void;
  onUseItem: (id: ItemId) => void;
  onQuests: () => void;
  onLeave: () => void;
}) {
  const restCost = 10 + player.level * 5;
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

      <StatHeader player={player} />

      <Panel>
        <h3 className="mb-2 text-sm font-bold text-muted">🧑 Townsfolk</h3>
        <div className="flex flex-col gap-2">
          {npcs.map((npc) => {
            const { state } = npcQuestState(player, npc);
            const badge =
              state === "available" ? "❗" : state === "turnin" ? "✅" : state === "active" ? "…" : "";
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
        {hasInn && <Button onClick={onRest}>🛏️ Inn ({restCost} Gil)</Button>}
        <Button variant="primary" onClick={onQuests}>
          📜 Quest Log
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
                {(item.effect.hp || item.effect.mp) && owned > 0 && (
                  <button
                    onClick={() => onUseItem(id)}
                    className="shrink-0 rounded-lg bg-panel2 px-2.5 py-1.5 text-xs font-semibold ring-1 ring-line"
                  >
                    Use
                  </button>
                )}
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
  busy,
  logRef,
  onAttack,
  onDefend,
  onSkill,
  onItem,
  onFlee,
}: {
  player: Player;
  battle: BattleState;
  busy: boolean;
  logRef: React.RefObject<HTMLDivElement>;
  onAttack: () => void;
  onDefend: () => void;
  onSkill: (id: string) => void;
  onItem: (id: ItemId) => void;
  onFlee: () => void;
}) {
  const [menu, setMenu] = useState<"main" | "skill" | "item">("main");
  const zone = ZONES[battle.zoneIndex];
  const skills = skillsFor(player);
  const usableItems = SHOP_STOCK.filter(
    (id) => (ITEMS[id].effect.hp || ITEMS[id].effect.mp) && (player.inventory[id] ?? 0) > 0,
  );
  const locked = busy || battle.turn !== "player";

  return (
    <div className="flex min-h-[100dvh] flex-col gap-3">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${zone.bg} p-4 pt-6 ring-1 ring-line`}>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white/90">
              {battle.enemy.name}
              {battle.isBoss && " 👑"}
            </div>
            <div className="mt-1 w-40 max-w-full">
              <Bar
                value={battle.enemy.hp}
                max={battle.enemy.maxHp}
                color="bg-gradient-to-r from-red-500 to-orange-400"
                label="Enemy HP"
              />
            </div>
          </div>
        </div>
        <div className="my-4 flex justify-center">
          <span className={`text-7xl drop-shadow-lg ${battle.turn === "enemy" ? "animate-bounce" : ""}`}>
            {battle.enemy.sprite}
          </span>
        </div>
      </div>

      <div
        ref={logRef}
        className="scroll-thin h-24 overflow-y-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-slate-200 ring-1 ring-line"
      >
        {battle.log.slice(-30).map((line, i) => (
          <div key={i} className="mb-0.5">
            {line}
          </div>
        ))}
      </div>

      <StatHeader player={player} />

      <div className="mt-auto">
        {menu === "main" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={onAttack} disabled={locked}>
              ⚔️ Attack
            </Button>
            <Button onClick={() => setMenu("skill")} disabled={locked || skills.length === 0}>
              ✨ Skill
            </Button>
            <Button onClick={() => setMenu("item")} disabled={locked || usableItems.length === 0}>
              🎒 Item
            </Button>
            <Button onClick={onDefend} disabled={locked}>
              🛡️ Defend
            </Button>
            <Button variant="ghost" onClick={onFlee} disabled={locked || battle.isBoss} className="col-span-2">
              {battle.isBoss ? "🚫 Can't flee a boss" : "🏃 Flee"}
            </Button>
          </div>
        )}

        {menu === "skill" && (
          <div className="flex flex-col gap-2">
            {skills.map((s) => (
              <button
                key={s.id}
                disabled={locked || player.mp < s.mpCost}
                onClick={() => {
                  onSkill(s.id);
                  setMenu("main");
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
            {usableItems.map((id) => (
              <button
                key={id}
                disabled={locked}
                onClick={() => {
                  onItem(id);
                  setMenu("main");
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
      </div>
    </div>
  );
}

function ItemMenu({
  player,
  onUse,
  onClose,
}: {
  player: Player;
  onUse: (id: ItemId) => void;
  onClose: () => void;
}) {
  const items = SHOP_STOCK.filter((id) => (player.inventory[id] ?? 0) > 0);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-panel p-4 ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">🎒 Pack</h3>
          <span className="text-xs text-muted">🪙 {player.gold} Gil</span>
        </div>
        <StatHeader player={player} />
        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 && <p className="text-sm text-muted">Your pack is empty.</p>}
          {items.map((id) => {
            const item = ITEMS[id];
            const usable = item.effect.hp || item.effect.mp;
            return (
              <div key={id} className="flex items-center gap-2 rounded-xl bg-panel2 px-3 py-2 ring-1 ring-line">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {item.name} <span className="text-muted">×{player.inventory[id]}</span>
                  </div>
                  <div className="text-[11px] text-muted">{item.desc}</div>
                </div>
                {usable && (
                  <button
                    onClick={() => onUse(id)}
                    className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Use
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={onClose}>
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
        {win ? "Victory!" : "You fell..."}
      </h2>
      <Panel className="w-full max-w-xs text-left">
        <div className="max-h-40 overflow-y-auto text-xs leading-relaxed text-slate-200">
          {battle.log.slice(-12).map((line, i) => (
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
