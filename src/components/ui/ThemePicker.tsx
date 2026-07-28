"use client";

import { motion } from "framer-motion";
import { CLIMATE_PACK } from "@/lib/world/themes";

export function BrandMark() {
  const pack = CLIMATE_PACK;

  return (
    <motion.header
      className="brand"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="brand-title">Aetherforge</h1>
      <p className="brand-tag">{pack.tagline}</p>
    </motion.header>
  );
}
