import type { CommandKind, SpatialCommand } from "@/lib/world/commands";
import { parseCommandKind } from "@/lib/world/commands";
import type { Vec3, WorldEntity } from "@/lib/world/schema";

export type PlacementAnchor =
  | "click"
  | "houses"
  | "road"
  | "bay"
  | "flood"
  | "waterfront";

export interface ResolvedPlacement {
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  anchor: PlacementAnchor;
}

function boundsOf(
  entities: WorldEntity[],
  pred: (e: WorldEntity) => boolean
): { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number; count: number } | null {
  const hits = entities.filter(pred);
  if (hits.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const e of hits) {
    const hx = (e.scale?.x ?? 1) * 0.5;
    const hz = (e.scale?.z ?? 1) * 0.5;
    minX = Math.min(minX, e.position.x - hx);
    maxX = Math.max(maxX, e.position.x + hx);
    minZ = Math.min(minZ, e.position.z - hz);
    maxZ = Math.max(maxZ, e.position.z + hz);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    count: hits.length,
  };
}

function detectAnchor(text: string, hasClick: boolean): PlacementAnchor {
  const t = text.toLowerCase();
  if (
    /across\s+(the\s+)?(houses|homes|buildings|neighborhood|blocks)/i.test(t) ||
    /through\s+(the\s+)?(houses|homes)/i.test(t) ||
    /among\s+(the\s+)?(houses|homes)/i.test(t) ||
    /between\s+(the\s+)?(houses|homes)/i.test(t) ||
    /serving\s+(the\s+)?(houses|homes)/i.test(t) ||
    /connect(ing)?\s+(the\s+)?(houses|homes)/i.test(t)
  ) {
    return "houses";
  }
  if (/along\s+(the\s+)?(road|street|harbor)/i.test(t) || /beside\s+(the\s+)?road/i.test(t)) {
    return "road";
  }
  if (/along\s+(the\s+)?(bay|coast|shore|waterfront)/i.test(t) || /near\s+(the\s+)?bay/i.test(t)) {
    return "bay";
  }
  if (/flood\s*zone|through\s+the\s+flood/i.test(t)) {
    return "flood";
  }
  if (hasClick) return "click";
  // Default linear infra toward houses when no click
  if (/sewer|road|levee|path|pipe|drain/i.test(t)) return "houses";
  return "click";
}

function defaultScale(kind: CommandKind): Vec3 {
  switch (kind) {
    case "sewer":
      return { x: 10, y: 0.25, z: 0.55 };
    case "road":
      return { x: 12, y: 0.1, z: 1.8 };
    case "levee":
      return { x: 12, y: 1.15, z: 1.1 };
    case "path":
      return { x: 1.1, y: 0.06, z: 10 };
    case "house":
      return { x: 1.5, y: 1.4, z: 1.35 };
    case "park":
      return { x: 2.4, y: 1.2, z: 2.4 };
    default:
      return { x: 1.2, y: 1, z: 1.2 };
  }
}

/**
 * Place infrastructure from natural language relative to existing map features.
 * e.g. "sewer across the houses" → line spanning the house cluster.
 */
export function resolvePlacement(
  text: string,
  entities: WorldEntity[],
  clickPos?: Vec3
): ResolvedPlacement {
  const kind = parseCommandKind(text);
  const anchor = detectAnchor(text, Boolean(clickPos));
  const base = defaultScale(kind);
  const houses = boundsOf(
    entities,
    (e) => e.kind === "building" || /home|house|school|clinic/i.test(e.label)
  );
  const roads = boundsOf(entities, (e) => e.kind === "road");
  const flood = boundsOf(entities, (e) => e.kind === "hazard");
  const water = boundsOf(entities, (e) => e.kind === "water");

  const linear = ["sewer", "road", "levee", "path", "bridge"].includes(kind);

  if (anchor === "houses" && houses) {
    const spanX = houses.maxX - houses.minX;
    const spanZ = houses.maxZ - houses.minZ;
    // Run the line along the longer neighborhood axis
    const alongX = spanX >= spanZ;
    if (linear) {
      return {
        anchor,
        position: {
          x: houses.cx,
          y: kind === "levee" ? 0.7 : 0.15,
          z: houses.cz + (alongX ? 0.35 : 0),
        },
        scale: alongX
          ? {
              x: Math.max(spanX + 2.5, base.x),
              y: base.y,
              z: kind === "road" ? base.z : kind === "path" ? base.x : 0.55,
            }
          : {
              x: kind === "road" ? base.z : kind === "path" ? base.x : 0.55,
              y: base.y,
              z: Math.max(spanZ + 2.5, base.x),
            },
        rotationY: alongX ? 0 : Math.PI / 2,
      };
    }
    // Point features: center of housing
    return {
      anchor,
      position: { x: houses.cx, y: 0, z: houses.cz },
      scale: base,
      rotationY: 0,
    };
  }

  if (anchor === "road" && roads) {
    return {
      anchor,
      position: {
        x: roads.cx,
        y: kind === "levee" ? 0.7 : 0.14,
        z: roads.cz + (kind === "sewer" ? 1.1 : 0),
      },
      scale: {
        x: Math.max(roads.maxX - roads.minX + 1.5, base.x),
        y: base.y,
        z: kind === "road" ? base.z : 0.55,
      },
      rotationY: 0,
    };
  }

  if (anchor === "bay" && water) {
    return {
      anchor,
      position: {
        x: water.cx,
        y: kind === "levee" ? 0.7 : 0.15,
        z: water.minZ - 1.2,
      },
      scale: {
        x: Math.max(water.maxX - water.minX * 0.4, 10),
        y: base.y,
        z: kind === "levee" ? 1.15 : 0.55,
      },
      rotationY: 0,
    };
  }

  if (anchor === "flood" && flood) {
    return {
      anchor,
      position: { x: flood.cx, y: 0.15, z: flood.cz },
      scale: {
        x: Math.max(flood.maxX - flood.minX, base.x),
        y: base.y,
        z: kind === "levee" ? 1.15 : 0.55,
      },
      rotationY: 0,
    };
  }

  // Explicit map click — still stretch linear features if wording implies a line
  if (clickPos) {
    const wantsLine = /line|across|along|through|stretch/i.test(text) || linear;
    if (wantsLine && houses) {
      const spanX = Math.max(houses.maxX - houses.minX, 8);
      return {
        anchor: "click",
        position: { x: clickPos.x, y: 0.15, z: clickPos.z },
        scale: {
          x: spanX,
          y: base.y,
          z: kind === "road" ? base.z : 0.55,
        },
        rotationY: 0,
      };
    }
    return {
      anchor: "click",
      position: { x: clickPos.x, y: clickPos.y || 0.15, z: clickPos.z },
      scale: base,
      rotationY: 0,
    };
  }

  // Fallback: housing cluster if any, else origin
  if (houses) {
    return {
      anchor: "houses",
      position: { x: houses.cx, y: 0.15, z: houses.cz },
      scale: linear
        ? { x: Math.max(houses.maxX - houses.minX + 2, 8), y: base.y, z: 0.55 }
        : base,
      rotationY: 0,
    };
  }

  return {
    anchor: "click",
    position: { x: 0, y: 0.15, z: 0 },
    scale: base,
    rotationY: 0,
  };
}

export function enrichCommandPlacement(
  cmd: SpatialCommand,
  entities: WorldEntity[],
  clickPos?: Vec3
): SpatialCommand & { scale?: Vec3; rotationY?: number } {
  const resolved = resolvePlacement(cmd.text, entities, clickPos ?? cmd.position);
  return {
    ...cmd,
    position: resolved.position,
    scale: resolved.scale,
    rotationY: resolved.rotationY,
  };
}
