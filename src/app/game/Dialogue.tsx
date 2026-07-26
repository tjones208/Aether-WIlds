"use client";

import { useState } from "react";
import type { Npc, Player } from "./types";
import { npcQuestState, objectiveProgress } from "./engine";
import { Button } from "./ui";

export default function Dialogue({
  npc,
  player,
  onAccept,
  onTurnIn,
  onClose,
}: {
  npc: Npc;
  player: Player;
  onAccept: (questId: string) => void;
  onTurnIn: (questId: string) => void;
  onClose: () => void;
}) {
  const { state, quest } = npcQuestState(player, npc);
  // Walk through idle lines first, then reveal the quest offer/turn-in.
  const [line, setLine] = useState(0);
  const lines = npc.lines;
  const atEnd = line >= lines.length - 1;

  const showQuest = atEnd && quest && (state === "available" || state === "turnin" || state === "active");
  const prog = quest ? player.quests[quest.id] : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-panel p-4 ring-1 ring-line">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-4xl">{npc.sprite}</span>
          <div>
            <div className="font-bold">{npc.name}</div>
            <div className="text-[11px] text-muted">
              {state === "turnin" && "❗ has a reward for you"}
              {state === "available" && "❗ has a request"}
              {state === "active" && "…awaiting your progress"}
            </div>
          </div>
        </div>

        <p className="min-h-[3.5rem] text-sm leading-relaxed text-slate-100">
          {showQuest && state === "turnin"
            ? quest!.completeText
            : showQuest && state === "available"
              ? quest!.acceptText
              : lines[line]}
        </p>

        {showQuest && (
          <div className="mt-3 rounded-xl bg-panel2 p-3 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-300">
                {quest!.isMain ? "★ " : ""}
                {quest!.name}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {quest!.isMain ? "Main" : "Side"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">{quest!.summary}</p>
            <div className="mt-2 flex flex-col gap-1">
              {quest!.objectives.map((o, i) => {
                const { value, target } = prog
                  ? objectiveProgress(o, player, prog, i)
                  : { value: 0, target: 1 };
                return (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className={value >= target ? "text-ok" : "text-slate-200"}>
                      {value >= target ? "✓" : "•"} {o.label}
                    </span>
                    <span className="text-muted">
                      {value}/{target}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] text-muted">
              Reward:{" "}
              {[
                quest!.reward.gold ? `${quest!.reward.gold} Gil` : null,
                quest!.reward.xp ? `${quest!.reward.xp} XP` : null,
                quest!.reward.item
                  ? `${quest!.reward.itemQty ?? 1}× item`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {!atEnd && (
            <Button onClick={() => setLine((l) => l + 1)}>Next ▸</Button>
          )}
          {atEnd && showQuest && state === "available" && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Not now
              </Button>
              <Button variant="primary" onClick={() => onAccept(quest!.id)}>
                Accept
              </Button>
            </>
          )}
          {atEnd && showQuest && state === "turnin" && (
            <Button variant="primary" onClick={() => onTurnIn(quest!.id)}>
              Claim reward
            </Button>
          )}
          {atEnd && (!showQuest || state === "active") && (
            <Button variant="primary" onClick={onClose}>
              Farewell
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
