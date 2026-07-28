import { NextResponse } from "next/server";
import { z } from "zod";
import { ThemeIdSchema } from "@/lib/world/schema";
import { perceiveWorld } from "@/lib/world/perceive";
import {
  createSession,
  runPlanOnSession,
} from "@/lib/world/agents";

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  themeId: ThemeIdSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);
    const world = perceiveWorld(body.prompt, body.themeId);
    const session = createSession(world);
    const { session: acted, plan } = runPlanOnSession(session);
    return NextResponse.json({ session: acted, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
