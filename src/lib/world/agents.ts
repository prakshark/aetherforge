import { v4 as uuid } from "uuid";
import type {
  ActionPlan,
  AgentRole,
  AgentState,
  Constraint,
  Vec3,
  WorldAction,
  WorldEntity,
  WorldSession,
  WorldSpec,
} from "@/lib/world/schema";
import { makeEntity } from "@/lib/world/schema";
import type { SpatialCommand } from "@/lib/world/commands";
import { parseSpatialCommand } from "@/lib/world/commands";
import { buildWorldEntities, scorePlan } from "@/lib/world/builder";
import { enrichCommandPlacement } from "@/lib/world/placement";
import { CLIMATE_PACK } from "@/lib/world/themes";
import {
  builderCommandsFromGoal,
  criticDeepScore,
  emptyStressSim,
  plannerDecompose,
  roleBlurb,
  runStressSimulation,
  stressIntensityFromText,
} from "@/lib/world/roles";

function agentSpawn(role: AgentRole): AgentState {
  const pack = CLIMATE_PACK;
  const offsets: Record<AgentRole, Vec3> = {
    planner: { x: -8, y: 3.2, z: -7 },
    critic: { x: 8, y: 3.2, z: -7 },
    builder: { x: -7, y: 3.2, z: 7 },
    simulator: { x: 7, y: 3.2, z: 6 },
  };
  return {
    id: uuid(),
    role,
    name: pack.agentNames[role],
    color: pack.agentColors[role],
    position: offsets[role],
    status: "idle",
    trail: [],
  };
}

export function spawnAgents(_world: WorldSpec): AgentState[] {
  return (["planner", "critic", "builder", "simulator"] as AgentRole[]).map(
    (role) => agentSpawn(role)
  );
}

export function createSession(world: WorldSpec): WorldSession {
  return {
    world: {
      ...world,
      commands: world.commands ?? [],
    },
    agents: spawnAgents(world),
    thoughts: [],
    events: [
      {
        id: uuid(),
        type: "world_created",
        message: `World forged from: “${world.prompt.slice(0, 72)}”`,
        timestamp: Date.now(),
      },
    ],
    phase: "building",
    score: null,
    stressSim: emptyStressSim(),
    criticBreakdown: [],
    plannerBrief: "",
  };
}

function findAgent(session: WorldSession, role: AgentRole): AgentState {
  return session.agents.find((a) => a.role === role)!;
}

function findAgentById(session: WorldSession, id: string): AgentState | undefined {
  return session.agents.find((a) => a.id === id);
}

function toward(from: Vec3, to: Vec3, t = 0.45): Vec3 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y,
    z: from.z + (to.z - from.z) * t,
  };
}

function regenerateEntities(session: WorldSession): WorldSession {
  const commands = (session.world.commands ?? []) as SpatialCommand[];
  const built = buildWorldEntities(
    session.world.prompt,
    commands,
    session.world.goals
  ).map((e) => makeEntity(e));

  return {
    ...session,
    world: {
      ...session.world,
      entities: built,
      commands,
    },
  };
}

export function applyAction(
  session: WorldSession,
  action: WorldAction
): WorldSession {
  const next: WorldSession = {
    ...session,
    world: {
      ...session.world,
      entities: [...session.world.entities],
      goals: session.world.goals.map((g) => ({ ...g })),
      constraints: [...session.world.constraints],
      commands: [...(session.world.commands ?? [])],
    },
    agents: session.agents.map((a) => ({
      ...a,
      trail: [...a.trail],
    })),
    thoughts: [...session.thoughts],
    events: [...session.events],
    stressSim: session.stressSim
      ? {
          ...session.stressSim,
          people: session.stressSim.people.map((p) => ({ ...p })),
        }
      : emptyStressSim(),
    criticBreakdown: session.criticBreakdown
      ? [...session.criticBreakdown]
      : [],
    plannerBrief: session.plannerBrief,
  };

  const agent = next.agents.find((a) => a.id === action.agentId);

  if (action.thought && agent) {
    agent.currentThought = action.thought;
    agent.status = action.type === "think" ? "thinking" : "acting";
    next.thoughts.push({
      id: uuid(),
      agentId: agent.id,
      role: agent.role,
      text: action.thought,
      timestamp: Date.now(),
    });
    next.events.push({
      id: uuid(),
      type: "agent_thought",
      message: `${agent.name}: ${action.thought}`,
      timestamp: Date.now(),
    });
  }

  switch (action.type) {
    case "spawn_entity":
      if (action.entity) {
        next.world.entities.push(action.entity as WorldEntity);
        next.events.push({
          id: uuid(),
          type: "action_applied",
          message: `Spawned ${action.entity.label}`,
          timestamp: Date.now(),
        });
      }
      break;
    case "update_entity": {
      const idx = next.world.entities.findIndex((e) => e.id === action.entityId);
      if (idx >= 0 && action.patch) {
        next.world.entities[idx] = {
          ...next.world.entities[idx],
          ...action.patch,
          meta: {
            ...(next.world.entities[idx].meta ?? {}),
            ...((action.patch.meta as Record<string, unknown>) ?? {}),
          },
        } as WorldEntity;
        next.events.push({
          id: uuid(),
          type: "action_applied",
          message: `Updated ${next.world.entities[idx].label}`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case "remove_entity":
      next.world.entities = next.world.entities.filter(
        (e) => e.id !== action.entityId
      );
      break;
    case "move_agent":
      if (agent && action.position) {
        agent.trail.push({ ...agent.position });
        if (agent.trail.length > 24) agent.trail.shift();
        agent.position = action.position;
      }
      break;
    case "set_goal_status":
      if (action.goalId && action.goalStatus) {
        const g = next.world.goals.find((x) => x.id === action.goalId);
        if (g) g.status = action.goalStatus;
      }
      break;
    case "add_constraint":
      if (action.constraint) {
        next.world.constraints.push(action.constraint);
      }
      break;
    case "score_world":
      if (action.score) {
        next.score = action.score;
        next.events.push({
          id: uuid(),
          type: "score_updated",
          message: `Plan validity ${(action.score.overall * 100).toFixed(0)}% — ${action.score.notes}`,
          timestamp: Date.now(),
        });
      }
      break;
    default:
      break;
  }

  return next;
}

export function addConstraint(
  session: WorldSession,
  text: string,
  position?: Vec3,
  entityId?: string
): WorldSession {
  const constraint: Constraint = {
    id: uuid(),
    text,
    position,
    entityId,
    createdAt: Date.now(),
  };
  const next = applyAction(session, {
    id: uuid(),
    type: "add_constraint",
    agentId: findAgent(session, "planner").id,
    constraint,
    thought: `Constraint locked: ${text}`,
  });
  next.events.push({
    id: uuid(),
    type: "constraint_added",
    message: text,
    timestamp: Date.now(),
    payload: { position, entityId },
  });
  next.phase = "planning";
  return next;
}

/** Full multi-agent replan with deep role-specific cognition. */
export function planActions(session: WorldSession): ActionPlan {
  const pack = CLIMATE_PACK;
  const planner = findAgent(session, "planner");
  const critic = findAgent(session, "critic");
  const builder = findAgent(session, "builder");
  const sim = findAgent(session, "simulator");
  const actions: WorldAction[] = [];
  const commands = (session.world.commands ?? []) as SpatialCommand[];
  const constraint = session.world.constraints[session.world.constraints.length - 1];
  const lastCmd = commands[commands.length - 1];
  const focus: Vec3 =
    lastCmd?.position ??
    constraint?.position ??
    { x: 2, y: 0.2, z: 4 };

  // --- Harbor Planner ---
  actions.push({
    id: uuid(),
    type: "think",
    agentId: planner.id,
    thought: lastCmd
      ? `Sequencing after site order “${lastCmd.text}”: survey → build → stress → critique.`
      : `Decomposing ${session.world.goals.length} goals into a buildable order.`,
  });
  actions.push({
    id: uuid(),
    type: "move_agent",
    agentId: planner.id,
    position: toward(planner.position, { ...focus, y: 3.2 }),
    thought: "Walking the risk surface — bay fringe first, then Harbor Road.",
  });
  actions.push({
    id: uuid(),
    type: "think",
    agentId: planner.id,
    thought:
      session.plannerBrief ||
      "Priority: protect bay edge, keep road passable, then densify only on high ground.",
  });

  // --- Levee Builder ---
  actions.push({
    id: uuid(),
    type: "think",
    agentId: builder.id,
    thought: `Construction pass: ${commands.length} site edits queued. Pouring/placing aligned works…`,
  });
  actions.push({
    id: uuid(),
    type: "move_agent",
    agentId: builder.id,
    position: { x: focus.x, y: 3.2, z: focus.z + 1 },
    thought: "On-site — staking alignment for the latest order.",
  });
  if (lastCmd) {
    actions.push({
      id: uuid(),
      type: "think",
      agentId: builder.id,
      thought: `Committed ${lastCmd.kind} at (${(lastCmd.position?.x ?? 0).toFixed(1)}, ${(lastCmd.position?.z ?? 0).toFixed(1)}).`,
    });
  }

  // --- Stress Sim ---
  actions.push({
    id: uuid(),
    type: "think",
    agentId: sim.id,
    thought: session.stressSim?.active
      ? `Stress run live: ${session.stressSim.survivors} clear / ${session.stressSim.stranded} stranded under surge.`
      : "Standing by to inject surge + moving population when tasked.",
  });
  actions.push({
    id: uuid(),
    type: "move_agent",
    agentId: sim.id,
    position: toward(sim.position, { ...focus, y: 3.2 }, 0.7),
  });

  if (session.world.goals[0]) {
    actions.push({
      id: uuid(),
      type: "set_goal_status",
      agentId: planner.id,
      goalId: session.world.goals[0].id,
      goalStatus: "in_progress",
      thought: "Marking top-priority goal in progress.",
    });
  }

  const previewEntities = buildWorldEntities(
    session.world.prompt,
    commands,
    session.world.goals
  );
  const deep = criticDeepScore(
    previewEntities.map((e) => makeEntity(e)),
    session.world.goals,
    commands
  );

  // --- Resilience Critic ---
  actions.push({
    id: uuid(),
    type: "think",
    agentId: critic.id,
    thought: `Rubric: ${pack.criticRubric.join(" · ")}`,
  });
  for (const item of deep.breakdown.slice(0, 3)) {
    actions.push({
      id: uuid(),
      type: "think",
      agentId: critic.id,
      thought: `${item.label}: ${Math.round(item.score * 100)}% — ${item.note}`,
    });
  }
  actions.push({
    id: uuid(),
    type: "move_agent",
    agentId: critic.id,
    position: toward(critic.position, { ...focus, y: 3.2 }, 0.5),
  });
  actions.push({
    id: uuid(),
    type: "score_world",
    agentId: critic.id,
    score: { overall: deep.overall, notes: deep.notes },
    thought: `Validity ${(deep.overall * 100).toFixed(0)}%. ${deep.notes}`,
  });

  const assigned = session.world.goals.filter((g) => g.assignedAgentId);
  for (const g of assigned) {
    if (g.status === "open" || g.status === "in_progress") {
      actions.push({
        id: uuid(),
        type: "set_goal_status",
        agentId: g.assignedAgentId!,
        goalId: g.id,
        goalStatus: "done",
        thought: `Closed assigned goal: ${g.text}`,
      });
    }
  }

  return {
    id: uuid(),
    worldId: session.world.id,
    rationale: `Deep multi-agent replan for ${pack.name}`,
    actions,
    createdAt: Date.now(),
  };
}

export function runPlanOnSession(session: WorldSession): {
  session: WorldSession;
  plan: ActionPlan;
} {
  let current: WorldSession = {
    ...regenerateEntities(session),
    phase: "acting",
  };
  current.events = [
    ...current.events,
    {
      id: uuid(),
      type: "phase_changed",
      message: "Replanning — each agent contributing their specialty",
      timestamp: Date.now(),
    },
  ];

  const plan = planActions(current);
  for (const action of plan.actions) {
    current = applyAction(current, action);
  }
  current = regenerateEntities(current);

  const commands = (current.world.commands ?? []) as SpatialCommand[];
  const deep = criticDeepScore(
    current.world.entities,
    current.world.goals,
    commands
  );
  current.score = { overall: deep.overall, notes: deep.notes };
  current.criticBreakdown = deep.breakdown;

  // Keep stress sim people/flood if already active; refresh report against new geometry
  if (current.stressSim?.active) {
    const refreshed = runStressSimulation(
      current.world.entities,
      current.stressSim.floodLevel > 0.7
        ? "severe"
        : current.stressSim.floodLevel > 0.4
          ? "moderate"
          : "light"
    );
    current.stressSim = {
      ...refreshed,
      active: true,
      floodRising: true,
    };
  }

  current.phase = "done";
  current.agents = current.agents.map((a) => ({
    ...a,
    status: "done" as const,
  }));
  return { session: current, plan };
}

export function applySpatialCommand(
  session: WorldSession,
  text: string,
  position: Vec3
): WorldSession {
  const raw = parseSpatialCommand(text, position, uuid());
  const cmd = enrichCommandPlacement(raw, session.world.entities, position);
  const builder = findAgent(session, "builder");
  const planner = findAgent(session, "planner");

  let next: WorldSession = {
    ...session,
    world: {
      ...session.world,
      commands: [...(session.world.commands ?? []), cmd],
      constraints: [
        ...session.world.constraints,
        {
          id: uuid(),
          text: `Site order: ${text}`,
          position: cmd.position,
          createdAt: Date.now(),
        },
      ],
    },
    phase: "planning",
    events: [
      ...session.events,
      {
        id: uuid(),
        type: "constraint_added",
        message: `Site order (${cmd.kind}) placed from “${text}”`,
        timestamp: Date.now(),
      },
    ],
  };

  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: planner.id,
    thought: `Site order received. Sequencing Builder for ${cmd.kind}, then Critic + Stress Sim.`,
  });
  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: builder.id,
    thought: `Laying ${cmd.kind} on resolved alignment — regenerating map.`,
  });

  return next;
}

/**
 * Role-deep assignment:
 * - Planner → decomposes into sub-goals (no random builds)
 * - Critic → deep score + breakdown (no builds)
 * - Builder → places infrastructure commands
 * - Stress Sim → flood animation + moving people
 */
export function assignAgentGoal(
  session: WorldSession,
  agentId: string,
  goalText: string
): WorldSession {
  const agent = findAgentById(session, agentId);
  if (!agent) return session;

  const text = goalText.trim();
  const parentGoal = {
    id: uuid(),
    text,
    priority: 1,
    status: "in_progress" as const,
    assignedAgentId: agent.id,
    assignedAgentName: agent.name,
  };

  let next: WorldSession = {
    ...session,
    world: {
      ...session.world,
      goals: [...session.world.goals, parentGoal],
    },
    phase: "planning",
    events: [
      ...session.events,
      {
        id: uuid(),
        type: "phase_changed",
        message: `${agent.name} engaged — ${roleBlurb(agent.role)}`,
        timestamp: Date.now(),
      },
    ],
  };

  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: agent.id,
    thought: `Accepted: “${text}”. ${roleBlurb(agent.role)}`,
  });

  if (agent.role === "planner") {
    const subs = plannerDecompose(text).map((g) => ({
      ...g,
      assignedAgentId: agent.id,
      assignedAgentName: agent.name,
    }));
    next.world.goals = [...next.world.goals, ...subs];
    next.plannerBrief = subs.map((s, i) => `${i + 1}. ${s.text}`).join(" | ");
    next = applyAction(next, {
      id: uuid(),
      type: "think",
      agentId: agent.id,
      thought: `Decomposed into ${subs.length} sequenced sub-goals. Builder/Critic should execute next.`,
    });
    for (const s of subs.slice(0, 3)) {
      next = applyAction(next, {
        id: uuid(),
        type: "think",
        agentId: agent.id,
        thought: `Plan step: ${s.text}`,
      });
    }
    next = applyAction(next, {
      id: uuid(),
      type: "move_agent",
      agentId: agent.id,
      position: { x: 0, y: 3.2, z: -2 },
    });
    return next;
  }

  if (agent.role === "critic") {
    const deep = criticDeepScore(
      next.world.entities,
      next.world.goals,
      (next.world.commands ?? []) as SpatialCommand[]
    );
    next.criticBreakdown = deep.breakdown;
    next.score = { overall: deep.overall, notes: deep.notes };
    // Mild flood viz to show exposure without full stress run
    next.stressSim = {
      ...(next.stressSim ?? emptyStressSim()),
      active: next.stressSim?.active ?? false,
      floodLevel: Math.max(next.stressSim?.floodLevel ?? 0.2, 0.35),
      floodRising: false,
      people: next.stressSim?.people ?? [],
      survivors: next.stressSim?.survivors ?? 0,
      stranded: next.stressSim?.stranded ?? 0,
      lastReport: deep.notes,
      waveTime: Date.now(),
    };
    next = applyAction(next, {
      id: uuid(),
      type: "score_world",
      agentId: agent.id,
      score: { overall: deep.overall, notes: deep.notes },
      thought: `Full audit complete. Validity ${(deep.overall * 100).toFixed(0)}%.`,
    });
    for (const item of deep.breakdown) {
      next = applyAction(next, {
        id: uuid(),
        type: "think",
        agentId: agent.id,
        thought: `${item.label}: ${Math.round(item.score * 100)}% — ${item.note}`,
      });
    }
    next = applyAction(next, {
      id: uuid(),
      type: "set_goal_status",
      agentId: agent.id,
      goalId: parentGoal.id,
      goalStatus: "done",
    });
    return next;
  }

  if (agent.role === "builder") {
    const cmds = builderCommandsFromGoal(text, next.world.entities);
    next.world.commands = [...(next.world.commands ?? []), ...cmds];
    next = applyAction(next, {
      id: uuid(),
      type: "think",
      agentId: agent.id,
      thought: `Issuing ${cmds.length} construction order(s): ${cmds.map((c) => c.kind).join(", ")}.`,
    });
    for (const c of cmds) {
      next = applyAction(next, {
        id: uuid(),
        type: "think",
        agentId: agent.id,
        thought: `Staking ${c.kind} — “${c.text}” @ (${(c.position?.x ?? 0).toFixed(1)}, ${(c.position?.z ?? 0).toFixed(1)})`,
      });
    }
    next = applyAction(next, {
      id: uuid(),
      type: "move_agent",
      agentId: agent.id,
      position: {
        x: cmds[0]?.position?.x ?? 0,
        y: 3.2,
        z: cmds[0]?.position?.z ?? 0,
      },
    });
    return next;
  }

  // Stress Sim
  const intensity = stressIntensityFromText(text);
  const sim = runStressSimulation(next.world.entities, intensity);
  next.stressSim = sim;
  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: agent.id,
    thought: `Injecting ${intensity} surge. Spawning ${sim.people.length} people on roads/evac routes.`,
  });
  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: agent.id,
    thought: sim.lastReport,
  });
  next = applyAction(next, {
    id: uuid(),
    type: "think",
    agentId: agent.id,
    thought: `Outcomes — survivors ${sim.survivors}, stranded ${sim.stranded}, flood level ${(sim.floodLevel * 100).toFixed(0)}%.`,
  });
  next = applyAction(next, {
    id: uuid(),
    type: "move_agent",
    agentId: agent.id,
    position: { x: 2, y: 3.2, z: 4 },
  });
  next = applyAction(next, {
    id: uuid(),
    type: "set_goal_status",
    agentId: agent.id,
    goalId: parentGoal.id,
    goalStatus: "done",
  });
  // Nudge critic score from stress outcomes
  const stressPenalty = sim.stranded / Math.max(1, sim.people.length);
  const base = next.score?.overall ?? 0.55;
  next.score = {
    overall: Math.max(0.15, base - stressPenalty * 0.25),
    notes: `Stress Sim (${intensity}): ${sim.lastReport}`,
  };

  return next;
}
