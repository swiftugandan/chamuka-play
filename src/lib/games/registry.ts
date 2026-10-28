import type { StarterKitId } from "@/lib/agent/protocol";

export type GameCategory = "fun" | "learning";

export interface GameStarter {
  id: string;
  category: GameCategory;
  label: string;
  description: string;
  /** The sentence that opens the model's brief for this kind of game. */
  brief: string;
  /** Kid-friendly example ideas shown as tappable suggestions. */
  examples: string[];
  /** The starter kit that usually fits this kind of game (the agent may pick another). */
  kit?: StarterKitId;
}

export const GAME_STARTERS: GameStarter[] = [
  {
    id: "clicker",
    kit: "phaser-arcade",
    category: "fun",
    label: "Clicker Game",
    description: "Tap or click to score before time runs out",
    brief: "Make a Clicker Game.",
    examples: [
      "tap the rainbow stars",
      "pop as many balloons as you can",
      "click the shy ghosts before they hide",
    ],
  },
  {
    id: "catch",
    kit: "phaser-arcade",
    category: "fun",
    label: "Catch Game",
    description: "Move side to side to catch things falling from the top",
    brief: "Make a Catch Game.",
    examples: [
      "catch falling apples in a basket",
      "a puppy catching bones",
      "catch raindrops with an umbrella",
    ],
  },
  {
    id: "maze",
    kit: "phaser-arcade",
    category: "fun",
    label: "Maze Game",
    description: "Guide a character through a maze to the goal",
    brief: "Make a Maze Game.",
    examples: [
      "a mouse finding the cheese",
      "help a robot reach its rocket",
      "guide a bee to its flower",
    ],
  },
  {
    id: "quiz",
    kit: "dom-quiz",
    category: "fun",
    label: "Quiz Game",
    description: "Answer fun multiple-choice questions and keep score",
    brief: "Make a Quiz Game.",
    examples: ["fun animal trivia", "guess the dinosaur", "cool space facts"],
  },
  {
    id: "anything",
    category: "fun",
    label: "Anything You Want",
    description: "Tell me any idea and I'll build it",
    brief:
      "Make any kind of game the player describes. Invent whatever mechanics best fit their idea.",
    examples: [
      "a dragon that bakes cupcakes",
      "a skateboarding penguin",
      "a rocket dodging asteroids",
    ],
  },
  {
    id: "memory",
    kit: "dom-quiz",
    category: "fun",
    label: "Memory Game",
    description: "Flip cards to find the matching pairs",
    brief: "Make a Memory Game.",
    examples: [
      "match the farm animals",
      "find the matching fruits",
      "match the planets",
    ],
  },
  {
    id: "math",
    kit: "dom-quiz",
    category: "learning",
    label: "Math Game",
    description: "Solve fun number puzzles and add up points",
    brief: "Make a Math Game.",
    examples: [
      "add up the apples",
      "count the hidden stars",
      "a quick times-tables race",
    ],
  },
  {
    id: "spelling",
    kit: "dom-quiz",
    category: "learning",
    label: "Spelling Game",
    description: "Spell words and learn new letters",
    brief: "Make a Spelling Game.",
    examples: [
      "spell cute animal names",
      "fill in the missing letter",
      "build three-letter words",
    ],
  },
  {
    id: "typing",
    kit: "dom-quiz",
    category: "learning",
    label: "Typing Game",
    description: "Type the words before they reach the bottom",
    brief: "Make a Typing Game.",
    examples: [
      "type the falling words",
      "race to type animal names",
      "catch letters by typing",
    ],
  },
];

export function getStarter(id: string): GameStarter | undefined {
  return GAME_STARTERS.find((s) => s.id === id);
}

export function startersByCategory(category: GameCategory): GameStarter[] {
  return GAME_STARTERS.filter((s) => s.category === category);
}
