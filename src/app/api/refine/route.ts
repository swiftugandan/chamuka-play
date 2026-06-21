import { NextRequest } from "next/server";
import { refineGame } from "@/lib/ai/games";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { code, instruction } = await req.json();
    const safety = isPromptSafeForKids(instruction);
    if (!safety.safe) {
      return Response.json({ error: safety.reason }, { status: 400 });
    }
    return refineGame({ code, instruction });
  } catch (error) {
    console.error("refine error:", error);
    return Response.json(
      { error: "Failed to change the game" },
      { status: 500 },
    );
  }
}
