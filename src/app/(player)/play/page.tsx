import { GamePlayer } from "@/components/player/GamePlayer";

// One static page plays every game: /play/<id> is rewritten here
// (next.config.ts), and the player reads the id from the address bar.
export default function PlayPage() {
  return <GamePlayer />;
}
