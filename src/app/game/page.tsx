import type { Metadata } from "next";
import RPGGame from "./RPGGame";

export const metadata: Metadata = {
  title: "Aether Wilds — Mobile RPG",
  description:
    "A pocket-sized, mobile-first turn-based RPG. Pick a class, battle through three zones, and topple the bosses of the Aether Wilds.",
};

export default function GamePage() {
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-ink to-[#070d18]">
      <RPGGame />
    </main>
  );
}
