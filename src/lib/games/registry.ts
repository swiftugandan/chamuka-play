export type GameCategory = "fun" | "learning";

export interface GameStarter {
  id: string;
  category: GameCategory;
  label: string;
  description: string;
  /** Kid-friendly example ideas shown as tappable suggestions. */
  examples: string[];
}

export const GAME_STARTERS: GameStarter[] = [
  {
    id: "clicker",
    category: "fun",
    label: "Clicker Game",
    description: "Tap or click to score before time runs out",
    examples: [
      "tap the rainbow stars",
      "pop as many balloons as you can",
      "click the shy ghosts before they hide",
    ],
  },
  {
    id: "catch",
    category: "fun",
    label: "Catch Game",
    description: "Move side to side to catch things falling from the top",
    examples: [
      "catch falling apples in a basket",
      "a puppy catching bones",
      "catch raindrops with an umbrella",
    ],
  },
  {
    id: "maze",
    category: "fun",
    label: "Maze Game",
    description: "Guide a character through a maze to the goal",
    examples: [
      "a mouse finding the cheese",
      "help a robot reach its rocket",
      "guide a bee to its flower",
    ],
  },
  {
    id: "quiz",
    category: "fun",
    label: "Quiz Game",
    description: "Answer fun multiple-choice questions and keep score",
    examples: ["fun animal trivia", "guess the dinosaur", "cool space facts"],
  },
  {
    id: "drawing",
    category: "fun",
    label: "Drawing Toy",
    description: "A playful canvas to draw with colours and brushes",
    examples: [
      "draw with rainbow crayons",
      "a glittery starry-night canvas",
      "paint with bouncy bubble brushes",
    ],
  },
  {
    id: "memory",
    category: "fun",
    label: "Memory Game",
    description: "Flip cards to find the matching pairs",
    examples: [
      "match the farm animals",
      "find the matching fruits",
      "match the planets",
    ],
  },
  {
    id: "math",
    category: "learning",
    label: "Math Game",
    description: "Solve fun number puzzles and add up points",
    examples: [
      "add up the apples",
      "count the hidden stars",
      "a quick times-tables race",
    ],
  },
  {
    id: "spelling",
    category: "learning",
    label: "Spelling Game",
    description: "Spell words and learn new letters",
    examples: [
      "spell cute animal names",
      "fill in the missing letter",
      "build three-letter words",
    ],
  },
  {
    id: "typing",
    category: "learning",
    label: "Typing Game",
    description: "Type the words before they reach the bottom",
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
