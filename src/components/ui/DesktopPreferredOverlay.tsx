"use client";

import { useEffect, useState } from "react";

const QUERY =
  "(max-width: 1024px), (max-width: 1366px) and (pointer: coarse)";

/** Full-screen gate for phones/tablets — Aetherforge is desktop-first. */
export function DesktopPreferredOverlay() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setShow(mq.matches);
    sync();
    setHydrated(true);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // CSS fallback covers pre-hydration; hide it once JS has measured.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "device-gate-js",
      hydrated
    );
    return () => document.documentElement.classList.remove("device-gate-js");
  }, [hydrated]);

  if (!show || dismissed) return null;

  return (
    <div
      className="device-gate"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="device-gate-title"
    >
      <div className="device-gate-card">
        <p className="device-gate-eyebrow">Desktop experience</p>
        <h2 id="device-gate-title">Open Aetherforge on a PC or laptop</h2>
        <p className="device-gate-body">
          This demo is built for a larger screen — the 3D city, agent panels, and
          guided walkthrough need a mouse and a wide viewport for the best view
          and experience.
        </p>
        <p className="device-gate-hint">
          Please switch to a computer, then reload this page.
        </p>
        <button
          type="button"
          className="ghost-btn device-gate-continue"
          onClick={() => setDismissed(true)}
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}

/** Visible via CSS before JS hydrates on small screens. */
export function DesktopPreferredStaticGate() {
  return (
    <div className="device-gate device-gate-static" aria-hidden="true">
      <div className="device-gate-card">
        <p className="device-gate-eyebrow">Desktop experience</p>
        <h2>Open Aetherforge on a PC or laptop</h2>
        <p className="device-gate-body">
          This demo is built for a larger screen — please open it on a computer
          for the best view and experience.
        </p>
      </div>
    </div>
  );
}
