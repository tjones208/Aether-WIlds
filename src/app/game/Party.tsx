"use client";

import { CLASSES, SKILLS } from "./content";
import type { Player } from "./types";
import { MAX_PARTY } from "./types";
import { Button, CharBars, Panel } from "./ui";

export default function Party({ player, onBack }: { player: Player; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          🛡️ Party <span className="text-sm text-muted">{player.party.length}/{MAX_PARTY}</span>
        </h2>
        <Button variant="ghost" onClick={onBack} className="!px-3 !py-2 text-xs">
          ← Back
        </Button>
      </div>

      {player.party.map((c) => {
        const learned = SKILLS.filter((s) => c.skills.includes(s.id));
        return (
          <Panel key={c.id}>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{c.sprite}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold">
                    {c.name}
                    {c.id === "hero" && <span className="ml-1 text-[10px] text-amber-300">★ lead</span>}
                  </span>
                  <span className="text-xs text-muted">
                    Lv {c.level} {CLASSES[c.classId].name}
                  </span>
                </div>
                <div className="mt-2">
                  <CharBars char={c} showXp />
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
              {(
                [
                  ["ATK", c.stats.atk],
                  ["DEF", c.stats.def],
                  ["MAG", c.stats.mag],
                  ["SPD", c.stats.spd],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="rounded-lg bg-panel2 py-1.5 ring-1 ring-line">
                  <div className="text-muted">{label}</div>
                  <div className="font-bold">{val}</div>
                </div>
              ))}
            </div>

            {learned.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-bold text-muted">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {learned.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-lg bg-panel2 px-2 py-1 text-[11px] ring-1 ring-line"
                      title={s.desc}
                    >
                      {s.name} <span className="text-cyan-300">{s.mpCost}MP</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      {player.party.length < MAX_PARTY && (
        <Panel className="text-center">
          <p className="text-sm text-muted">
            {MAX_PARTY - player.party.length} open{" "}
            {MAX_PARTY - player.party.length === 1 ? "slot" : "slots"}. Seek companions in the towns
            and castle as your story unfolds.
          </p>
        </Panel>
      )}
    </div>
  );
}
