"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useForgeStore } from "@/lib/store/forge-store";
import { CLIMATE_PACK } from "@/lib/world/themes";

export function ClickCommandBox() {
  const pending = useForgeStore((s) => s.pendingClick);
  const submitSiteCommand = useForgeStore((s) => s.submitSiteCommand);
  const closeClickCommand = useForgeStore((s) => s.closeClickCommand);
  const busy = useForgeStore((s) => s.busy);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending) {
      setText("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [pending]);

  if (!pending) return null;

  const left = pending.screen?.x ?? window.innerWidth / 2;
  const top = pending.screen?.y ?? window.innerHeight / 2;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    void submitSiteCommand(text.trim());
  }

  return (
    <div
      className="click-command-box"
      style={{
        left: Math.min(Math.max(16, left - 160), window.innerWidth - 340),
        top: Math.min(Math.max(16, top - 20), window.innerHeight - 140),
      }}
    >
      <div className="click-command-title">Site order</div>
      <p className="click-command-hint">
        e.g. add a house here · add a road · add sewer · add park · add levee
      </p>
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What should we build here?"
          disabled={busy}
          aria-label="Spatial site command"
        />
        <div className="click-command-actions">
          <button type="button" className="ghost-btn" onClick={closeClickCommand}>
            Cancel
          </button>
          <button
            type="submit"
            className="forge-btn"
            disabled={busy || !text.trim()}
            style={{ background: CLIMATE_PACK.accent, color: "#0a1210" }}
          >
            {busy ? "Replanning…" : "Apply & replan"}
          </button>
        </div>
      </form>
    </div>
  );
}
