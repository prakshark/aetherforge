import type { SpatialCommand } from "@/lib/world/commands";
import { commandLabel } from "@/lib/world/commands";
import type { Goal, WorldEntity, WorldEntityInput } from "@/lib/world/schema";
import { makeEntity } from "@/lib/world/schema";
import { enrichCommandPlacement } from "@/lib/world/placement";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface PromptFeatures {
  flooded: boolean;
  houseCount: number;
  roadCount: number;
  treeCount: number;
  wantSewer: boolean;
  wantPark: boolean;
  wantLevee: boolean;
  wantSchool: boolean;
  wantClinic: boolean;
  wantPump: boolean;
  dense: boolean;
}

export function analyzePrompt(prompt: string): PromptFeatures {
  const p = prompt.toLowerCase();
  const h = hash(prompt);
  const flooded = /flood|coast|storm|sea|surge|rain|resilien|waterlog/i.test(p);
  const dense = /dense|city|urban|many|large/i.test(p);
  const few = /small|tiny|village|few/i.test(p);

  let houseCount = 14 + (h % 6);
  if (dense) houseCount = 20 + (h % 6);
  if (few) houseCount = 8 + (h % 3);
  const numMatch = p.match(/(\d+)\s*(house|home|building)/);
  if (numMatch) houseCount = Math.min(36, Math.max(1, parseInt(numMatch[1], 10)));

  return {
    flooded,
    houseCount,
    roadCount: 5,
    treeCount: 18 + (h % 8),
    wantSewer: /sewer|drain|sanitation|pipe/i.test(p),
    wantPark: true,
    wantLevee: /levee|berm|dyke|dike|flood\s*wall|resilien/i.test(p) || flooded,
    wantSchool: true,
    wantClinic: true,
    wantPump: /pump|stormwater|drainage/i.test(p) || flooded,
    dense: true,
  };
}

function entityFromCommand(
  cmd: SpatialCommand,
  index: number
): WorldEntityInput {
  const pos = cmd.position ?? {
    x: (index % 5) * 2 - 4,
    y: 0,
    z: Math.floor(index / 5) * 2,
  };
  const label = commandLabel(cmd.kind, index + 1);
  const rot = cmd.rotationY ?? 0;
  const sc = cmd.scale;

  switch (cmd.kind) {
    case "house":
      return {
        id: `cmd-house-${cmd.id}`,
        kind: "building",
        label,
        position: { x: pos.x, y: 0, z: pos.z },
        scale: sc ?? { x: 1.5, y: 1.3 + (index % 3) * 0.2, z: 1.35 },
        rotationY: rot,
        color: index % 2 === 0 ? "#d2b48c" : "#b08968",
        meta: { fromCommand: cmd.text },
      };
    case "road":
      return {
        id: `cmd-road-${cmd.id}`,
        kind: "road",
        label,
        position: { x: pos.x, y: 0.08, z: pos.z },
        scale: sc ?? { x: 10, y: 0.1, z: 1.8 },
        rotationY: rot,
        color: "#3a3d45",
        meta: { fromCommand: cmd.text },
      };
    case "sewer":
      return {
        id: `cmd-sewer-${cmd.id}`,
        kind: "structure",
        label,
        position: { x: pos.x, y: 0.15, z: pos.z },
        scale: sc ?? { x: 8, y: 0.25, z: 0.55 },
        rotationY: rot,
        color: "#d4a574",
        meta: { fromCommand: cmd.text, infra: "sewer" },
      };
    case "park":
      return {
        id: `cmd-park-${cmd.id}`,
        kind: "vegetation",
        label,
        position: { x: pos.x, y: 0.5, z: pos.z },
        scale: sc ?? { x: 2.2, y: 1.2, z: 2.2 },
        rotationY: rot,
        color: "#3d8b4f",
        meta: { fromCommand: cmd.text, infra: "park" },
      };
    case "levee":
      return {
        id: `cmd-levee-${cmd.id}`,
        kind: "structure",
        label,
        position: { x: pos.x, y: 0.7, z: pos.z },
        scale: sc ?? { x: 9, y: 1.15, z: 1.1 },
        rotationY: rot,
        color: "#4a6b45",
        meta: { fromCommand: cmd.text },
      };
    case "tree":
      return {
        id: `cmd-tree-${cmd.id}`,
        kind: "vegetation",
        label,
        position: { x: pos.x, y: 0.9, z: pos.z },
        scale: sc ?? { x: 0.7, y: 1.4, z: 0.7 },
        rotationY: rot,
        color: "#3f7a45",
        meta: { fromCommand: cmd.text },
      };
    case "water":
      return {
        id: `cmd-water-${cmd.id}`,
        kind: "water",
        label,
        position: { x: pos.x, y: -0.02, z: pos.z },
        scale: sc ?? { x: 4, y: 0.25, z: 4 },
        rotationY: rot,
        color: "#1e5a8a",
        intensity: 0.5,
        meta: { fromCommand: cmd.text },
      };
    case "path":
      return {
        id: `cmd-path-${cmd.id}`,
        kind: "path",
        label,
        position: { x: pos.x, y: 0.12, z: pos.z },
        scale: sc ?? { x: 1.1, y: 0.06, z: 8 },
        rotationY: rot,
        color: "#f0c94d",
        meta: { fromCommand: cmd.text },
      };
    case "bridge":
      return {
        id: `cmd-bridge-${cmd.id}`,
        kind: "structure",
        label,
        position: { x: pos.x, y: 0.55, z: pos.z },
        scale: sc ?? { x: 5, y: 0.35, z: 1.6 },
        rotationY: rot,
        color: "#6a6e78",
        meta: { fromCommand: cmd.text, infra: "bridge" },
      };
    case "school":
      return {
        id: `cmd-school-${cmd.id}`,
        kind: "building",
        label,
        position: { x: pos.x, y: 0, z: pos.z },
        scale: sc ?? { x: 2.8, y: 1.8, z: 2.2 },
        rotationY: rot,
        color: "#c4b8a0",
        meta: { fromCommand: cmd.text, infra: "school" },
      };
    case "clinic":
      return {
        id: `cmd-clinic-${cmd.id}`,
        kind: "building",
        label,
        position: { x: pos.x, y: 0, z: pos.z },
        scale: sc ?? { x: 2.2, y: 1.6, z: 1.8 },
        rotationY: rot,
        color: "#d8dde4",
        meta: { fromCommand: cmd.text, infra: "clinic" },
      };
    case "pump":
      return {
        id: `cmd-pump-${cmd.id}`,
        kind: "prop",
        label,
        position: { x: pos.x, y: 0.55, z: pos.z },
        scale: sc ?? { x: 1.2, y: 1.1, z: 1.2 },
        rotationY: rot,
        color: "#5a7a8a",
        meta: { fromCommand: cmd.text, infra: "pump" },
      };
    default:
      return {
        id: `cmd-generic-${cmd.id}`,
        kind: "marker",
        label: cmd.text.slice(0, 24) || label,
        position: { x: pos.x, y: 0.8, z: pos.z },
        scale: sc ?? { x: 0.7, y: 0.7, z: 0.7 },
        rotationY: rot,
        color: "#7ec8ff",
        meta: { fromCommand: cmd.text },
      };
  }
}

/** Fully regenerate map entities from prompt + spatial commands + goal hints. */
export function buildWorldEntities(
  prompt: string,
  commands: SpatialCommand[],
  goals: Goal[] = []
): WorldEntityInput[] {
  const feat = analyzePrompt(prompt);
  const goalText = goals.map((g) => g.text).join(" ");
  const h = hash(
    `${prompt}|${commands.map((c) => `${c.kind}:${c.position?.x},${c.position?.z}:${c.text}`).join(";")}|${goalText}`
  );

  const entities: WorldEntityInput[] = [
    {
      id: "terrain-main",
      kind: "terrain",
      label: "Coastal ground",
      position: { x: 0, y: 0, z: -1 },
      scale: { x: 42, y: 0.4, z: 38 },
      color: "#2a3d2e",
    },
    // Deep bay basin — south shoreline
    {
      id: "water-bay",
      kind: "water",
      label: "Harbor Bay",
      position: { x: 0, y: -0.12, z: 12.5 },
      scale: { x: 40, y: 0.55, z: 16 },
      color: feat.flooded ? "#15608f" : "#0f4a72",
      intensity: feat.flooded ? 0.85 : 0.55,
      meta: { waterStyle: "bay", shoreZ: 5.2 },
    },
    // Canal / inlet cutting toward town — reads as a real water source
    {
      id: "water-canal",
      kind: "water",
      label: "Tide canal",
      position: { x: 6.5, y: -0.08, z: 5.2 },
      scale: { x: 3.2, y: 0.35, z: 9 },
      color: "#1a5f8a",
      intensity: 0.65,
      meta: { waterStyle: "canal" },
    },
  ];

  // —— Street grid (E–W arterials + N–S avenues) ——
  const ewRoads = [
    { z: -7.2, w: 1.55, label: "North Ridge", primary: false },
    { z: -3.4, w: 1.7, label: "Cedar Ave", primary: false },
    { z: 0.4, w: 2.15, label: "Harbor Road", primary: true },
    { z: 4.0, w: 1.65, label: "Quay Lane", primary: true },
  ];
  const nsRoads = [
    { x: -10.5, w: 1.5, label: "West Spur", primary: false },
    { x: -5.2, w: 1.65, label: "Pine St", primary: false },
    { x: 0.2, w: 1.9, label: "Market St", primary: true },
    { x: 5.6, w: 1.65, label: "Dock St", primary: false },
    { x: 10.8, w: 1.5, label: "East Spur", primary: false },
  ];

  ewRoads.forEach((r, i) => {
    entities.push({
      id: `road-ew-${i}`,
      kind: "road",
      label: r.label,
      position: { x: 0, y: 0.08, z: r.z },
      scale: { x: 28, y: 0.1, z: r.w },
      color: "#3a3d45",
      intensity: feat.flooded && r.z > 2 ? 0.45 : 0.1,
      meta: {
        flooded: feat.flooded && r.z > 2,
        seed: true,
        hideLabel: !r.primary,
      },
    });
  });

  nsRoads.forEach((r, i) => {
    entities.push({
      id: `road-ns-${i}`,
      kind: "road",
      label: r.label,
      position: { x: r.x, y: 0.08, z: -1.5 },
      scale: { x: 18, y: 0.1, z: r.w },
      rotationY: Math.PI / 2,
      color: "#383b42",
      intensity: feat.flooded && i >= 3 ? 0.35 : 0.08,
      meta: { seed: true, hideLabel: !r.primary, avenue: true },
    });
  });

  // Parcel centers between the grid lines
  const houseColors = ["#d2b48c", "#a87c5b", "#c4a882", "#b8956e", "#d8c4a8", "#9a7358"];
  const shopColors = ["#8b9aab", "#6d7f92", "#a89b8c", "#7a8f7e"];
  let houseIdx = 0;
  const maxHouses = feat.houseCount;

  for (let row = 0; row < ewRoads.length - 1 && houseIdx < maxHouses; row++) {
    const z0 = ewRoads[row].z;
    const z1 = ewRoads[row + 1].z;
    const zMid = (z0 + z1) / 2;
    for (let col = 0; col < nsRoads.length - 1 && houseIdx < maxHouses; col++) {
      const x0 = nsRoads[col].x;
      const x1 = nsRoads[col + 1].x;
      const xMid = (x0 + x1) / 2;
      // Skip one cell for the park
      if (row === 0 && col === 3) continue;

      const jitterX = (((h + houseIdx * 17) % 9) - 4) * 0.06;
      const jitterZ = (((h + houseIdx * 11) % 7) - 3) * 0.05;
      const isShop = row === 2 || (row === 1 && col % 2 === 0);
      const tall = ((h + houseIdx) % 5) === 0;

      if (isShop) {
        entities.push({
          id: `shop-seed-${houseIdx}`,
          kind: "building",
          label: houseIdx % 3 === 0 ? "Market stall" : `Shop ${houseIdx + 1}`,
          position: { x: xMid + jitterX, y: 0, z: zMid + jitterZ },
          scale: {
            x: 1.7 + ((h + houseIdx) % 3) * 0.15,
            y: 1.45 + ((h + houseIdx) % 3) * 0.25,
            z: 1.4,
          },
          color: shopColors[houseIdx % shopColors.length],
          intensity: feat.flooded && zMid > 1.5 ? 0.4 : 0.08,
          meta: {
            flooded: feat.flooded && zMid > 1.5,
            seed: true,
            buildingStyle: "shop",
          },
        });
      } else {
        entities.push({
          id: `house-seed-${houseIdx}`,
          kind: "building",
          label: `Home ${houseIdx + 1}`,
          position: { x: xMid + jitterX, y: 0, z: zMid + jitterZ },
          scale: {
            x: 1.35 + ((h + houseIdx) % 3) * 0.12,
            y: (tall ? 1.85 : 1.15) + ((h + houseIdx) % 4) * 0.18,
            z: 1.25 + ((h + houseIdx) % 2) * 0.1,
          },
          color: houseColors[houseIdx % houseColors.length],
          intensity: feat.flooded && zMid > 1.8 ? 0.55 : 0.1,
          meta: {
            flooded: feat.flooded && zMid > 1.8,
            seed: true,
            buildingStyle: tall ? "townhouse" : "house",
          },
        });
      }
      houseIdx++;

      // Second lot in wide cells
      if (Math.abs(x1 - x0) > 5.2 && houseIdx < maxHouses && !isShop) {
        entities.push({
          id: `house-seed-${houseIdx}`,
          kind: "building",
          label: `Home ${houseIdx + 1}`,
          position: {
            x: xMid + (x1 - x0) * 0.22 + jitterX,
            y: 0,
            z: zMid - 0.35 + jitterZ,
          },
          scale: {
            x: 1.25,
            y: 1.1 + ((h + houseIdx) % 3) * 0.2,
            z: 1.15,
          },
          color: houseColors[(houseIdx + 2) % houseColors.length],
          meta: { seed: true, buildingStyle: "house" },
        });
        houseIdx++;
      }
    }
  }

  // Sidewalk trees along arterials
  let treeI = 0;
  for (const r of ewRoads) {
    for (let t = -12; t <= 12 && treeI < feat.treeCount; t += 3.2) {
      if (nsRoads.some((n) => Math.abs(n.x - t) < 1.2)) continue;
      const side = (treeI % 2 === 0 ? 1 : -1) * (r.w * 0.5 + 0.55);
      entities.push({
        id: `tree-seed-${treeI}`,
        kind: "vegetation",
        label: "Tree",
        position: {
          x: t + (((h + treeI) % 5) - 2) * 0.08,
          y: 0.9,
          z: r.z + side,
        },
        scale: { x: 0.55, y: 1.05 + (treeI % 3) * 0.18, z: 0.55 },
        color: treeI % 2 === 0 ? "#3f7a45" : "#2f6a3a",
        meta: { seed: true },
      });
      treeI++;
    }
  }
  while (treeI < feat.treeCount) {
    entities.push({
      id: `tree-seed-${treeI}`,
      kind: "vegetation",
      label: "Tree",
      position: {
        x: -11 + ((h + treeI * 17) % 23),
        y: 0.9,
        z: -8 + ((h + treeI * 11) % 10),
      },
      scale: { x: 0.6, y: 1.15 + (treeI % 3) * 0.12, z: 0.6 },
      color: "#3f7a45",
      meta: { seed: true },
    });
    treeI++;
  }

  if (feat.flooded) {
    entities.push({
      id: "hazard-flood",
      kind: "hazard",
      label: "Flood zone",
      position: { x: 1.2, y: 0.1, z: 4.6 },
      scale: { x: 11, y: 0.08, z: 5.8 },
      color: "#3b82c4",
      intensity: 0.75,
      meta: { seed: true },
    });
  }

  if (feat.wantLevee && !commands.some((c) => c.kind === "levee")) {
    entities.push({
      id: "levee-seed",
      kind: "structure",
      label: "Living levee",
      position: { x: 0, y: 0.7, z: 6.8 },
      scale: { x: 22, y: 1.15, z: 1.2 },
      color: "#4a6b45",
      meta: { seed: true },
    });
  }

  if (feat.wantSewer && !commands.some((c) => c.kind === "sewer")) {
    const houseEntities = entities
      .filter((e) => e.kind === "building")
      .map((e) => makeEntity(e));
    const placed = enrichCommandPlacement(
      {
        id: "sewer-seed-cmd",
        text: "sewer line across the houses",
        kind: "sewer",
        createdAt: Date.now(),
      },
      houseEntities
    );
    entities.push(entityFromCommand(placed, 0));
  }

  if (feat.wantPark) {
    entities.push({
      id: "park-seed",
      kind: "vegetation",
      label: "Community park",
      position: { x: 8.2, y: 0.35, z: -5.3 },
      scale: { x: 3.4, y: 0.9, z: 2.8 },
      color: "#3d8b4f",
      meta: { infra: "park", seed: true, buildingStyle: "park" },
    });
  }

  if (feat.wantSchool) {
    entities.push({
      id: "school-seed",
      kind: "building",
      label: "Harbor School",
      position: { x: -7.8, y: 0, z: -5.2 },
      scale: { x: 3.2, y: 2.1, z: 2.4 },
      color: "#c4b8a0",
      meta: { infra: "school", seed: true, buildingStyle: "civic" },
    });
  }

  if (feat.wantClinic) {
    entities.push({
      id: "clinic-seed",
      kind: "building",
      label: "Clinic",
      position: { x: 8.4, y: 0, z: -1.4 },
      scale: { x: 2.4, y: 1.75, z: 2.0 },
      color: "#d8dde4",
      meta: { infra: "clinic", seed: true, buildingStyle: "civic" },
    });
  }

  // Warehouse / fish hall near docks
  entities.push({
    id: "warehouse-seed",
    kind: "building",
    label: "Fish hall",
    position: { x: -3.2, y: 0, z: 2.2 },
    scale: { x: 2.8, y: 1.55, z: 2.1 },
    color: "#7a8490",
    meta: { seed: true, buildingStyle: "warehouse" },
  });

  // Pier into the bay
  entities.push({
    id: "pier-seed",
    kind: "structure",
    label: "Harbor pier",
    position: { x: -5.5, y: 0.25, z: 9.2 },
    scale: { x: 1.4, y: 0.22, z: 5.5 },
    color: "#6b5344",
    meta: { seed: true, infra: "pier" },
  });

  if (feat.wantPump) {
    entities.push({
      id: "pump-seed",
      kind: "prop",
      label: "Storm pump",
      position: { x: 5.2, y: 0.55, z: 5.4 },
      scale: { x: 1.3, y: 1.2, z: 1.3 },
      color: "#5a7a8a",
      meta: { infra: "pump", seed: true },
    });
  }

  if (/evac|escape|egress/i.test(goalText)) {
    entities.push({
      id: "evac-goal",
      kind: "path",
      label: "Evacuation spine",
      position: { x: -5.2, y: 0.12, z: -1.2 },
      scale: { x: 1.15, y: 0.06, z: 14 },
      color: "#f0c94d",
      meta: { fromGoal: true },
    });
  }

  // Place user/agent commands relative to what already exists (houses, roads, bay…)
  const context: WorldEntity[] = entities.map((e) => makeEntity(e));
  commands.forEach((cmd, i) => {
    const placed = enrichCommandPlacement(cmd, context, cmd.position);
    entities.push(entityFromCommand(placed, i));
  });

  return entities;
}

export function scorePlan(
  entities: WorldEntityInput[],
  goals: Goal[],
  commands: SpatialCommand[]
): { overall: number; notes: string } {
  let score = 0.42;
  const hasLevee = entities.some(
    (e) => /levee/i.test(e.label) || e.meta?.infra === "levee"
  );
  const hasEvac = entities.some((e) => e.kind === "path");
  const hasSewer = entities.some((e) => e.meta?.infra === "sewer");
  const houseCount = entities.filter((e) => e.kind === "building").length;
  const mitigated = entities.filter(
    (e) => e.kind === "road" && (e.intensity ?? 1) < 0.3
  ).length;

  if (hasLevee) score += 0.12;
  if (hasEvac) score += 0.1;
  if (hasSewer) score += 0.08;
  if (houseCount >= 4) score += 0.06;
  if (mitigated > 0) score += 0.08;
  score += Math.min(0.15, commands.length * 0.03);
  score += Math.min(0.1, goals.filter((g) => g.status === "done").length * 0.04);
  score += Math.min(0.08, goals.filter((g) => g.assignedAgentId).length * 0.03);

  const notes = [
    hasLevee ? "levee present" : "levee missing",
    hasEvac ? "evac path ok" : "no evac path",
    hasSewer ? "drainage ok" : "drainage weak",
    `${commands.length} site edits`,
  ].join(" · ");

  return {
    overall: Math.max(0.2, Math.min(0.97, score)),
    notes: `Plan validity — ${notes}`,
  };
}
