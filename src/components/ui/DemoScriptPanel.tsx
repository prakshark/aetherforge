"use client";

import { useState } from "react";
import { DEMO_SCRIPT } from "@/content/demo-script";

export function DemoScriptPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ghost-btn demo-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide pitch" : "90s pitch"}
      </button>
      {open ? (
        <div className="demo-panel" role="dialog" aria-label="Demo script">
          <h2>{DEMO_SCRIPT.title}</h2>
          <ol>
            {DEMO_SCRIPT.beats.map((b) => (
              <li key={b.t}>
                <strong>{b.t}</strong> — {b.say}
                <br />
                <em>Do: {b.do}</em>
              </li>
            ))}
          </ol>
          <div className="fallback">
            <strong>Flaky WiFi fallback</strong>
            <ul>
              {DEMO_SCRIPT.fallbackRecording.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <strong>Stage checklist</strong>
            <ul>
              {DEMO_SCRIPT.stageChecklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
