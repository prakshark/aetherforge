"use client";

import { create } from "zustand";
import {
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  type TourCamera,
  type TourHighlight,
  type TourHudFocus,
} from "@/lib/tour/steps";
import { useForgeStore } from "@/lib/store/forge-store";
import { CLIMATE_PACK } from "@/lib/world/themes";

interface TourStore {
  active: boolean;
  stepIndex: number;
  locked: boolean;
  camera: TourCamera;
  highlight: TourHighlight;
  hudFocus: TourHudFocus;
  running: boolean;
  /** Plan validity % before the last scripted action. */
  validityBefore: number | null;
  /** Plan validity % after the last scripted action. */
  validityAfter: number | null;
  startTour: () => Promise<void>;
  next: () => Promise<void>;
  endTour: () => void;
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldAutoStartTour(): boolean {
  // Always open into the guided demo — never the idle home screen.
  return true;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readValidityPct(): number | null {
  const score = useForgeStore.getState().session?.score;
  if (!score) return null;
  return Math.round(score.overall * 100);
}

async function runStepAction(action: (typeof TOUR_STEPS)[number]["action"]) {
  const forge = useForgeStore.getState();
  const session = () => useForgeStore.getState().session;

  switch (action) {
    case "none":
      return;
    case "forge": {
      await forge.forge(CLIMATE_PACK.demoPrompt);
      return;
    }
    case "add-house": {
      if (!session()) await forge.forge(CLIMATE_PACK.demoPrompt);
      await forge.submitSiteCommandAt("add a house here", {
        x: -3.5,
        y: 0.2,
        z: -2.2,
      });
      return;
    }
    case "add-sewer": {
      const s = session();
      if (!s) return;
      const agent = s.agents.find((a) => a.role === "builder");
      if (agent) {
        forge.selectAgent(agent.id);
        await forge.assignGoalToAgent(
          agent.id,
          "build a sewer line across the houses"
        );
      }
      return;
    }
    case "agent-planner": {
      const s = session();
      const agent = s?.agents.find((a) => a.role === "planner");
      if (agent) {
        forge.selectAgent(agent.id);
        await forge.assignGoalToAgent(
          agent.id,
          "Sequence a flood-resilience program for this coastal town"
        );
      }
      return;
    }
    case "agent-critic": {
      const s = session();
      const agent = s?.agents.find((a) => a.role === "critic");
      if (agent) {
        forge.selectAgent(agent.id);
        await forge.assignGoalToAgent(
          agent.id,
          "Audit flood exposure, evacuation, and drainage"
        );
      }
      return;
    }
    case "agent-builder": {
      const s = session();
      const agent = s?.agents.find((a) => a.role === "builder");
      if (agent) {
        forge.selectAgent(agent.id);
        await forge.assignGoalToAgent(
          agent.id,
          "Place a living levee along the bay"
        );
      }
      return;
    }
    case "agent-stress": {
      const s = session();
      const agent = s?.agents.find((a) => a.role === "simulator");
      if (agent) {
        forge.selectAgent(agent.id);
        await forge.assignGoalToAgent(
          agent.id,
          "Run a severe storm surge stress test"
        );
      }
      return;
    }
    case "finale":
      await sleep(400);
      return;
  }
}

function applyStepView(step: (typeof TOUR_STEPS)[number]) {
  return {
    camera: step.camera,
    highlight: step.highlight,
    hudFocus: step.hudFocus,
  };
}

/** Prevents double-boot from React Strict Mode / duplicate mounts. */
let bootPromise: Promise<void> | null = null;

export const useTourStore = create<TourStore>((set, get) => ({
  // Start in the demo shell immediately — never flash the idle home page.
  active: true,
  stepIndex: 0,
  locked: true,
  camera: TOUR_STEPS[0].camera,
  highlight: TOUR_STEPS[0].highlight,
  hudFocus: TOUR_STEPS[0].hudFocus,
  running: true,
  validityBefore: null,
  validityAfter: null,

  startTour: async () => {
    // Re-entry while an in-flight boot is running — wait for it.
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
      useForgeStore.getState().reset();
      useForgeStore.getState().closeClickCommand();
      const step = TOUR_STEPS[0];
      set({
        active: true,
        locked: true,
        stepIndex: 0,
        ...applyStepView(step),
        running: true,
        validityBefore: null,
        validityAfter: null,
      });
      try {
        await runStepAction("forge");
        if (!get().active) return;
        set({ validityAfter: readValidityPct() });
      } finally {
        set({ running: false });
      }
    })();

    try {
      await bootPromise;
    } finally {
      bootPromise = null;
    }
  },

  next: async () => {
    if (get().running || !get().active) return;
    const idx = get().stepIndex;
    const step = TOUR_STEPS[idx];
    if (!step) return;

    set({ running: true });
    try {
      const before = readValidityPct();
      await runStepAction(step.action);
      if (!get().active) return;
      const after = readValidityPct();

      set({
        ...applyStepView(step),
        validityBefore: before,
        validityAfter: after,
        // After a build/score step, prefer validity zoom so the % is obvious.
        hudFocus:
          step.showValidityDelta && step.action !== "none"
            ? "validity"
            : step.hudFocus,
      });
      await sleep(step.action === "none" ? 320 : 1100);
      if (!get().active) return;

      const nextIdx = idx + 1;
      if (nextIdx >= TOUR_STEPS.length) {
        get().endTour();
        return;
      }
      const nextStep = TOUR_STEPS[nextIdx];
      set({
        stepIndex: nextIdx,
        ...applyStepView(nextStep),
        // Carry last delta into score-callout steps.
        validityBefore: before,
        validityAfter: after,
      });
    } finally {
      set({ running: false });
    }
  },

  endTour: () => {
    markSeen();
    set({
      active: false,
      locked: false,
      running: false,
      stepIndex: 0,
      highlight: { type: "none" },
      hudFocus: "none",
      camera: TOUR_STEPS[0].camera,
      validityBefore: null,
      validityAfter: null,
    });
  },
}));
