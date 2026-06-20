import { NextRequest } from "next/server";
import { streamGenerateGame } from "@/lib/ai/games";
import { isPromptSafeForKids } from "@/lib/safety/kidSafety";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { starterId, prompt } = await req.json();
    const safety = isPromptSafeForKids(prompt);
    if (!safety.safe) {
      return Response.json({ error: safety.reason }, { status: 400 });
    }
    return streamGenerateGame({ starterId, prompt });
  } catch (error) {
    console.error("generate error:", error);
    return Response.json(
      { error: "Failed to make the game" },
      { status: 500 },
    );
  }
}
