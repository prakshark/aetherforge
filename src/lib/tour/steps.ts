export type TourCamera = {
  position: [number, number, number];
  target: [number, number, number];
};

export type TourAction =
  | "none"
  | "forge"
  | "add-house"
  | "add-sewer"
  | "agent-planner"
  | "agent-critic"
  | "agent-builder"
  | "agent-stress"
  | "finale";

export type TourHighlight =
  | { type: "kind"; kinds: string[] }
  | { type: "label"; labels: string[] }
  | { type: "command-kind"; kinds: string[] }
  | { type: "none" };

/** Which HUD panel to zoom / spotlight during this step. */
export type TourHudFocus = "none" | "goals" | "cognition" | "validity";

export interface TourStep {
  id: string;
  chapter: string;
  title: string;
  body: string[];
  camera: TourCamera;
  highlight: TourHighlight;
  hudFocus: TourHudFocus;
  /** After this step’s action, call out plan-validity % change. */
  showValidityDelta?: boolean;
  /** Runs when user clicks Next *on this step* (before advancing). */
  action: TourAction;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "physics",
    chapter: "0 · Physics & AI",
    title: "How Aetherforge thinks",
    body: [
      "Aetherforge is a spatial multi-agent system. Your brief becomes a typed WorldSpec (JSON) — entities, goals, and site orders — never free-form text dumped into the 3D engine.",
      "Four specialist agents share one world state: Harbor Planner sequences work, Levee Builder mutates geometry, Resilience Critic scores risk rubrics, and Stress Sim injects surge physics with moving people.",
      "Whatever you type — a forge brief, a map order, or an agent ask — shows up as a goal with a live status (pending → active → done) so you can track what the swarm is working on.",
    ],
    camera: { position: [22, 16, 24], target: [0, 0.5, 1] },
    highlight: { type: "none" },
    hudFocus: "none",
    action: "none",
  },
  {
    id: "goals-panel",
    chapter: "0 · Goals HUD",
    title: "Zoom: Goals & status",
    body: [
      "Look at the Goals panel on the left — every prompt and site order lands here with a status pill.",
      "Agents pick up those goals from the color-coded dropdown below. Cognition on the right narrates what they decide.",
      "Plan validity % (bottom-right) is the critic’s score of how resilient the layout is. It rises as you add good infrastructure.",
      "We’ll zoom that score after each build so you can see the lift.",
    ],
    camera: { position: [20, 14, 20], target: [0, 0.5, 0] },
    highlight: { type: "none" },
    hudFocus: "goals",
    action: "none",
  },
  {
    id: "layout",
    chapter: "1 · City layout",
    title: "What you are looking at",
    body: [
      "Houses & townhomes fill the blocks between streets.",
      "Shops and a fish hall sit on Harbor Road; Harbor School and a clinic are civic anchors.",
      "Trees line the sidewalks; a community park holds one block.",
      "Water — Harbor Bay plus a tide canal — is a real basin with shore foam, depth bands, and a pier.",
      "Sewage and levees show up when ordered or when the brief asks for them.",
    ],
    camera: { position: [16, 12, 18], target: [0, 0.4, 1] },
    highlight: {
      type: "kind",
      kinds: ["building", "vegetation", "water", "road", "structure"],
    },
    hudFocus: "none",
    action: "none",
  },
  {
    id: "add-house",
    chapter: "2 · Guided build",
    title: "Add a house (watch — don’t type)",
    body: [
      "In normal use you click the map and type “add a house here”.",
      "Next places a new home for you. Watch Goals update, cognition log the order, then we’ll zoom Plan validity %.",
    ],
    camera: { position: [8, 7, 10], target: [-2, 0.5, -2] },
    highlight: { type: "kind", kinds: ["building"] },
    hudFocus: "cognition",
    showValidityDelta: true,
    action: "add-house",
  },
  {
    id: "house-score",
    chapter: "2 · Score lift",
    title: "See the % after the new house",
    body: [
      "Infrastructure just changed — the critic re-scored the town.",
      "We’re zooming Plan validity so you can read the new percentage and notes.",
      "As the layout gets stronger, this number climbs and cognition fills with what each agent noticed.",
    ],
    camera: { position: [10, 8, 12], target: [0, 0.4, 0] },
    highlight: { type: "kind", kinds: ["building"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "none",
  },
  {
    id: "add-sewer",
    chapter: "2 · Guided build",
    title: "Add a sewer across the houses",
    body: [
      "Next lays a sewer trunk across the housing cluster — same as typing that order yourself.",
      "Drainage is a big critic lever: expect Plan validity to jump once the pipe is in.",
    ],
    camera: { position: [10, 8, 8], target: [0, 0.3, 0] },
    highlight: { type: "command-kind", kinds: ["sewer"] },
    hudFocus: "cognition",
    showValidityDelta: true,
    action: "add-sewer",
  },
  {
    id: "sewer-score",
    chapter: "2 · Score lift",
    title: "Percentage up since the sewer",
    body: [
      "Zooming Plan validity again — compare this % to before the sewer.",
      "Better drainage shows up here immediately. Cognition on the right should mention the trunk too.",
    ],
    camera: { position: [11, 8, 10], target: [0, 0.3, 0] },
    highlight: { type: "command-kind", kinds: ["sewer"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "none",
  },
  {
    id: "planner",
    chapter: "3 · Agents",
    title: "Harbor Planner",
    body: [
      "The Planner decomposes a brief into ordered sub-goals — they appear in Goals with statuses.",
      "Next assigns a resilience program. Watch the Goals panel fill with sequenced work.",
    ],
    camera: { position: [14, 11, 12], target: [0, 1, 0] },
    highlight: { type: "kind", kinds: ["building", "path"] },
    hudFocus: "goals",
    showValidityDelta: true,
    action: "agent-planner",
  },
  {
    id: "critic",
    chapter: "3 · Agents",
    title: "Resilience Critic",
    body: [
      "The Critic scores flood exposure, evacuation, levee cover, drainage, and road access.",
      "Next runs a full audit — then we zoom the validity % and metric breakdown.",
    ],
    camera: { position: [11, 10, 16], target: [1, 0.5, 3] },
    highlight: { type: "kind", kinds: ["hazard", "path", "structure"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "agent-critic",
  },
  {
    id: "builder",
    chapter: "3 · Agents",
    title: "Levee Builder",
    body: [
      "Next places a living levee along the bay. Map highlights mark what changed.",
      "Afterward we’ll zoom the score again — levees usually lift validity further.",
    ],
    camera: { position: [6, 6, 16], target: [0, 0.8, 6] },
    highlight: { type: "label", labels: ["Living levee", "levee"] },
    hudFocus: "cognition",
    showValidityDelta: true,
    action: "agent-builder",
  },
  {
    id: "levee-score",
    chapter: "3 · Score lift",
    title: "Validity after the levee",
    body: [
      "Plan validity should be higher than after the sewer alone.",
      "Read the % and the critic notes — this is how Aetherforge shows “the town got safer.”",
    ],
    camera: { position: [8, 7, 14], target: [0, 0.8, 5] },
    highlight: { type: "label", labels: ["Living levee", "levee"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "none",
  },
  {
    id: "stress",
    chapter: "4 · Stress Sim",
    title: "Run the surge",
    body: [
      "Stress Sim injects animated flood water and walking people on roads / evac routes.",
      "Next launches a severe surge. Survivors vs stranded appear under Plan validity.",
    ],
    camera: { position: [14, 10, 14], target: [1, 0.4, 2] },
    highlight: { type: "kind", kinds: ["hazard", "road", "path"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "agent-stress",
  },
  {
    id: "finale",
    chapter: "5 · Final output",
    title: "Zoom the result",
    body: [
      "You now have housing, sewer, bay levee, critic scores, cognition history, and a live stress run.",
      "Goals tracked every ask; Plan validity showed the lift after each upgrade.",
      "Click Finish to unlock the UI and explore freely.",
    ],
    camera: { position: [9, 6, 11], target: [0, 0.6, 1] },
    highlight: { type: "kind", kinds: ["building", "structure", "hazard", "path"] },
    hudFocus: "validity",
    showValidityDelta: true,
    action: "finale",
  },
];

export const TOUR_STORAGE_KEY = "aetherforge-tour-v3";
