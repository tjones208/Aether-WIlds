"use client";

import { useEffect } from "react";
import type { Dir, Player } from "./types";
import {
  MAP_H,
  MAP_W,
  PLAYER_SPRITE,
  TERRAIN_SPRITE,
  placeAt,
  regionForPos,
  tileAt,
} from "./world";
import { ZONES } from "./content";
import { Button } from "./ui";

const VIEW = 7; // odd — player sits in the centre

export default function Overworld({
  player,
  onMove,
  onOpenQuests,
  onOpenMenu,
}: {
  player: Player;
  onMove: (dir: Dir) => void;
  onOpenQuests: () => void;
  onOpenMenu: () => void;
}) {
  // Keyboard support for desktop players.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        onMove(dir);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onMove]);

  const half = Math.floor(VIEW / 2);
  const cx = player.pos.x;
  const cy = player.pos.y;
  const region = regionForPos(player.pos);
  const regionName = ZONES[region].name;

  // Build the visible window centred on the player.
  const rows: JSX.Element[] = [];
  for (let dy = -half; dy <= half; dy++) {
    const cells: JSX.Element[] = [];
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const isPlayer = dx === 0 && dy === 0;
      const inBounds = x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
      const t = inBounds ? tileAt(x, y) : "M";
      const place = inBounds ? placeAt(x, y) : undefined;
      cells.push(
        <div
          key={`${x},${y}`}
          className={`flex aspect-square items-center justify-center rounded-[3px] text-lg leading-none sm:text-xl ${
            isPlayer ? "bg-white/10 ring-1 ring-white/40" : ""
          }`}
          title={place ? place.name : undefined}
        >
          {isPlayer ? PLAYER_SPRITE : TERRAIN_SPRITE[t] ?? "·"}
        </div>,
      );
    }
    rows.push(
      <div key={dy} className="grid grid-cols-7 gap-0.5">
        {cells}
      </div>,
    );
  }

  const here = placeAt(cx, cy);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{regionName}</div>
          <div className="text-[11px] text-muted">
            The Aether Wilds · step {player.steps}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>🪙 {player.gold}</span>
          <span>❤️ {Math.round(player.hp)}/{player.stats.maxHp}</span>
        </div>
      </div>

      {/* Map viewport */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-950/60 to-slate-950 p-2 ring-1 ring-line">
        <div className="flex flex-col gap-0.5">{rows}</div>
      </div>

      {/* Legend / hint */}
      <div className="text-center text-[11px] text-muted">
        {here ? (
          <span className="text-amber-300">You stand at {here.name}.</span>
        ) : (
          <span>🏘️ town · 🏰 castle · 🕳️ dungeon · ⛰️🌊 blocked</span>
        )}
      </div>

      {/* Controls */}
      <div className="mt-auto flex items-end justify-between gap-3">
        {/* D-pad */}
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <PadBtn label="▲" onClick={() => onMove("up")} />
          <span />
          <PadBtn label="◀" onClick={() => onMove("left")} />
          <PadBtn label="●" onClick={() => here && onMove("down")} dim />
          <PadBtn label="▶" onClick={() => onMove("right")} />
          <span />
          <PadBtn label="▼" onClick={() => onMove("down")} />
          <span />
        </div>

        {/* Menu */}
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onOpenQuests} className="!px-3 !py-2 text-xs">
            📜 Quests
          </Button>
          <Button onClick={onOpenMenu} className="!px-3 !py-2 text-xs">
            🎒 Party
          </Button>
        </div>
      </div>
    </div>
  );
}

function PadBtn({ label, onClick, dim }: { label: string; onClick: () => void; dim?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold ring-1 ring-line transition active:scale-95 ${
        dim ? "bg-panel/50 text-muted/50" : "bg-panel2 text-white hover:bg-line"
      }`}
    >
      {label}
    </button>
  );
}
