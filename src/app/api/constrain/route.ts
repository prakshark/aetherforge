import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ThemeIdSchema,
  Vec3Schema,
  WorldSpecSchema,
  AgentStateSchema,
} from "@/lib/world/schema";
import {
  addConstraint,
  createSession,
  runPlanOnSession,
} from "@/lib/world/agents";

const BodySchema = z.object({
  world: WorldSpecSchema,
  agents: z.array(AgentStateSchema),
  position: Vec3Schema,
  entityId: z.string().optional(),
  label: z.string().optional(),
  themeId: ThemeIdSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);
    const base = createSession(body.world);
    base.agents = body.agents;
    base.world.goals = body.world.goals;
    base.world.constraints = body.world.constraints;

    const text = body.label
      ? `Fix THIS: prioritize mitigation at “${body.label}”`
      : `Fix THIS point (${body.position.x.toFixed(1)}, ${body.position.z.toFixed(1)})`;

    const constrained = addConstraint(
      base,
      text,
      body.position,
      body.entityId
    );
    const { session, plan } = runPlanOnSession(constrained);
    return NextResponse.json({ session, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
