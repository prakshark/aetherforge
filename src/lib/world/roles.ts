import { v4 as uuid } from "uuid";
import type {
  AgentRole,
  AgentState,
  Goal,
  Vec3,
  WorldEntity,
  WorldSession,
} from "@/lib/world/schema";
import type { SpatialCommand } from "@/lib/world/commands";
import { parseSpatialCommand } from "@/lib/world/commands";
import { enrichCommandPlacement } from "@/lib/world/placement";
import { scorePlan } from "@/lib/world/builder";

export interface CrowdPerson {
  id: string;
  x: number;
  z: number;
  speed: number;
  phase: number;
  route: "road" | "evac" | "flee";
  color: string;
  stranded: boolean;
}

export interface CriticBreakdownItem {
  label: string;
  score: number;
  note: string;
}

export interface StressSimState {
  active: boolean;
  floodLevel: number;
  floodRising: boolean;
  people: CrowdPerson[];
  survivors: number;
  stranded: number;
  lastReport: string;
  waveTime: number;
}

export function emptyStressSim(): StressSimState {
  return {
    active: false,
    floodLevel: 0.15,
    floodRising: false,
    people: [],
    survivors: 0,
    stranded: 0,
    lastReport: "",
    waveTime: 0,
  };
}

function houses(entities: WorldEntity[]) {
  return entities.filter((e) => e.kind === "building");
}

function roads(entities: WorldEntity[]) {
  return entities.filter((e) => e.kind === "road");
}

function hasLevee(entities: WorldEntity[]) {
  return entities.some((e) => /levee/i.test(e.label));
}

function hasEvac(entities: WorldEntity[]) {
  return entities.some((e) => e.kind === "path");
}

function hasSewer(entities: WorldEntity[]) {
  return entities.some((e) => e.meta?.infra === "sewer" || /sewer/i.test(e.label));
}

function floodedHomes(entities: WorldEntity[]) {
  return houses(entities).filter(
    (e) => (e.intensity ?? 0) > 0.35 || Boolean(e.meta?.flooded)
  );
}

/** Deep critic scoring with per-rubric breakdown. */
export function criticDeepScore(
  entities: WorldEntity[],
  goals: Goal[],
  commands: SpatialCommand[]
): {
  overall: number;
  notes: string;
  breakdown: CriticBreakdownItem[];
} {
  const base = scorePlan(entities, goals, commands);
  const flooded = floodedHomes(entities).length;
  const totalHomes = Math.max(1, houses(entities).length);
  const exposure = 1 - flooded / totalHomes;
  const evac = hasEvac(entities) ? 0.9 : 0.25;
  const levee = hasLevee(entities) ? 0.88 : 0.3;
  const drainage = hasSewer(entities) ? 0.8 : 0.35;
  const roadWet = entities.some(
    (e) => e.kind === "road" && (e.intensity ?? 0) > 0.35
  );
  const access = roadWet ? 0.4 : 0.85;

  const breakdown: CriticBreakdownItem[] = [
    {
      label: "Flood exposure",
      score: exposure,
      note: `${flooded}/${totalHomes} homes in flood fringe`,
    },
    {
      label: "Evacuation clarity",
      score: evac,
      note: hasEvac(entities)
        ? "Evac spine present"
        : "No continuous evac path",
    },
    {
      label: "Levee / buffer",
      score: levee,
      note: hasLevee(entities) ? "Bay-side levee detected" : "Bay edge unprotected",
    },
    {
      label: "Drainage",
      score: drainage,
      note: hasSewer(entities) ? "Sewer trunk in place" : "No sewer trunk",
    },
    {
      label: "Road access",
      score: access,
      note: roadWet ? "Harbor Road still flood-prone" : "Primary roads passable",
    },
  ];

  const overall =
    breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length * 0.7 +
    base.overall * 0.3;

  const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0];
  return {
    overall: Math.max(0.18, Math.min(0.97, overall)),
    notes: `Weakest: ${weakest.label} (${Math.round(weakest.score * 100)}%) — ${weakest.note}`,
    breakdown,
  };
}

/** Planner: decompose a human goal into ordered sub-goals (no random builds). */
export function plannerDecompose(goalText: string): Goal[] {
  const t = goalText.toLowerCase();
  const subs: string[] = [];

  if (/flood|surge|storm|resilien/i.test(t)) {
    subs.push("Survey bay-side flood fringe and Harbor Road risk");
    subs.push("Prioritize protective works (levee / pump) before densifying homes");
  }
  if (/sewer|drain/i.test(t)) {
    subs.push("Align sewer trunk to serve the housing cluster");
  }
  if (/levee|berm|dyke|dike/i.test(t)) {
    subs.push("Place living levee along the bay interface");
  }
  if (/evac|escape|egress|path/i.test(t)) {
    subs.push("Ensure continuous high-ground evacuation spine");
  }
  if (/house|home|housing|neighborhood/i.test(t)) {
    subs.push("Keep new housing outside the active flood fringe");
  }
  if (/road|street/i.test(t)) {
    subs.push("Keep Harbor Road passable under surge conditions");
  }
  if (subs.length === 0) {
    subs.push(`Scope & sequence work for: ${goalText}`);
    subs.push("Identify dependencies before construction");
    subs.push("Hand off build items to Levee Builder; validation to Critic");
  } else {
    subs.push("Hand sequenced build tasks to Levee Builder");
    subs.push("Request Resilience Critic score after construction");
  }

  return subs.map((text, i) => ({
    id: uuid(),
    text,
    priority: i + 1,
    status: i === 0 ? ("in_progress" as const) : ("open" as const),
  }));
}

/** Builder: turn goal text into placed infrastructure commands. */
export function builderCommandsFromGoal(
  goalText: string,
  entities: WorldEntity[]
): SpatialCommand[] {
  const t = goalText.toLowerCase();
  const cmds: SpatialCommand[] = [];

  const push = (text: string) => {
    const raw = parseSpatialCommand(text, undefined, uuid());
    cmds.push(enrichCommandPlacement(raw, entities));
  };

  // Multi-part builds when the brief is broad
  if (/resilien|protect|flood-proof|harden/i.test(t)) {
    push("living levee along the bay");
    push("sewer line across the houses");
    push("evacuation path through the neighborhood");
    return cmds;
  }

  if (/sewer|drain/i.test(t)) push(goalText);
  if (/levee|berm|dyke|dike|flood\s*wall/i.test(t)) push(goalText);
  if (/\broad\b|street|avenue/i.test(t)) push(goalText);
  if (/house|home|building/i.test(t) && !/across the houses/i.test(t))
    push(goalText);
  if (/park|green/i.test(t)) push(goalText);
  if (/pump/i.test(t)) push(goalText);
  if (/path|evac|escape/i.test(t)) push(goalText);
  if (/bridge/i.test(t)) push(goalText);
  if (/school/i.test(t)) push(goalText);
  if (/clinic/i.test(t)) push(goalText);

  if (cmds.length === 0) {
    // Default builder interpretation: protective works near houses
    push(goalText);
  }

  return cmds;
}

function pickRoutePoint(
  entities: WorldEntity[],
  route: CrowdPerson["route"],
  i: number
): Vec3 {
  const road = roads(entities)[0];
  const evac = entities.find((e) => e.kind === "path");
  const bay = entities.find((e) => e.kind === "water");
  if (route === "evac" && evac) {
    return {
      x: evac.position.x + ((i % 5) - 2) * 0.4,
      y: 0.2,
      z: evac.position.z + ((i % 7) - 3) * 0.8,
    };
  }
  if (route === "flee" && bay) {
    return {
      x: bay.position.x + ((i % 6) - 3) * 1.2,
      y: 0.2,
      z: bay.position.z - 4 - (i % 3),
    };
  }
  if (road) {
    return {
      x: road.position.x + ((i % 9) - 4) * 1.5,
      y: 0.2,
      z: road.position.z + ((i % 2) === 0 ? 0.6 : -0.6),
    };
  }
  return { x: ((i % 8) - 4) * 1.5, y: 0.2, z: ((i % 5) - 2) * 1.2 };
}

/** Stress Sim: spawn walking people + flood pulse; compute stranded vs survivors. */
export function runStressSimulation(
  entities: WorldEntity[],
  intensity: "light" | "moderate" | "severe" = "moderate"
): StressSimState {
  const count = intensity === "light" ? 10 : intensity === "severe" ? 22 : 16;
  const colors = ["#f0d060", "#ffb4a2", "#bde0fe", "#caffbf", "#ffc6ff", "#e8c36a"];
  const levee = hasLevee(entities);
  const evac = hasEvac(entities);
  const flooded = floodedHomes(entities).length;

  const people: CrowdPerson[] = [];
  for (let i = 0; i < count; i++) {
    const route: CrowdPerson["route"] =
      evac && i % 3 === 0 ? "evac" : i % 5 === 0 ? "flee" : "road";
    const start = pickRoutePoint(entities, route, i);
    // Higher flood + no levee → more stranded
    const risk =
      (intensity === "severe" ? 0.55 : intensity === "moderate" ? 0.35 : 0.2) +
      flooded * 0.04 -
      (levee ? 0.25 : 0) -
      (evac ? 0.12 : 0);
    const stranded = Math.random() < Math.max(0.05, Math.min(0.75, risk));
    people.push({
      id: uuid(),
      x: start.x,
      z: start.z,
      speed: 0.6 + (i % 5) * 0.12,
      phase: i * 0.7,
      route: stranded ? "flee" : route,
      color: colors[i % colors.length],
      stranded,
    });
  }

  const strandedN = people.filter((p) => p.stranded).length;
  const survivors = people.length - strandedN;
  const floodLevel =
    intensity === "severe" ? 0.85 : intensity === "moderate" ? 0.55 : 0.32;

  return {
    active: true,
    floodLevel,
    floodRising: true,
    people,
    survivors,
    stranded: strandedN,
    waveTime: Date.now(),
    lastReport: levee
      ? `Surge ${intensity}: ${survivors}/${people.length} reached high ground. Levee holding — ${strandedN} still in fringe.`
      : `Surge ${intensity}: ${strandedN}/${people.length} stranded in flood fringe. No levee — evac ${evac ? "partially used" : "missing"}.`,
  };
}

export function stressIntensityFromText(
  text: string
): "light" | "moderate" | "severe" {
  const t = text.toLowerCase();
  if (/severe|worst|catastrophic|extreme|100.?year/i.test(t)) return "severe";
  if (/light|mild|small|drizzle/i.test(t)) return "light";
  return "moderate";
}

export function roleBlurb(role: AgentRole): string {
  switch (role) {
    case "planner":
      return "Sequences resilience work into ordered goals — does not pour concrete.";
    case "critic":
      return "Scores exposure, evac, levee, drainage, and access — finds the weakest link.";
    case "builder":
      return "Places real infrastructure on the map from your orders.";
    case "simulator":
      return "Runs flood stress with moving people and animated surge water.";
  }
}

export function findAgentByRole(
  agents: AgentState[],
  role: AgentRole
): AgentState | undefined {
  return agents.find((a) => a.role === role);
}
