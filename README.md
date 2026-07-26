# Aether Wilds ⚔️✨

A mobile-first, open-world turn-based RPG built with **Next.js 14**, **React**, **TypeScript**, and **Tailwind CSS**. It runs entirely in the browser — no backend, no database — and saves your progress to the device via `localStorage`.

## Play

- **Overworld** — walk a tile map with the on-screen D-pad (or arrow / WASD keys). Roads are safe; grass and forest hold random encounters that scale by region.
- **Three regions** — the Whispering Meadow, the Ashen Hollow, and Frostspire Peak, each with a town or castle and a boss dungeon. Dungeons unlock as you defeat the boss before them.
- **Classes** — Warrior 🛡️, Mage 🔮, or Rogue 🗡️, each with its own stats, growth, and skills learned on level-up.
- **Turn-based combat** — Attack, Skills (MP), Items, Defend, and Flee, with speed-based turn order, crits, and a Phoenix Down auto-revive.
- **Towns & NPCs** — talk to townsfolk, rest at the inn, and shop for potions with **Gil**.
- **Quests** — a three-part main storyline plus side quests, auto-tracked from your battles and level-ups, with a full Quest Log and Gil / XP / item rewards.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

The game lives under `src/app/game/`:

| File | Role |
| --- | --- |
| `types.ts` | Shared type definitions |
| `content.ts` | Classes, skills, items, enemies, zones |
| `world.ts` | Overworld tile map, places, NPCs |
| `quests.ts` | Quest and storyline definitions |
| `engine.ts` | Pure combat, movement, and quest logic |
| `save.ts` | `localStorage` persistence |
| `ui.tsx` | Shared UI primitives |
| `Overworld.tsx` / `TownScreen` / `BattleScreen` / `QuestLog.tsx` / `Dialogue.tsx` | Screens & overlays |
| `RPGGame.tsx` | Top-level state machine |

The bare route `/` and `/game` both render the game.

## Deploy

Import this repo into [Vercel](https://vercel.com/new) (framework auto-detects as Next.js). Every push to the default branch deploys automatically.
