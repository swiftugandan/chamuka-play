import { NextRequest, NextResponse } from "next/server";
import { generateGame } from "@/lib/ai/games";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

export async function POST(req: NextRequest) {
  try {
    const { starterId, prompt } = await req.json();
    const safety = isPromptSafeForKids(prompt);
    if (!safety.safe) {
      return NextResponse.json({ error: safety.reason }, { status: 400 });
    }
    const game = await generateGame({ starterId, prompt });
    return NextResponse.json(game);
  } catch (error) {
    console.error("generate error:", error);
    return NextResponse.json(
      { error: "Failed to make the game" },
      { status: 500 },
    );
  }
}
