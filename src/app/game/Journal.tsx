"use client";

import type { Player } from "./types";
import { CHAPTERS, currentChapter } from "./story";
import { Button, Panel } from "./ui";

export default function Journal({ player, onBack }: { player: Player; onBack: () => void }) {
  const chapter = currentChapter(player);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📖 Story</h2>
        <Button variant="ghost" onClick={onBack} className="!px-3 !py-2 text-xs">
          ← Back
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-4 ring-1 ring-line">
        <div className="text-[11px] uppercase tracking-widest text-amber-300/80">Now</div>
        <h3 className="mt-1 text-lg font-bold">{chapter.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{chapter.synopsis}</p>
        <div className="mt-3 rounded-xl bg-black/30 p-3 text-sm">
          <span className="font-semibold text-amber-300">Objective: </span>
          <span className="text-white/90">{chapter.objective}</span>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-muted">Chronicle</h3>
        <div className="flex flex-col gap-2">
          {CHAPTERS.map((ch) => {
            const done = ch.num < chapter.num;
            const isNow = ch.id === chapter.id;
            return (
              <div
                key={ch.id}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  isNow
                    ? "bg-brand/15 ring-brand"
                    : done
                      ? "bg-panel/60 ring-line text-slate-300"
                      : "bg-panel/40 ring-line text-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ch.title}</span>
                  <span className="text-[11px]">{done ? "✓" : isNow ? "▸ now" : "🔒"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
