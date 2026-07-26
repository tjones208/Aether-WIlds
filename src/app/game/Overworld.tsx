"use client";

import { useEffect, useRef } from "react";
import type { Dir, Player } from "./types";
import { MAP_H, MAP_W, isWalkable, placeAt, regionForPos, tileAt } from "./world";
import { CLASSES, ZONES } from "./content";
import { Button } from "./ui";

// How long, in ms, it takes the hero to walk from one tile to the next.
const STEP_MS = 150;

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Deterministic 0..1 value per tile — used so terrain texture doesn't flicker.
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5f3759df;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % 1000) / 1000;
}

const TUNIC: Record<string, string> = {
  warrior: "#c0453b",
  mage: "#6d54c9",
  rogue: "#2f9e6a",
};

type Step = { dx: number; dy: number; progress: number; tx: number; ty: number };

export default function Overworld({
  player,
  onArrive,
  onOpenQuests,
  onOpenMenu,
}: {
  player: Player;
  onArrive: (x: number, y: number) => boolean; // returns true if it halted movement
  onOpenQuests: () => void;
  onOpenMenu: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable game-loop state kept in refs so the rAF loop never triggers re-renders.
  const posRef = useRef({ x: player.pos.x, y: player.pos.y });
  const stepRef = useRef<Step | null>(null);
  const facingRef = useRef<Dir>("down");
  const heldRef = useRef<Dir | null>(null);
  const haltedRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0, tile: 34, dpr: 1 });
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;

  const tunic = TUNIC[player.classId] ?? "#c0453b";

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const w = wrap.clientWidth;
      const h = Math.max(300, Math.min(Math.round(w * 0.95), Math.round(window.innerHeight * 0.52)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const tile = Math.max(30, Math.floor(w / 9));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, tile, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();

    const commit = (x: number, y: number) => {
      const halted = onArriveRef.current(x, y);
      if (halted) haltedRef.current = true;
    };

    const frame = (ts: number) => {
      const dt = Math.min(48, ts - last);
      last = ts;

      if (!haltedRef.current) {
        if (!stepRef.current && heldRef.current) {
          const d = DELTA[heldRef.current];
          facingRef.current = heldRef.current;
          const tx = posRef.current.x + d.dx;
          const ty = posRef.current.y + d.dy;
          if (isWalkable(tx, ty)) {
            stepRef.current = { dx: d.dx, dy: d.dy, progress: 0, tx, ty };
          }
        }
        const step = stepRef.current;
        if (step) {
          step.progress += dt / STEP_MS;
          if (step.progress >= 1) {
            posRef.current = { x: step.tx, y: step.ty };
            stepRef.current = null;
            commit(posRef.current.x, posRef.current.y);
          }
        }
      }

      draw(ctx, ts);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard walking (arrows / WASD) for desktop players.
  useEffect(() => {
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
    const down = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        heldRef.current = dir;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (map[e.key] && heldRef.current === map[e.key]) heldRef.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ---- Rendering ------------------------------------------------------------

  const draw = (ctx: CanvasRenderingContext2D, ts: number) => {
    const { w, h, tile, dpr } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const step = stepRef.current;
    const ox = step ? step.dx * step.progress : 0;
    const oy = step ? step.dy * step.progress : 0;
    const heroWX = (posRef.current.x + ox + 0.5) * tile;
    const heroWY = (posRef.current.y + oy + 0.5) * tile;

    const mapPixW = MAP_W * tile;
    const mapPixH = MAP_H * tile;
    const camX = Math.max(0, Math.min(heroWX - w / 2, mapPixW - w));
    const camY = Math.max(0, Math.min(heroWY - h / 2, mapPixH - h));

    const c0 = Math.floor(camX / tile) - 1;
    const c1 = Math.ceil((camX + w) / tile) + 1;
    const r0 = Math.floor(camY / tile) - 1;
    const r1 = Math.ceil((camY + h) / tile) + 1;

    for (let y = r0; y <= r1; y++) {
      for (let x = c0; x <= c1; x++) {
        drawTile(ctx, x, y, x * tile - camX, y * tile - camY, tile, ts);
      }
    }

    drawHero(ctx, heroWX - camX, heroWY - camY, tile, facingRef.current, step, tunic);
  };

  const drawTile = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    sx: number,
    sy: number,
    tile: number,
    ts: number,
  ) => {
    const t = tileAt(x, y);
    const r = hash(x, y);

    const fill = (col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, tile + 1, tile + 1);
    };

    if (t === "s") fill("#d8c079");
    else if (t === "~") fill("#2f74b8");
    else if (t === "=") fill("#b89b6a");
    else if (t === "M") fill("#6f6f79");
    else fill("#3a8a4a"); // grass under grass/forest/town/castle/dungeon

    if (t === "." || t === "T" || t === "C" || t === "D" || t === "f") {
      ctx.fillStyle = "#2f7b3f";
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 7 + i, y * 13 + 1);
        const hy = hash(x * 3 + 2, y * 11 + i);
        ctx.fillRect(sx + hx * (tile - 4) + 2, sy + hy * (tile - 4) + 2, 2, 2);
      }
    }
    if (t === "f") {
      const trees = 2 + Math.floor(r * 2);
      for (let i = 0; i < trees; i++) {
        const hx = hash(x * 5 + i, y * 9 + 3);
        const hy = hash(x * 2 + 4, y * 6 + i);
        const cxp = sx + 4 + hx * (tile - 12);
        const cyp = sy + 4 + hy * (tile - 12);
        ctx.fillStyle = "#123c1c";
        ctx.beginPath();
        ctx.arc(cxp + 4, cyp + 6, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1f5f30";
        ctx.beginPath();
        ctx.arc(cxp + 4, cyp + 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t === "s") {
      ctx.fillStyle = "#c3a95c";
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 6 + i, y * 8 + 2);
        const hy = hash(x + i, y * 4 + 5);
        ctx.fillRect(sx + hx * (tile - 3) + 1, sy + hy * (tile - 3) + 1, 2, 1);
      }
    } else if (t === "~") {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      const off = Math.sin(ts / 500 + x * 0.9 + y * 0.6) * 3;
      ctx.fillRect(sx + 3, sy + tile * 0.35 + off, tile - 8, 1.5);
      ctx.fillRect(sx + 6, sy + tile * 0.65 - off, tile - 12, 1.5);
    } else if (t === "M") {
      ctx.fillStyle = "#565660";
      ctx.beginPath();
      ctx.moveTo(sx + tile * 0.5, sy + 4);
      ctx.lineTo(sx + tile - 3, sy + tile - 3);
      ctx.lineTo(sx + 3, sy + tile - 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e8edf5";
      ctx.beginPath();
      ctx.moveTo(sx + tile * 0.5, sy + 4);
      ctx.lineTo(sx + tile * 0.62, sy + tile * 0.32);
      ctx.lineTo(sx + tile * 0.38, sy + tile * 0.32);
      ctx.closePath();
      ctx.fill();
    } else if (t === "=") {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(sx, sy, tile + 1, 2);
      ctx.fillRect(sx, sy, 2, tile + 1);
    }

    if (t === "T" || t === "C" || t === "D") drawStructure(ctx, t, sx, sy, tile);
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{ZONES[regionForPos(player.pos)].name}</div>
          <div className="text-[11px] text-muted">
            {CLASSES[player.classId].name} · Lv {player.level} · step {player.steps}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>🪙 {player.gold}</span>
          <span>
            ❤️ {Math.round(player.hp)}/{player.stats.maxHp}
          </span>
        </div>
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl ring-1 ring-line">
        <canvas ref={canvasRef} className="block h-auto w-full touch-none" />
        <PlaceLabel player={player} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        <DPad
          onHold={(d) => (heldRef.current = d)}
          onRelease={(d) => {
            if (heldRef.current === d) heldRef.current = null;
          }}
        />
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onOpenQuests} className="!px-3 !py-2 text-xs">
            📜 Quests
          </Button>
          <Button onClick={onOpenMenu} className="!px-3 !py-2 text-xs">
            🎒 Pack
          </Button>
        </div>
      </div>
    </div>
  );
}

// A small caption naming the place you're standing on / next to.
function PlaceLabel({ player }: { player: Player }) {
  const here =
    placeAt(player.pos.x, player.pos.y) ??
    placeAt(player.pos.x, player.pos.y - 1) ??
    placeAt(player.pos.x, player.pos.y + 1) ??
    placeAt(player.pos.x - 1, player.pos.y) ??
    placeAt(player.pos.x + 1, player.pos.y);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
      <div className="rounded-full bg-black/55 px-3 py-1 text-center text-[11px] text-white/90">
        {here
          ? `${here.kind === "castle" ? "🏰" : here.kind === "dungeon" ? "🕳️" : "🏘️"} ${here.name} — step on it to enter`
          : "Hold a direction to walk"}
      </div>
    </div>
  );
}

function drawStructure(ctx: CanvasRenderingContext2D, t: string, sx: number, sy: number, tile: number) {
  const cx = sx + tile / 2;
  if (t === "T") {
    ctx.fillStyle = "#7b5233";
    ctx.fillRect(sx + tile * 0.28, sy + tile * 0.45, tile * 0.44, tile * 0.35);
    ctx.fillStyle = "#c0453b";
    ctx.beginPath();
    ctx.moveTo(sx + tile * 0.22, sy + tile * 0.47);
    ctx.lineTo(cx, sy + tile * 0.2);
    ctx.lineTo(sx + tile * 0.78, sy + tile * 0.47);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(cx - tile * 0.05, sy + tile * 0.58, tile * 0.1, tile * 0.22);
  } else if (t === "C") {
    ctx.fillStyle = "#9aa2ad";
    ctx.fillRect(sx + tile * 0.22, sy + tile * 0.35, tile * 0.56, tile * 0.45);
    ctx.fillStyle = "#c3ccd6";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx + tile * (0.24 + i * 0.19), sy + tile * 0.28, tile * 0.12, tile * 0.12);
    }
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(cx - tile * 0.07, sy + tile * 0.55, tile * 0.14, tile * 0.25);
    ctx.fillStyle = "#e0b23a";
    ctx.fillRect(cx, sy + tile * 0.12, tile * 0.14, tile * 0.08);
  } else if (t === "D") {
    ctx.fillStyle = "#4a4550";
    ctx.beginPath();
    ctx.moveTo(sx + tile * 0.2, sy + tile * 0.8);
    ctx.lineTo(sx + tile * 0.3, sy + tile * 0.35);
    ctx.lineTo(sx + tile * 0.7, sy + tile * 0.35);
    ctx.lineTo(sx + tile * 0.8, sy + tile * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0c0a12";
    ctx.beginPath();
    ctx.moveTo(sx + tile * 0.38, sy + tile * 0.8);
    ctx.lineTo(sx + tile * 0.42, sy + tile * 0.48);
    ctx.lineTo(sx + tile * 0.58, sy + tile * 0.48);
    ctx.lineTo(sx + tile * 0.62, sy + tile * 0.8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tile: number,
  facing: Dir,
  step: Step | null,
  tunic: string,
) {
  const u = tile / 34; // scale unit
  const phase = step ? step.progress : 0;
  const bob = step ? Math.abs(Math.sin(phase * Math.PI * 2)) * 1.6 * u : 0;
  const feet = cy + 9 * u;
  const bodyY = cy - bob;

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, feet + 2, 9 * u, 3.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  const legSwing = step ? Math.sin(phase * Math.PI * 2) * 3 * u : 0;
  ctx.fillStyle = "#3a2f4a";
  ctx.fillRect(cx - 5 * u + legSwing, feet - 4 * u, 3.4 * u, 6 * u);
  ctx.fillRect(cx + 1.6 * u - legSwing, feet - 4 * u, 3.4 * u, 6 * u);

  ctx.fillStyle = tunic;
  roundRect(ctx, cx - 6.5 * u, bodyY - 6 * u, 13 * u, 12 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(cx - 6.5 * u, bodyY + 3 * u, 13 * u, 2 * u);

  ctx.fillStyle = "#eab98f";
  ctx.beginPath();
  ctx.arc(cx, bodyY - 10 * u, 5.4 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.arc(cx, bodyY - 11.4 * u, 5.4 * u, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  const ey = bodyY - 9.6 * u;
  if (facing === "down") {
    ctx.fillRect(cx - 2.6 * u, ey, 1.6 * u, 1.8 * u);
    ctx.fillRect(cx + 1 * u, ey, 1.6 * u, 1.8 * u);
  } else if (facing === "left") {
    ctx.fillRect(cx - 3.4 * u, ey, 1.6 * u, 1.8 * u);
  } else if (facing === "right") {
    ctx.fillRect(cx + 1.8 * u, ey, 1.6 * u, 1.8 * u);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// On-screen D-pad. Press-and-hold to keep walking; works with touch and mouse.
function DPad({ onHold, onRelease }: { onHold: (d: Dir) => void; onRelease: (d: Dir) => void }) {
  const btn = (d: Dir, label: string) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(d);
      }}
      onPointerUp={() => onRelease(d)}
      onPointerLeave={() => onRelease(d)}
      onPointerCancel={() => onRelease(d)}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-xl bg-panel2 text-xl font-bold text-white ring-1 ring-line transition active:scale-95 active:bg-line"
    >
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <span />
      {btn("up", "▲")}
      <span />
      {btn("left", "◀")}
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-panel/40 text-muted/40">
        ●
      </span>
      {btn("right", "▶")}
      <span />
      {btn("down", "▼")}
      <span />
    </div>
  );
}
