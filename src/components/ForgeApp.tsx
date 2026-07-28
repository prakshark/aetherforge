"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { BrandMark } from "@/components/ui/ThemePicker";
import { PromptBar } from "@/components/ui/PromptBar";
import {
  AgentsAndGoalsPanel,
  CognitionPanel,
  PlanValidityPanel,
  PhaseBadge,
} from "@/components/ui/AgentHud";
import {
  HelpButton,
  NextStepCoach,
  Walkthrough,
} from "@/components/ui/Walkthrough";
import { ClickCommandBox } from "@/components/ui/ClickCommandBox";
import {
  DesktopPreferredOverlay,
  DesktopPreferredStaticGate,
} from "@/components/ui/DesktopPreferredOverlay";
import { useTourStore } from "@/lib/store/tour-store";

const WorldCanvas = dynamic(
  () =>
    import("@/components/world/WorldCanvas").then((m) => m.WorldCanvas),
  {
    ssr: false,
    loading: () => <div className="world-loading">Warming the forge…</div>,
  }
);

export function ForgeApp() {
  const locked = useTourStore((s) => s.locked);
  const hudFocus = useTourStore((s) => s.hudFocus);
  const startTour = useTourStore((s) => s.startTour);

  // Boot straight into the guided demo — skip the idle home page.
  useEffect(() => {
    void startTour();
  }, [startTour]);

  const shellClass = [
    "forge-shell",
    locked ? "tour-locked" : "",
    hudFocus !== "none" ? `tour-focus-${hudFocus}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={shellClass}>
      <div className="forge-viewport">
        <WorldCanvas />
      </div>

      <div className="forge-overlay" aria-hidden={locked}>
        <div className="top-row">
          <BrandMark />
          <div className="top-actions">
            <HelpButton onOpen={() => void startTour()} />
            <PhaseBadge />
          </div>
        </div>
        <AgentsAndGoalsPanel />
        <CognitionPanel />
        <PlanValidityPanel />
        <NextStepCoach />
        <div className="bottom-row">
          <p className="prompt-helper">
            Type a problem → Forge · click the map to place houses, roads,
            sewers… · or assign a goal to an agent
          </p>
          <PromptBar />
        </div>
      </div>

      {!locked ? <ClickCommandBox /> : null}

      <Walkthrough />
      <DesktopPreferredStaticGate />
      <DesktopPreferredOverlay />
    </main>
  );
}
