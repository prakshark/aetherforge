"use client";

import { create } from "zustand";
import type {
  SessionPhase,
  Vec3,
  WorldEvent,
  WorldSession,
} from "@/lib/world/schema";
import {
  applySpatialCommand,
  assignAgentGoal,
  createSession,
  runPlanOnSession,
} from "@/lib/world/agents";
import { perceiveWorld } from "@/lib/world/perceive";

export interface PendingClick {
  position: Vec3;
  entityId?: string;
  label?: string;
  screen?: { x: number; y: number };
}

interface ForgeStore {
  prompt: string;
  session: WorldSession | null;
  busy: boolean;
  selectedEntityId: string | null;
  selectedAgentId: string | null;
  pendingClick: PendingClick | null;
  setPrompt: (p: string) => void;
  selectAgent: (id: string | null) => void;
  openClickCommand: (pending: PendingClick) => void;
  closeClickCommand: () => void;
  forge: (prompt?: string) => Promise<void>;
  submitSiteCommand: (text: string) => Promise<void>;
  /** Tour / scripted placement — no click UI required. */
  submitSiteCommandAt: (text: string, position: Vec3) => Promise<void>;
  assignGoalToAgent: (agentId: string, goalText: string) => Promise<void>;
  reset: () => void;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runReplan(session: WorldSession, set: (p: Partial<ForgeStore>) => void) {
  set({ session: { ...session, phase: "planning" }, busy: true });
  await sleep(280);
  set({ session: { ...session, phase: "acting" } });
  const { session: acted } = runPlanOnSession(session);
  set({ session: { ...acted, phase: "critiquing" } });
  await sleep(220);
  set({ session: { ...acted, phase: "done" }, busy: false });
}

export const useForgeStore = create<ForgeStore>((set, get) => ({
  prompt: "",
  session: null,
  busy: false,
  selectedEntityId: null,
  selectedAgentId: null,
  pendingClick: null,

  setPrompt: (p) => set({ prompt: p }),
  selectAgent: (id) => set({ selectedAgentId: id }),
  openClickCommand: (pending) => set({ pendingClick: pending }),
  closeClickCommand: () => set({ pendingClick: null }),

  reset: () =>
    set({
      session: null,
      busy: false,
      selectedEntityId: null,
      selectedAgentId: null,
      pendingClick: null,
    }),

  forge: async (overridePrompt) => {
    const prompt = (overridePrompt ?? get().prompt).trim();
    if (!prompt || get().busy) return;
    set({ busy: true, prompt, pendingClick: null });

    const world = perceiveWorld(prompt, "climate");
    let session = createSession(world);
    session = { ...session, phase: "perceiving" };
    set({ session, busy: true });
    await sleep(350);

    session = { ...session, phase: "building" };
    set({ session });
    await sleep(350);

    await runReplan(session, set);
  },

  submitSiteCommand: async (text) => {
    const { session, busy, pendingClick } = get();
    if (!session || busy || !pendingClick || !text.trim()) return;

    set({
      busy: true,
      selectedEntityId: pendingClick.entityId ?? null,
      pendingClick: null,
    });

    const prepared = applySpatialCommand(
      session,
      text.trim(),
      pendingClick.position
    );
    await runReplan(prepared, set);
  },

  submitSiteCommandAt: async (text, position) => {
    const { session, busy } = get();
    if (!session || busy || !text.trim()) return;
    set({ busy: true, pendingClick: null });
    const prepared = applySpatialCommand(session, text.trim(), position);
    await runReplan(prepared, set);
  },

  assignGoalToAgent: async (agentId, goalText) => {
    const { session, busy } = get();
    if (!session || busy || !goalText.trim()) return;
    set({ busy: true, selectedAgentId: agentId });

    const prepared = assignAgentGoal(session, agentId, goalText.trim());
    await runReplan(prepared, set);
  },
}));

export function latestEvents(events: WorldEvent[], n = 10) {
  return events.slice(-n).reverse();
}

export function phaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case "idle":
      return "Idle";
    case "perceiving":
      return "Perceiving intent";
    case "building":
      return "Forging world";
    case "planning":
      return "Replanning map";
    case "acting":
      return "Agents acting";
    case "critiquing":
      return "Scoring validity";
    case "done":
      return "Live";
  }
}
