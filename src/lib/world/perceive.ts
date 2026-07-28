import { v4 as uuid } from "uuid";
import type { ThemeId, WorldSpec } from "@/lib/world/schema";
import { makeEntity, WorldSpecSchema } from "@/lib/world/schema";
import type { SpatialCommand } from "@/lib/world/commands";
import { buildWorldEntities } from "@/lib/world/builder";
import { CLIMATE_PACK } from "@/lib/world/themes";

export function perceiveWorld(
  prompt: string,
  _themeId?: ThemeId,
  commands: SpatialCommand[] = [],
  extraGoals: { id: string; text: string; priority: number }[] = []
): WorldSpec {
  const pack = CLIMATE_PACK;
  const now = Date.now();
  const goals = [
    ...pack.seedGoals(prompt).map((g) => ({
      ...g,
      status: "open" as const,
    })),
    ...extraGoals.map((g) => ({
      ...g,
      status: "open" as const,
    })),
  ];
  const entities = buildWorldEntities(prompt, commands, goals).map((e) =>
    makeEntity(e)
  );

  return WorldSpecSchema.parse({
    id: uuid(),
    themeId: "climate",
    title: pack.name,
    summary: pack.tagline,
    prompt,
    atmosphere: pack.atmosphere,
    entities,
    goals,
    constraints: [],
    commands,
    createdAt: now,
  });
}
