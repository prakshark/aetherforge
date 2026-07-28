"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TOUR_STEPS } from "@/lib/tour/steps";
import { useTourStore } from "@/lib/store/tour-store";
import { useForgeStore } from "@/lib/store/forge-store";
import { CLIMATE_PACK } from "@/lib/world/themes";

function ValidityCallout() {
  const before = useTourStore((s) => s.validityBefore);
  const after = useTourStore((s) => s.validityAfter);
  const hudFocus = useTourStore((s) => s.hudFocus);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const step = TOUR_STEPS[stepIndex];

  if (!step?.showValidityDelta || after === null) return null;

  const delta =
    before !== null && after !== null ? after - before : null;
  const deltaText =
    delta === null
      ? null
      : delta > 0
        ? `↑ +${delta} pts`
        : delta < 0
          ? `↓ ${delta} pts`
          : "→ unchanged";

  return (
    <div
      className={`tour-validity-callout ${
        hudFocus === "validity" ? "pulse" : ""
      }`}
    >
      <span className="tour-validity-label">Plan validity</span>
      <div className="tour-validity-row">
        {before !== null ? (
          <span className="tour-validity-before">{before}%</span>
        ) : null}
        {before !== null ? <span className="tour-validity-arrow">→</span> : null}
        <span className="tour-validity-after">{after}%</span>
        {deltaText ? (
          <span
            className={`tour-validity-delta ${
              delta !== null && delta > 0
                ? "up"
                : delta !== null && delta < 0
                  ? "down"
                  : ""
            }`}
          >
            {deltaText}
          </span>
        ) : null}
      </div>
      <p className="tour-validity-note">
        {hudFocus === "validity"
          ? "Zoomed on the Plan validity panel — better infrastructure raises this score."
          : "Watch cognition update, then the % on the bottom-right."}
      </p>
    </div>
  );
}

export function Walkthrough() {
  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const running = useTourStore((s) => s.running);
  const hudFocus = useTourStore((s) => s.hudFocus);
  const next = useTourStore((s) => s.next);
  const endTour = useTourStore((s) => s.endTour);
  const busy = useForgeStore((s) => s.busy);
  const pack = CLIMATE_PACK;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex >= TOUR_STEPS.length - 1;
  const waiting = running || busy;

  if (!active || !step) return null;

  const focusHint =
    hudFocus === "goals"
      ? "Spotlight: Goals panel (left) — prompts become goals with status."
      : hudFocus === "cognition"
        ? "Spotlight: Agent cognition (right) — thoughts update as work lands."
        : hudFocus === "validity"
          ? "Spotlight: Plan validity % — zoomed so you can read the score lift."
          : null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          key="tour-scrim"
          className="tour-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        />

        {focusHint ? (
          <motion.p
            key={`hint-${hudFocus}-${step.id}`}
            className={`tour-focus-banner tour-focus-banner-${hudFocus}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {focusHint}
          </motion.p>
        ) : null}

        <motion.div
          className="tour-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          <motion.div
            className="tour-card"
            key={step.id}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tour-progress" aria-hidden>
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`tour-dot ${i === stepIndex ? "active" : ""} ${
                    i < stepIndex ? "done" : ""
                  }`}
                />
              ))}
            </div>

            <p className="tour-chapter">{step.chapter}</p>
            <h2 id="tour-title" className="tour-title">
              {step.title}
            </h2>

            <div className="tour-body">
              {step.body.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>

            <ValidityCallout />

            {step.action !== "none" && step.action !== "finale" ? (
              <p className="tour-action-hint">
                {waiting
                  ? "Agents are working — watch Goals, cognition, and the %…"
                  : "Press Next and we run this step for you."}
              </p>
            ) : null}

            <div className="tour-actions">
              <button
                type="button"
                className="ghost-btn tour-skip"
                onClick={endTour}
              >
                Skip tour
              </button>
              <button
                type="button"
                className="forge-btn tour-next"
                style={{ background: pack.accent, color: "#0a1210" }}
                disabled={waiting}
                onClick={() => void next()}
              >
                {waiting ? "Working…" : isLast ? "Finish" : "Next"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

export function HelpButton({ onOpen }: { onOpen: () => void }) {
  const locked = useTourStore((s) => s.locked);
  return (
    <button
      type="button"
      className="ghost-btn"
      disabled={locked}
      onClick={onOpen}
    >
      How to use
    </button>
  );
}

export function NextStepCoach() {
  const session = useForgeStore((s) => s.session);
  const busy = useForgeStore((s) => s.busy);
  const tourActive = useTourStore((s) => s.active);
  const [dismissed, setDismissed] = useState(false);

  if (!session || busy || dismissed || tourActive) return null;

  const clicked =
    (session.world.commands?.length ?? 0) > 0 ||
    session.world.constraints.length > 0;
  const text = clicked
    ? "Map replanned. Click again to add more, or assign a goal to an agent."
    : "Click anywhere on the map, then type e.g. “add a house here”.";

  return (
    <div className="next-step-coach" role="status">
      <span>{text}</span>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
