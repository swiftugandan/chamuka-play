import { NextRequest, NextResponse } from "next/server";
import { refineGame } from "@/lib/ai/games";

export async function POST(req: NextRequest) {
  try {
    const { code, instruction } = await req.json();
    const game = await refineGame({ code, instruction });
    return NextResponse.json(game);
  } catch (error) {
    console.error("refine error:", error);
    return NextResponse.json(
      { error: "Failed to change the game" },
      { status: 500 },
    );
  }
}
