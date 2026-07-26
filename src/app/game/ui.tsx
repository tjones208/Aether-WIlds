"use client";

import { CLASSES } from "./content";
import type { Character, Player } from "./types";

export function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] font-medium text-muted">
        <span>{label}</span>
        <span>
          {Math.max(0, Math.round(value))}/{Math.round(max)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "ghost";
  className?: string;
}) {
  const base =
    "select-none rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
  const variants: Record<string, string> = {
    default: "bg-panel2 text-white ring-1 ring-line hover:bg-line",
    primary: "bg-brand text-white hover:bg-brand2 shadow-lg shadow-brand/20",
    danger: "bg-danger/90 text-white hover:bg-danger",
    ghost: "bg-transparent text-muted ring-1 ring-line hover:bg-panel2",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-panel/80 p-4 ring-1 ring-line backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

// A compact HP/MP (and optional XP) readout for one character.
export function CharBars({ char, showXp = false }: { char: Character; showXp?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Bar
        value={char.hp}
        max={char.stats.maxHp}
        color="bg-gradient-to-r from-red-500 to-rose-400"
        label="HP"
      />
      <Bar
        value={char.mp}
        max={char.stats.maxMp}
        color="bg-gradient-to-r from-sky-500 to-cyan-400"
        label="MP"
      />
      {showXp && (
        <Bar
          value={char.xp}
          max={char.xpToNext}
          color="bg-gradient-to-r from-amber-500 to-yellow-300"
          label="XP"
        />
      )}
    </div>
  );
}

// One row in a party list.
export function MemberRow({ char, active = false }: { char: Character; active?: boolean }) {
  const down = char.hp <= 0;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-2 ring-1 transition ${
        active ? "bg-brand/15 ring-brand" : "bg-panel2/60 ring-line"
      } ${down ? "opacity-50" : ""}`}
    >
      <span className="text-2xl">{char.sprite}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="truncate text-sm font-bold">{char.name}</span>
          <span className="text-[10px] text-muted">
            {down ? "KO" : `Lv ${char.level} ${CLASSES[char.classId].name}`}
          </span>
        </div>
        <div className="mt-1">
          <CharBars char={char} />
        </div>
      </div>
    </div>
  );
}

// The whole party, optionally highlighting whose turn it is.
export function PartyList({
  player,
  activeId,
  className = "",
}: {
  player: Player;
  activeId?: string | null;
  className?: string;
}) {
  return (
    <Panel className={`!p-2 ${className}`}>
      <div className="flex flex-col gap-1.5">
        {player.party.map((c) => (
          <MemberRow key={c.id} char={c} active={activeId === c.id} />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted">
        <span>🪙 {player.gold} Gil</span>
        <span>⚔️ {player.battlesWon} won</span>
      </div>
    </Panel>
  );
}
