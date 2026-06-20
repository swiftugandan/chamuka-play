import { NextRequest } from "next/server";
import { generateExamples } from "@/lib/ai/examples";
import { getStarter } from "@/lib/games/registry";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("starter") ?? "";
  try {
    const examples = await generateExamples(id);
    return Response.json({ examples });
  } catch (error) {
    console.error("examples error:", error);
    // Fall back to the curated examples so the UI always has suggestions.
    return Response.json({ examples: getStarter(id)?.examples ?? [] });
  }
}
