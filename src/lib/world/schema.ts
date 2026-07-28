import { z } from "zod";

/** Spatial position in world units (XZ ground plane, Y up). */
export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vec3 = z.infer<typeof Vec3Schema>;

export const EntityKindSchema = z.enum([
  "terrain",
  "building",
  "road",
  "water",
  "vegetation",
  "structure",
  "marker",
  "path",
  "hazard",
  "prop",
]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const WorldEntitySchema = z.object({
  id: z.string(),
  kind: EntityKindSchema,
  label: z.string(),
  position: Vec3Schema,
  scale: Vec3Schema.optional().default({ x: 1, y: 1, z: 1 }),
  rotationY: z.number().optional().default(0),
  color: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
  /** 0–1 flood / risk / damage intensity when applicable */
  intensity: z.number().min(0).max(1).optional(),
});
export type WorldEntity = z.infer<typeof WorldEntitySchema>;
export type WorldEntityInput = z.input<typeof WorldEntitySchema>;

export function makeEntity(input: WorldEntityInput): WorldEntity {
  return WorldEntitySchema.parse(input);
}

export const GoalSchema = z.object({
  id: z.string(),
  text: z.string(),
  priority: z.number().optional().default(1),
  status: z
    .enum(["open", "in_progress", "done", "blocked"])
    .optional()
    .default("open"),
  assignedAgentId: z.string().optional(),
  assignedAgentName: z.string().optional(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const SpatialCommandSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.string(),
  position: Vec3Schema.optional(),
  scale: Vec3Schema.optional(),
  rotationY: z.number().optional(),
  createdAt: z.number(),
});
export type SpatialCommandOnWorld = z.infer<typeof SpatialCommandSchema>;

export const ConstraintSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Optional spatial anchor from click-to-constrain */
  position: Vec3Schema.optional(),
  entityId: z.string().optional(),
  createdAt: z.number(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const AtmosphereSchema = z.object({
  skyColor: z.string().optional().default("#0b1220"),
  fogColor: z.string().optional().default("#0b1220"),
  fogNear: z.number().optional().default(18),
  fogFar: z.number().optional().default(55),
  ambientIntensity: z.number().optional().default(0.45),
  sunColor: z.string().optional().default("#c4d4e8"),
  sunIntensity: z.number().optional().default(1.1),
  groundColor: z.string().optional().default("#1a2332"),
});
export type Atmosphere = z.infer<typeof AtmosphereSchema>;

export const ThemeIdSchema = z.enum(["climate"]);
export type ThemeId = z.infer<typeof ThemeIdSchema>;

/** Typed world blueprint emitted by perceive/plan — never free-form prose into the renderer. */
export const WorldSpecSchema = z.object({
  id: z.string(),
  themeId: ThemeIdSchema,
  title: z.string(),
  summary: z.string(),
  prompt: z.string(),
  atmosphere: AtmosphereSchema.optional().default({}),
  entities: z.array(WorldEntitySchema),
  goals: z.array(GoalSchema),
  constraints: z.array(ConstraintSchema).optional().default([]),
  commands: z.array(SpatialCommandSchema).optional().default([]),
  createdAt: z.number(),
});
export type WorldSpec = z.infer<typeof WorldSpecSchema>;

export const AgentRoleSchema = z.enum([
  "planner",
  "critic",
  "builder",
  "simulator",
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentThoughtSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  role: AgentRoleSchema,
  text: z.string(),
  timestamp: z.number(),
});
export type AgentThought = z.infer<typeof AgentThoughtSchema>;

export const AgentStateSchema = z.object({
  id: z.string(),
  role: AgentRoleSchema,
  name: z.string(),
  color: z.string(),
  position: Vec3Schema,
  status: z.enum(["idle", "thinking", "acting", "done"]),
  currentThought: z.string().optional(),
  trail: z.array(Vec3Schema).optional().default([]),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

export const ActionTypeSchema = z.enum([
  "spawn_entity",
  "update_entity",
  "remove_entity",
  "move_agent",
  "set_goal_status",
  "add_constraint",
  "score_world",
  "think",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const WorldActionSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  agentId: z.string(),
  thought: z.string().optional(),
  entity: WorldEntitySchema.optional(),
  entityId: z.string().optional(),
  patch: z.record(z.unknown()).optional(),
  position: Vec3Schema.optional(),
  goalId: z.string().optional(),
  goalStatus: z.enum(["open", "in_progress", "done", "blocked"]).optional(),
  constraint: ConstraintSchema.optional(),
  score: z
    .object({
      overall: z.number().min(0).max(1),
      notes: z.string(),
    })
    .optional(),
});
export type WorldAction = z.infer<typeof WorldActionSchema>;

export const ActionPlanSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  rationale: z.string(),
  actions: z.array(WorldActionSchema),
  createdAt: z.number(),
});
export type ActionPlan = z.infer<typeof ActionPlanSchema>;

export const WorldEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "world_created",
    "agent_thought",
    "action_applied",
    "constraint_added",
    "score_updated",
    "phase_changed",
  ]),
  message: z.string(),
  timestamp: z.number(),
  payload: z.record(z.unknown()).optional(),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export type SessionPhase =
  | "idle"
  | "perceiving"
  | "building"
  | "planning"
  | "acting"
  | "critiquing"
  | "done";

export interface WorldSession {
  world: WorldSpec;
  agents: AgentState[];
  thoughts: AgentThought[];
  events: WorldEvent[];
  phase: SessionPhase;
  score: { overall: number; notes: string } | null;
  /** Filled by Resilience Critic */
  criticBreakdown?: {
    label: string;
    score: number;
    note: string;
  }[];
  /** Filled by Stress Sim */
  stressSim?: {
    active: boolean;
    floodLevel: number;
    floodRising: boolean;
    people: {
      id: string;
      x: number;
      z: number;
      speed: number;
      phase: number;
      route: "road" | "evac" | "flee";
      color: string;
      stranded: boolean;
    }[];
    survivors: number;
    stranded: number;
    lastReport: string;
    waveTime: number;
  };
  /** Latest planner sequence notes */
  plannerBrief?: string;
}
