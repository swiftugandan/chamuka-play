export interface GameStarter {
  id: string;
  label: string;
  description: string;
  /** Kid-friendly example ideas shown as tappable suggestions. */
  examples: string[];
}

export const GAME_STARTERS: GameStarter[] = [
  {
    id: "clicker",
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
    label: "Quiz Game",
    description: "Answer fun multiple-choice questions and keep score",
    examples: [
      "fun animal trivia",
      "guess the dinosaur",
      "cool space facts",
    ],
  },
  {
    id: "drawing",
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
    label: "Memory Game",
    description: "Flip cards to find the matching pairs",
    examples: [
      "match the farm animals",
      "find the matching fruits",
      "match the planets",
    ],
  },
];

export function getStarter(id: string): GameStarter | undefined {
  return GAME_STARTERS.find((s) => s.id === id);
}
