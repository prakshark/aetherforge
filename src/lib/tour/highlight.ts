import type { WorldEntity } from "@/lib/world/schema";
import type { TourHighlight } from "@/lib/tour/steps";

export function entityMatchesHighlight(
  entity: WorldEntity,
  highlight: TourHighlight
): boolean {
  if (highlight.type === "none") return false;

  if (highlight.type === "kind") {
    return highlight.kinds.includes(entity.kind);
  }

  if (highlight.type === "label") {
    const label = entity.label.toLowerCase();
    return highlight.labels.some((l) => label.includes(l.toLowerCase()));
  }

  if (highlight.type === "command-kind") {
    const infra = String(entity.meta?.infra ?? "");
    return highlight.kinds.some(
      (k) => infra === k || entity.label.toLowerCase().includes(k)
    );
  }

  return false;
}
