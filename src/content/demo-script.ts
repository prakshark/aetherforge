/** 90-second demo script + flaky WiFi fallback notes for hackathon judging. */

export const DEMO_SCRIPT = {
  title: "Aetherforge — 90s pitch",
  durationSec: 90,
  beats: [
    {
      t: "0:00–0:10",
      say: "Most AI demos are chat boxes. Aetherforge makes intelligence spatial — you watch agents think and rebuild a world in real time.",
      do: "Show empty hero with brand Aetherforge.",
    },
    {
      t: "0:10–0:25",
      say: "Watch: I’ll ask for a flood-resilient coastal neighborhood.",
      do: "Click Try demo (or voice). World rises — bay, homes, flooded Harbor Road.",
    },
    {
      t: "0:25–0:45",
      say: "Four AI agents: Harbor Planner sequences work, Resilience Critic scores risk, Levee Builder places infrastructure, Stress Sim runs flood + moving people.",
      do: "Point at holograms / HUD cognition feed.",
    },
    {
      t: "0:45–1:05",
      say: "Human-in-the-loop: I click the flooded street — that injects a spatial constraint. The swarm replans a living levee and evacuation spine live.",
      do: "Click Harbor Road or flood hazard. Show levee + gold path + critic score jump.",
    },
    {
      t: "1:05–1:30",
      say: "That’s Aetherforge — spatial multi-agent design for climate resilience, with a critic that scores and self-corrects.",
      do: "Close on critic score + live URL.",
    },
  ],
  fallbackRecording: [
    "If WiFi dies: open a pre-recorded screen capture of the Demo click + Harbor Road constrain loop (60–75s).",
    "Keep this page open on localhost from a phone hotspot if venue WiFi flakes.",
    "API routes /api/forge and /api/constrain work fully offline (deterministic agents) — no cloud LLM required for the core demo.",
    "Voice is optional; Try demo button is the reliable path on stage.",
    "Backup: narrate over a looping local video while the live app recovers.",
  ],
  stageChecklist: [
    "Run npm run dev; warm the page once before judges arrive",
    "Try demo button works without typing",
    "Click-to-constrain verified on Harbor Road",
    "Fallback MP4 on USB / desktop",
  ],
} as const;
