import { z } from "zod";
import type { Vec3 } from "@/lib/world/schema";
import { Vec3Schema } from "@/lib/world/schema";

export const CommandKindSchema = z.enum([
  "house",
  "road",
  "sewer",
  "park",
  "levee",
  "tree",
  "water",
  "path",
  "bridge",
  "school",
  "clinic",
  "pump",
  "generic",
]);
export type CommandKind = z.infer<typeof CommandKindSchema>;

export const SpatialCommandSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: CommandKindSchema,
  position: Vec3Schema.optional(),
  scale: Vec3Schema.optional(),
  rotationY: z.number().optional(),
  createdAt: z.number(),
});
export type SpatialCommand = z.infer<typeof SpatialCommandSchema>;

const KIND_PATTERNS: { kind: CommandKind; re: RegExp }[] = [
  { kind: "house", re: /\b(house|home|building|dwell|residenc|apartment)\b/i },
  { kind: "road", re: /\b(road|street|avenue|lane|highway|boulevard)\b/i },
  { kind: "sewer", re: /\b(sewer|drain|drainage|pipe|wastewater|culvert)\b/i },
  { kind: "park", re: /\b(park|green\s*space|garden|plaza|playground)\b/i },
  { kind: "levee", re: /\b(levee|berm|dyke|dike|embankment|flood\s*wall)\b/i },
  { kind: "tree", re: /\b(tree|trees|forest|orchard)\b/i },
  { kind: "water", re: /\b(pond|canal|lake|reservoir|water\s*feature)\b/i },
  { kind: "path", re: /\b(path|walkway|trail|sidewalk|evac)\b/i },
  { kind: "bridge", re: /\b(bridge|overpass)\b/i },
  { kind: "school", re: /\b(school|classroom|educat)\b/i },
  { kind: "clinic", re: /\b(clinic|hospital|health\s*center)\b/i },
  { kind: "pump", re: /\b(pump|pump\s*station|stormwater)\b/i },
];

export function parseCommandKind(text: string): CommandKind {
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(text)) return kind;
  }
  return "generic";
}

export function parseSpatialCommand(
  text: string,
  position?: Vec3,
  id?: string
): SpatialCommand {
  const trimmed = text.trim();
  return {
    id: id ?? `cmd-${Date.now()}`,
    text: trimmed,
    kind: parseCommandKind(trimmed),
    position,
    createdAt: Date.now(),
  };
}

export function commandLabel(kind: CommandKind, index: number): string {
  const labels: Record<CommandKind, string> = {
    house: `Home ${index}`,
    road: `Road ${index}`,
    sewer: `Sewer line ${index}`,
    park: `Park ${index}`,
    levee: `Levee ${index}`,
    tree: `Tree ${index}`,
    water: `Water ${index}`,
    path: `Path ${index}`,
    bridge: `Bridge ${index}`,
    school: `School ${index}`,
    clinic: `Clinic ${index}`,
    pump: `Pump station ${index}`,
    generic: `Feature ${index}`,
  };
  return labels[kind];
}
