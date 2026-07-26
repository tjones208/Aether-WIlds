"use client";

import { activeQuests, completedQuests, objectiveProgress } from "./engine";
import { NPCS, getPlace } from "./world";
import type { Player } from "./types";
import { Button, Panel } from "./ui";

export default function QuestLog({ player, onBack }: { player: Player; onBack: () => void }) {
  const active = activeQuests(player);
  const done = completedQuests(player);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📜 Quest Log</h2>
        <Button variant="ghost" onClick={onBack} className="!px-3 !py-2 text-xs">
          ← Back
        </Button>
      </div>

      {active.length === 0 && done.length === 0 && (
        <Panel>
          <p className="text-sm text-muted">
            No quests yet. Seek out King Aldren in Castle Aurelis, and the folk of
            Rivenholde — someone always needs a hero.
          </p>
        </Panel>
      )}

      {active.map(({ quest, prog }) => {
        const complete = quest.objectives.every(
          (o, i) => objectiveProgress(o, player, prog, i).value >= objectiveProgress(o, player, prog, i).target,
        );
        const giver = NPCS[quest.giver];
        const place = giver ? getPlace(giver.place) : undefined;
        return (
          <Panel key={quest.id} className={complete ? "ring-ok/50" : ""}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">
                {quest.isMain ? "★ " : ""}
                {quest.name}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {quest.isMain ? "Main" : "Side"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">{quest.summary}</p>
            <div className="mt-2 flex flex-col gap-1">
              {quest.objectives.map((o, i) => {
                const { value, target } = objectiveProgress(o, player, prog, i);
                const ok = value >= target;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className={ok ? "text-ok" : "text-slate-200"}>
                      {ok ? "✓" : "•"} {o.label}
                    </span>
                    <span className="text-muted">
                      {value}/{target}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[11px]">
              {complete ? (
                <span className="font-semibold text-ok">
                  Ready! Return to {giver?.name ?? "the giver"}
                  {place ? ` in ${place.name}` : ""}.
                </span>
              ) : (
                <span className="text-muted">
                  Giver: {giver?.name ?? "?"}
                  {place ? ` · ${place.name}` : ""}
                </span>
              )}
            </div>
          </Panel>
        );
      })}

      {done.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-muted">Completed</h3>
          <div className="flex flex-col gap-2">
            {done.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-xl bg-panel/60 px-3 py-2 text-xs ring-1 ring-line"
              >
                <span className="text-slate-300">
                  {q.isMain ? "★ " : ""}
                  {q.name}
                </span>
                <span className="text-ok">✓ done</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
