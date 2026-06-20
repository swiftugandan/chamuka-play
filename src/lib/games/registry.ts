export interface GameStarter {
  id: string;
  label: string;
  description: string;
}

export const GAME_STARTERS: GameStarter[] = [
  {
    id: "clicker",
    label: "Clicker Game",
    description: "Tap or click to score before time runs out",
  },
  {
    id: "catch",
    label: "Catch Game",
    description: "Move side to side to catch things falling from the top",
  },
  {
    id: "maze",
    label: "Maze Game",
    description: "Guide a character through a maze to the goal",
  },
  {
    id: "quiz",
    label: "Quiz Game",
    description: "Answer fun multiple-choice questions and keep score",
  },
  {
    id: "drawing",
    label: "Drawing Toy",
    description: "A playful canvas to draw with colours and brushes",
  },
];

export function getStarter(id: string): GameStarter | undefined {
  return GAME_STARTERS.find((s) => s.id === id);
}
