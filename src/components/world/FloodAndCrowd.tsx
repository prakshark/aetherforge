"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { WorldEntity, WorldSession } from "@/lib/world/schema";

type StressSim = NonNullable<WorldSession["stressSim"]>;

/** Animated surge water over flood zone + bay rise. */
export function FloodSurge({
  entities,
  stressSim,
}: {
  entities: WorldEntity[];
  stressSim: StressSim;
}) {
  const flood = entities.find((e) => e.kind === "hazard");
  const bay = entities.find((e) => e.kind === "water");
  const sheet = useRef<THREE.Mesh>(null);
  const bayMesh = useRef<THREE.Mesh>(null);
  const level = stressSim.floodLevel;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = stressSim.floodRising
      ? level * (0.85 + Math.sin(t * 1.4) * 0.15)
      : level * 0.7;
    if (sheet.current) {
      sheet.current.position.y = 0.05 + pulse * 0.55;
      const mat = sheet.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + pulse * 0.45;
      mat.emissiveIntensity = 0.2 + pulse * 0.5;
    }
    if (bayMesh.current) {
      bayMesh.current.position.y = -0.05 + pulse * 0.35;
      bayMesh.current.scale.y = 0.35 + pulse * 0.8;
    }
  });

  if (!stressSim.active && level < 0.25) return null;

  return (
    <group>
      {flood ? (
        <mesh
          ref={sheet}
          position={[flood.position.x, 0.12, flood.position.z]}
          scale={[flood.scale.x * 1.15, 1, flood.scale.z * 1.15]}
        >
          <boxGeometry args={[1, 0.2, 1]} />
          <meshStandardMaterial
            color="#2a7fc4"
            transparent
            opacity={0.45}
            roughness={0.08}
            metalness={0.45}
            emissive="#1a4f80"
            emissiveIntensity={0.4}
          />
        </mesh>
      ) : null}
      {bay ? (
        <mesh
          ref={bayMesh}
          position={[bay.position.x, bay.position.y, bay.position.z]}
          scale={[bay.scale.x, 0.4, bay.scale.z]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#1e6a9a"
            transparent
            opacity={0.65}
            roughness={0.1}
            metalness={0.5}
            emissive="#0d3a55"
            emissiveIntensity={0.35}
          />
        </mesh>
      ) : null}
      {stressSim.active ? (
        <Html position={[0, 2.8, 5]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
          <div className="city-label hazard">
            Surge {(level * 100).toFixed(0)}% · {stressSim.survivors} clear /{" "}
            {stressSim.stranded} stranded
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function PersonMesh({
  person,
  entities,
  floodLevel,
}: {
  person: StressSim["people"][number];
  entities: WorldEntity[];
  floodLevel: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const road = useMemo(
    () => entities.find((e) => e.kind === "road"),
    [entities]
  );
  const evac = useMemo(
    () => entities.find((e) => e.kind === "path"),
    [entities]
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * person.speed + person.phase;
    let x = person.x;
    let z = person.z;

    if (person.route === "road" && road) {
      const half = (road.scale.x ?? 10) * 0.45;
      x = road.position.x + Math.sin(t * 0.35) * half;
      z = road.position.z + (person.stranded ? 1.2 : Math.cos(t * 0.2) * 0.55);
    } else if (person.route === "evac" && evac) {
      const half = (evac.scale.z ?? 8) * 0.4;
      x = evac.position.x + Math.sin(t * 0.25) * 0.5;
      z = evac.position.z + Math.cos(t * 0.4) * half;
    } else {
      // flee toward higher ground (negative z / inland)
      x = person.x + Math.sin(t * 0.5) * 1.5;
      z = person.z - (t % 8) * 0.15;
    }

    // Bob + panic hop when stranded in deep flood
    const y =
      0.35 +
      Math.abs(Math.sin(t * (person.stranded ? 6 : 3))) * 0.08 +
      (person.stranded ? floodLevel * 0.25 : 0);

    ref.current.position.set(x, y, z);
    ref.current.rotation.y = Math.atan2(
      Math.cos(t * 0.35),
      Math.sin(t * 0.35)
    );
  });

  return (
    <group ref={ref} position={[person.x, 0.35, person.z]}>
      {/* body */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
        <meshStandardMaterial
          color={person.stranded ? "#ff6b6b" : person.color}
          emissive={person.stranded ? "#ff3333" : person.color}
          emissiveIntensity={person.stranded ? 0.45 : 0.15}
        />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#e8d4c4" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function CrowdLayer({
  entities,
  stressSim,
}: {
  entities: WorldEntity[];
  stressSim: StressSim;
}) {
  if (!stressSim.active || stressSim.people.length === 0) return null;

  return (
    <group>
      {stressSim.people.map((p) => (
        <PersonMesh
          key={p.id}
          person={p}
          entities={entities}
          floodLevel={stressSim.floodLevel}
        />
      ))}
    </group>
  );
}
