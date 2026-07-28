"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  latestEvents,
  phaseLabel,
  useForgeStore,
} from "@/lib/store/forge-store";
import { CLIMATE_PACK } from "@/lib/world/themes";

/** Left panel: goals + color-coded agent assign form. */
export function AgentsAndGoalsPanel() {
  const session = useForgeStore((s) => s.session);
  const selectedAgentId = useForgeStore((s) => s.selectedAgentId);
  const selectAgent = useForgeStore((s) => s.selectAgent);
  const assignGoalToAgent = useForgeStore((s) => s.assignGoalToAgent);
  const busy = useForgeStore((s) => s.busy);
  const [goalText, setGoalText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (!selectedAgentId && session.agents[0]) {
      selectAgent(session.agents[0].id);
    }
  }, [session, selectedAgentId, selectAgent]);

  if (!session) return null;

  const agent =
    session.agents.find((a) => a.id === selectedAgentId) ?? session.agents[0];

  function onAssign(e: FormEvent) {
    e.preventDefault();
    const id = selectedAgentId ?? session?.agents[0]?.id;
    if (!id || !goalText.trim()) return;
    void assignGoalToAgent(id, goalText.trim());
    setGoalText("");
    setMenuOpen(false);
  }

  return (
    <aside
      className="hud-panel hud-left"
      data-tour-panel="goals"
      aria-label="Goals"
    >
      <div className="hud-label">Goals</div>
      <ul className="goal-list">
        {session.world.goals.map((g) => {
          const assigned = session.agents.find(
            (a) => a.id === g.assignedAgentId || a.name === g.assignedAgentName
          );
          return (
            <li key={g.id}>
              <span className={`goal-pill ${g.status}`}>{g.status}</span>
              {g.text}
              {g.assignedAgentName ? (
                <span
                  className="goal-assignee"
                  style={assigned ? { color: assigned.color } : undefined}
                >
                  {" "}
                  → {g.assignedAgentName}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form className="assign-form" onSubmit={onAssign}>
        <div className="hud-label" style={{ marginTop: "0.75rem" }}>
          Ask an agent
        </div>
        <label className="assign-label" id="agent-select-label">
          Which agent?
        </label>
        <div className="agent-dropdown">
          <button
            type="button"
            className="agent-dropdown-trigger"
            disabled={busy}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-labelledby="agent-select-label"
            onClick={() => setMenuOpen((o) => !o)}
            style={
              agent
                ? {
                    borderColor: agent.color,
                    boxShadow: `0 0 0 1px ${agent.color}55`,
                    background: `${agent.color}18`,
                  }
                : undefined
            }
          >
            {agent ? (
              <>
                <span
                  className="agent-swatch"
                  style={{
                    background: agent.color,
                    boxShadow: `0 0 10px ${agent.color}`,
                  }}
                />
                <span className="agent-dropdown-name" style={{ color: agent.color }}>
                  {agent.name}
                </span>
                <span className="agent-dropdown-role">{agent.role}</span>
              </>
            ) : (
              <span>Select agent</span>
            )}
            <span className="agent-dropdown-caret">▾</span>
          </button>
          {menuOpen ? (
            <ul className="agent-dropdown-menu" role="listbox">
              {session.agents.map((a) => {
                const active = a.id === agent?.id;
                return (
                  <li key={a.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={`agent-dropdown-option ${active ? "active" : ""}`}
                      style={{
                        borderLeftColor: a.color,
                        background: active ? `${a.color}22` : undefined,
                      }}
                      onClick={() => {
                        selectAgent(a.id);
                        setMenuOpen(false);
                      }}
                    >
                      <span
                        className="agent-swatch"
                        style={{
                          background: a.color,
                          boxShadow: `0 0 10px ${a.color}`,
                        }}
                      />
                      <span style={{ color: a.color, fontWeight: 600 }}>
                        {a.name}
                      </span>
                      <span className="agent-dropdown-role">{a.role}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <label className="assign-label" htmlFor="goal-input">
          What should they do?
        </label>
        <input
          id="goal-input"
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder={
            agent?.role === "simulator"
              ? "e.g. Run a severe storm surge stress test"
              : agent?.role === "critic"
                ? "e.g. Audit flood exposure and evacuation"
                : agent?.role === "planner"
                  ? "e.g. Sequence a flood-resilience program"
                  : "e.g. Add a sewer across the houses"
          }
          disabled={busy}
          aria-label="Goal for selected agent"
        />
        <button
          type="submit"
          className="forge-btn assign-btn"
          disabled={busy || !goalText.trim() || !agent}
          style={{
            background: agent?.color ?? CLIMATE_PACK.accent,
            color: "#0a1210",
          }}
        >
          {busy ? "Updating…" : `Ask ${agent?.name ?? "agent"}`}
        </button>
      </form>
    </aside>
  );
}

export function CognitionPanel() {
  const session = useForgeStore((s) => s.session);
  if (!session) return null;
  const events = latestEvents(session.events, 10);
  const thoughts = [...session.thoughts].slice(-8).reverse();

  return (
    <aside
      className="hud-panel hud-right"
      data-tour-panel="cognition"
      aria-label="Agent cognition"
    >
      <div className="hud-label">Agent cognition</div>
      <ul className="event-list">
        <AnimatePresence initial={false}>
          {thoughts.map((t) => {
            const a = session.agents.find((x) => x.id === t.agentId);
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="event-type" style={{ color: a?.color }}>
                  {a?.name ?? t.role}
                </span>
                <span className="event-msg">{t.text}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {thoughts.length === 0 ? (
        <p className="hud-hint">
          Agent thoughts appear here after you forge, click the map, or ask an
          agent.
        </p>
      ) : null}

      <div className="hud-label" style={{ marginTop: "0.9rem" }}>
        System log
      </div>
      <ul className="event-list compact">
        {events.slice(0, 4).map((e) => (
          <li key={e.id}>
            <span className="event-type">{e.type.replaceAll("_", " ")}</span>
            <span className="event-msg">{e.message}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function PlanValidityPanel() {
  const session = useForgeStore((s) => s.session);
  if (!session) return null;
  const pack = CLIMATE_PACK;
  const pct = session.score ? Math.round(session.score.overall * 100) : null;
  const breakdown = session.criticBreakdown ?? [];
  const stress = session.stressSim;

  return (
    <aside
      className="hud-panel hud-validity"
      data-tour-panel="validity"
      aria-label="Plan validity"
    >
      <div className="hud-label">Plan validity</div>
      {pct !== null ? (
        <>
          <div className="score-value" style={{ color: pack.accent }}>
            {pct}%
          </div>
          <div className="score-notes">{session.score?.notes}</div>
          <div className="validity-bar">
            <div
              className="validity-fill"
              style={{ width: `${pct}%`, background: pack.accent }}
            />
          </div>
          {breakdown.length > 0 ? (
            <ul className="breakdown-list">
              {breakdown.map((b) => (
                <li key={b.label}>
                  <span>{b.label}</span>
                  <strong style={{ color: b.score > 0.6 ? "#7ec8a3" : "#ff8b6b" }}>
                    {Math.round(b.score * 100)}%
                  </strong>
                </li>
              ))}
            </ul>
          ) : null}
          {stress?.active ? (
            <p className="hud-hint" style={{ marginTop: "0.55rem" }}>
              Stress Sim: {stress.survivors} clear / {stress.stranded} stranded
              · surge {(stress.floodLevel * 100).toFixed(0)}%
            </p>
          ) : null}
        </>
      ) : (
        <p className="hud-hint" style={{ marginTop: 0 }}>
          Ask Resilience Critic or run a plan to see validity.
        </p>
      )}
    </aside>
  );
}

export function PhaseBadge() {
  const session = useForgeStore((s) => s.session);
  const busy = useForgeStore((s) => s.busy);
  if (!session) return null;
  const pack = CLIMATE_PACK;

  return (
    <div className="phase-badge" style={{ borderColor: pack.accent }}>
      <span
        className={`phase-dot ${busy ? "pulse" : ""}`}
        style={{ background: pack.accent }}
      />
      {phaseLabel(session.phase)}
    </div>
  );
}

export function AgentHud() {
  return (
    <>
      <AgentsAndGoalsPanel />
      <PlanValidityPanel />
    </>
  );
}

export function EventFeed() {
  return <CognitionPanel />;
}
