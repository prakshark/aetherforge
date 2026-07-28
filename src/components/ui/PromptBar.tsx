"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useForgeStore } from "@/lib/store/forge-store";
import { CLIMATE_PACK } from "@/lib/world/themes";

export function PromptBar() {
  const prompt = useForgeStore((s) => s.prompt);
  const setPrompt = useForgeStore((s) => s.setPrompt);
  const forge = useForgeStore((s) => s.forge);
  const busy = useForgeStore((s) => s.busy);
  const session = useForgeStore((s) => s.session);
  const pack = CLIMATE_PACK;
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      if (text) {
        setPrompt(text);
        void forge(text);
      }
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, [forge, setPrompt]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void forge();
  }

  function toggleVoice() {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("Speech recognition is not available in this browser.");
      return;
    }
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    setListening(true);
    rec.start();
  }

  return (
    <motion.form
      className="prompt-bar"
      onSubmit={onSubmit}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={`voice-btn ${listening ? "listening" : ""}`}
        onClick={toggleVoice}
        aria-label="Voice input"
        style={{ borderColor: pack.accent }}
      >
        <span className="voice-dot" style={{ background: pack.accent }} />
      </button>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={pack.placeholder}
        disabled={busy}
        aria-label="World prompt"
      />
      <button
        type="button"
        className="ghost-btn"
        disabled={busy}
        onClick={() => {
          setPrompt(pack.demoPrompt);
          void forge(pack.demoPrompt);
        }}
      >
        {session ? "Demo again" : "Try demo"}
      </button>
      <button
        type="submit"
        className="forge-btn"
        disabled={busy || !prompt.trim()}
        style={{ background: pack.accent, color: "#0a1210" }}
      >
        {busy ? "Forging…" : session ? "Reforge" : "Forge"}
      </button>
    </motion.form>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}
