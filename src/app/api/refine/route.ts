import { NextRequest } from "next/server";
import { streamRefineGame } from "@/lib/ai/games";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { code, instruction } = await req.json();
    return streamRefineGame({ code, instruction });
  } catch (error) {
    console.error("refine error:", error);
    return Response.json(
      { error: "Failed to change the game" },
      { status: 500 },
    );
  }
}
