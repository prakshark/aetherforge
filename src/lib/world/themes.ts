import type { Atmosphere, ThemeId } from "@/lib/world/schema";

export interface ThemePack {
  id: ThemeId;
  name: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  placeholder: string;
  demoPrompt: string;
  agentNames: {
    planner: string;
    critic: string;
    builder: string;
    simulator: string;
  };
  agentColors: {
    planner: string;
    critic: string;
    builder: string;
    simulator: string;
  };
  atmosphere: Atmosphere;
  seedGoals: (prompt: string) => { id: string; text: string; priority: number }[];
  criticRubric: string[];
}

export const CLIMATE_PACK: ThemePack = {
  id: "climate",
  name: "Aetherforge",
  tagline: "Design flood-resilient neighborhoods you can walk through",
  accent: "#3db8a0",
  accentSoft: "rgba(61, 184, 160, 0.18)",
  placeholder: "Build a flood-resilient neighborhood for this coastal town…",
  demoPrompt:
    "Build a flood-resilient neighborhood for a low-lying coastal town facing rising storm surge",
  agentNames: {
    planner: "Harbor Planner",
    critic: "Resilience Critic",
    builder: "Levee Builder",
    simulator: "Stress Sim",
  },
  agentColors: {
    planner: "#5ec8ff",
    critic: "#ff8b6b",
    builder: "#3db8a0",
    simulator: "#e8c36a",
  },
  atmosphere: {
    skyColor: "#0a1620",
    fogColor: "#0a1620",
    fogNear: 16,
    fogFar: 50,
    ambientIntensity: 0.4,
    sunColor: "#a8c4d8",
    sunIntensity: 1.0,
    groundColor: "#1a2830",
  },
  seedGoals: (prompt) => [
    { id: "g1", text: "Reduce flood risk on Harbor Road", priority: 1 },
    { id: "g2", text: "Protect homes nearest the bay", priority: 2 },
    {
      id: "g3",
      text: `Satisfy brief: ${prompt.slice(0, 80)}`,
      priority: 1,
    },
  ],
  criticRubric: [
    "Flood exposure of buildings",
    "Evacuation path clarity",
    "Green buffer / levee coverage",
  ],
};

export const THEME_PACKS = { climate: CLIMATE_PACK } as const;
export const THEME_LIST = [CLIMATE_PACK];

export function detectTheme(): "climate" {
  return "climate";
}
