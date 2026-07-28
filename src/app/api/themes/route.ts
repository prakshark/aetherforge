import { NextResponse } from "next/server";
import { CLIMATE_PACK } from "@/lib/world/themes";

export async function GET() {
  return NextResponse.json({
    themes: [
      {
        id: CLIMATE_PACK.id,
        name: "Aetherforge",
        tagline: CLIMATE_PACK.tagline,
        accent: CLIMATE_PACK.accent,
        placeholder: CLIMATE_PACK.placeholder,
        demoPrompt: CLIMATE_PACK.demoPrompt,
      },
    ],
  });
}
