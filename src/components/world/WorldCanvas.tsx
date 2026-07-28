"use client";

import { Component, ReactNode, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Float,
  Html,
  Line,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { AgentState, WorldEntity, WorldSpec } from "@/lib/world/schema";
import { useForgeStore } from "@/lib/store/forge-store";
import { useTourStore } from "@/lib/store/tour-store";
import { entityMatchesHighlight } from "@/lib/tour/highlight";
import { CLIMATE_PACK } from "@/lib/world/themes";
import { CrowdLayer, FloodSurge } from "@/components/world/FloodAndCrowd";

class CanvasErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "Scene failed to render" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="world-empty">
          <p className="world-empty-kicker">Scene hitch</p>
          <p className="world-empty-hint">{this.state.error}</p>
          <button
            type="button"
            className="forge-btn"
            style={{
              justifySelf: "center",
              background: "#3db8a0",
              color: "#0a1210",
            }}
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            Retry scene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useClickHandlers(
  entity: WorldEntity,
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void
) {
  return {
    onClick: (ev: ThreeEvent<MouseEvent>) => {
      ev.stopPropagation();
      onSelect(
        entity,
        ev.point,
        ev.nativeEvent.clientX,
        ev.nativeEvent.clientY
      );
    },
    onPointerOver: (ev: ThreeEvent<PointerEvent>) => {
      ev.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "default";
    },
  };
}

/** Real-looking house: walls, pitched roof, door, windows. */
function HouseMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const flooded = Boolean(entity.meta?.flooded) || (entity.intensity ?? 0) > 0.4;
  const wall = entity.color ?? "#c9b396";
  const roof = flooded ? "#5a6a78" : "#6b3f2e";
  const sx = entity.scale.x;
  const sy = entity.scale.y;
  const sz = entity.scale.z;
  const x = entity.position.x;
  const z = entity.position.z;
  // Place house so ground sits on y≈0
  const baseY = sy * 0.5;

  return (
    <group position={[x, 0, z]} rotation={[0, entity.rotationY ?? 0, 0]} {...handlers}>
      {/* Foundation */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx * 1.05, 0.12, sz * 1.05]} />
        <meshStandardMaterial color="#5c5c58" roughness={0.9} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, baseY, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      {/* Roof (pitched) */}
      <mesh
        position={[0, baseY + sy * 0.5 + sy * 0.22, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <coneGeometry args={[Math.max(sx, sz) * 0.78, sy * 0.55, 4]} />
        <meshStandardMaterial color={roof} roughness={0.7} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.45, sz * 0.51]} castShadow>
        <boxGeometry args={[sx * 0.28, 0.75, 0.06]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.8} />
      </mesh>
      {/* Windows */}
      <mesh position={[-sx * 0.28, baseY * 0.85, sz * 0.51]}>
        <boxGeometry args={[sx * 0.22, sy * 0.28, 0.05]} />
        <meshStandardMaterial
          color={flooded ? "#7ec8ff" : "#dce9f5"}
          emissive={flooded ? "#3b82c4" : "#a8c4d8"}
          emissiveIntensity={flooded ? 0.35 : 0.15}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[sx * 0.28, baseY * 0.85, sz * 0.51]}>
        <boxGeometry args={[sx * 0.22, sy * 0.28, 0.05]} />
        <meshStandardMaterial
          color={flooded ? "#7ec8ff" : "#dce9f5"}
          emissive={flooded ? "#3b82c4" : "#a8c4d8"}
          emissiveIntensity={flooded ? 0.35 : 0.15}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      {/* Chimney */}
      <mesh position={[sx * 0.28, baseY + sy * 0.55, -sz * 0.15]} castShadow>
        <boxGeometry args={[0.18, 0.45, 0.18]} />
        <meshStandardMaterial color="#6a5550" roughness={0.9} />
      </mesh>
      {/* Flood watermark on house foundation only — no floating Home N labels */}
      {flooded ? (
        <mesh position={[0, 0.18, 0]} receiveShadow>
          <boxGeometry args={[sx * 1.4, 0.12, sz * 1.4]} />
          <meshStandardMaterial
            color="#2f6f9e"
            transparent
            opacity={0.45}
            roughness={0.15}
            metalness={0.35}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function RoadMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const wet = (entity.intensity ?? 0) > 0.35;
  const { x, z } = entity.position;
  const sx = entity.scale.x;
  const sz = entity.scale.z;
  const hideLabel = Boolean(entity.meta?.hideLabel);

  return (
    <group position={[x, 0.05, z]} rotation={[0, entity.rotationY ?? 0, 0]} {...handlers}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[sx, 0.1, sz]} />
        <meshStandardMaterial
          color={wet ? "#2a3340" : "#3a3d45"}
          roughness={wet ? 0.35 : 0.95}
          metalness={wet ? 0.25 : 0.05}
        />
      </mesh>
      {/* Center dashed line */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[sx * 0.92, 0.02, Math.min(0.12, sz * 0.12)]} />
        <meshStandardMaterial
          color="#e8d56a"
          emissive="#c4a832"
          emissiveIntensity={0.2}
          roughness={0.6}
        />
      </mesh>
      {/* Side curbs */}
      <mesh position={[0, 0.08, sz * 0.52]}>
        <boxGeometry args={[sx, 0.12, 0.12]} />
        <meshStandardMaterial color="#7a7a78" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, -sz * 0.52]}>
        <boxGeometry args={[sx, 0.12, 0.12]} />
        <meshStandardMaterial color="#7a7a78" roughness={0.9} />
      </mesh>
      {!hideLabel ? (
        <Html
          zIndexRange={[8, 0]}
          position={[0, 1.1, 0]}
          center
          distanceFactor={18}
          occlude={false}
          style={{ pointerEvents: "none" }}
        >
          <div className="city-label">
            {entity.label}
            {wet ? " · flooded" : ""}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function WaterMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const deep = useRef<THREE.Mesh>(null);
  const surface = useRef<THREE.Mesh>(null);
  const foam = useRef<THREE.Mesh>(null);
  const sparkle = useRef<THREE.Mesh>(null);
  const style = String(entity.meta?.waterStyle ?? "bay");
  const sx = entity.scale.x;
  const sy = entity.scale.y;
  const sz = entity.scale.z;
  const baseColor = entity.color ?? "#0f4a72";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (surface.current) {
      surface.current.position.y = 0.06 + Math.sin(t * 0.9) * 0.045;
      const mat = surface.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.62 + Math.sin(t * 1.4) * 0.06;
    }
    if (foam.current) {
      foam.current.position.y = 0.1 + Math.sin(t * 1.6) * 0.02;
      const mat = foam.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.35 + Math.sin(t * 2.2) * 0.12;
    }
    if (sparkle.current) {
      sparkle.current.rotation.y = t * 0.15;
      sparkle.current.position.y = 0.08 + Math.sin(t * 1.1 + 1) * 0.03;
    }
    if (deep.current) {
      deep.current.position.y = -sy * 0.35 + Math.sin(t * 0.35) * 0.01;
    }
  });

  return (
    <group
      position={[entity.position.x, entity.position.y, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      {/* Deep volume */}
      <mesh ref={deep} receiveShadow position={[0, -sy * 0.35, 0]}>
        <boxGeometry args={[sx, sy * 1.1, sz]} />
        <meshStandardMaterial
          color="#062538"
          transparent
          opacity={0.92}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>

      {/* Mid body */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[sx * 0.98, sy * 0.55, sz * 0.98]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={0.78}
          roughness={0.18}
          metalness={0.55}
          emissive="#0a3050"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Animated surface sheet */}
      <mesh
        ref={surface}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
      >
        <planeGeometry args={[sx * 0.96, sz * 0.96, 24, 12]} />
        <meshStandardMaterial
          color="#3aa0d0"
          transparent
          opacity={0.65}
          roughness={0.08}
          metalness={0.7}
          emissive="#1a6a9a"
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Shore foam / wave line (bay only, along land edge = -Z) */}
      {style === "bay" ? (
        <>
          <mesh
            ref={foam}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.1, -sz * 0.42]}
          >
            <planeGeometry args={[sx * 0.9, sz * 0.12]} />
            <meshStandardMaterial
              color="#d8eef8"
              transparent
              opacity={0.4}
              roughness={0.3}
              emissive="#ffffff"
              emissiveIntensity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Sand / pebble shelf */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, -sz * 0.48]}
            receiveShadow
          >
            <planeGeometry args={[sx * 0.95, 1.4]} />
            <meshStandardMaterial color="#c2b18a" roughness={0.95} />
          </mesh>
          {/* Darker offshore band */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.04, sz * 0.2]}
          >
            <planeGeometry args={[sx * 0.85, sz * 0.35]} />
            <meshStandardMaterial
              color="#0a3558"
              transparent
              opacity={0.55}
              roughness={0.2}
              metalness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      ) : null}

      {/* Canal banks */}
      {style === "canal" ? (
        <>
          <mesh position={[sx * 0.52, 0.2, 0]}>
            <boxGeometry args={[0.35, 0.55, sz]} />
            <meshStandardMaterial color="#5c5c58" roughness={0.9} />
          </mesh>
          <mesh position={[-sx * 0.52, 0.2, 0]}>
            <boxGeometry args={[0.35, 0.55, sz]} />
            <meshStandardMaterial color="#5c5c58" roughness={0.9} />
          </mesh>
          <mesh
            ref={foam}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.12, 0]}
          >
            <planeGeometry args={[sx * 0.7, sz * 0.85]} />
            <meshStandardMaterial
              color="#7ec8e8"
              transparent
              opacity={0.35}
              roughness={0.15}
              metalness={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      ) : null}

      {/* Soft caustic sparkles */}
      <mesh ref={sparkle} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[Math.min(sx, sz) * 0.12, Math.min(sx, sz) * 0.28, 32]} />
        <meshBasicMaterial color="#9fdcff" transparent opacity={0.18} />
      </mesh>

      <Html
        zIndexRange={[8, 0]}
        position={[0, 1.35, style === "bay" ? -sz * 0.15 : 0]}
        center
        distanceFactor={20}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label water-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function PierMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const sx = entity.scale.x;
  const sy = entity.scale.y;
  const sz = entity.scale.z;

  return (
    <group
      position={[entity.position.x, 0, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      <mesh position={[0, sy, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={entity.color ?? "#6b5344"} roughness={0.85} />
      </mesh>
      {[-0.35, 0.35].map((ox) =>
        [-0.4, -0.1, 0.2, 0.45].map((tz) => (
          <mesh
            key={`${ox}-${tz}`}
            position={[sx * ox, sy * 0.2, sz * tz]}
            castShadow
          >
            <cylinderGeometry args={[0.08, 0.1, 0.9, 6]} />
            <meshStandardMaterial color="#4a3a30" roughness={0.9} />
          </mesh>
        ))
      )}
      <Html
        zIndexRange={[8, 0]}
        position={[0, 1.1, 0]}
        center
        distanceFactor={16}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function ShopMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const sx = entity.scale.x;
  const sy = entity.scale.y;
  const sz = entity.scale.z;
  const wall = entity.color ?? "#8b9aab";
  const style = String(entity.meta?.buildingStyle ?? "shop");
  const flatRoof = style === "shop" || style === "warehouse" || style === "civic";

  return (
    <group
      position={[entity.position.x, 0, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx * 1.05, 0.12, sz * 1.05]} />
        <meshStandardMaterial color="#555552" roughness={0.9} />
      </mesh>
      <mesh position={[0, sy * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={wall} roughness={0.8} />
      </mesh>
      {flatRoof ? (
        <mesh position={[0, sy + 0.08, 0]} castShadow>
          <boxGeometry args={[sx * 1.08, 0.16, sz * 1.08]} />
          <meshStandardMaterial color="#3d4450" roughness={0.7} />
        </mesh>
      ) : (
        <mesh
          position={[0, sy + sy * 0.22, 0]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
        >
          <coneGeometry args={[Math.max(sx, sz) * 0.78, sy * 0.45, 4]} />
          <meshStandardMaterial color="#5a4038" roughness={0.7} />
        </mesh>
      )}
      {/* Storefront glass */}
      <mesh position={[0, sy * 0.45, sz * 0.51]}>
        <boxGeometry args={[sx * 0.7, sy * 0.45, 0.06]} />
        <meshStandardMaterial
          color="#b8d4e8"
          emissive="#6a9bbb"
          emissiveIntensity={0.25}
          roughness={0.15}
          metalness={0.4}
        />
      </mesh>
      {style === "civic" ? (
        <mesh position={[0, sy + 0.35, 0]} castShadow>
          <boxGeometry args={[0.35, 0.55, 0.35]} />
          <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
        </mesh>
      ) : null}
      <Html
        zIndexRange={[8, 0]}
        position={[0, sy + 0.7, 0]}
        center
        distanceFactor={16}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function FloodHazardMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const intensity = entity.intensity ?? 0.5;

  return (
    <group
      position={[entity.position.x, 0.08, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      <mesh receiveShadow>
        <boxGeometry args={[entity.scale.x, 0.08, entity.scale.z]} />
        <meshStandardMaterial
          color="#2f7ab8"
          transparent
          opacity={0.35 + intensity * 0.35}
          roughness={0.1}
          metalness={0.4}
          emissive="#1e5a8a"
          emissiveIntensity={0.4}
        />
      </mesh>
      <Html
        zIndexRange={[8, 0]} position={[0, 0.7, 0]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
        <div className="city-label hazard">Flood zone — click to fix</div>
      </Html>
    </group>
  );
}

function LeveeMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const { x, z } = entity.position;
  const sx = entity.scale.x;
  const sy = entity.scale.y;
  const sz = entity.scale.z;

  return (
    <group position={[x, 0, z]} rotation={[0, entity.rotationY ?? 0, 0]} {...handlers}>
      {/* Earthen berm */}
      <mesh position={[0, sy * 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy * 0.7, sz]} />
        <meshStandardMaterial color="#4a6b45" roughness={0.95} />
      </mesh>
      <mesh position={[0, sy * 0.75, 0]} castShadow>
        <boxGeometry args={[sx * 0.92, sy * 0.25, sz * 0.7]} />
        <meshStandardMaterial color="#3d5c38" roughness={0.9} />
      </mesh>
      {/* Grass top */}
      <mesh position={[0, sy * 0.92, 0]}>
        <boxGeometry args={[sx * 0.88, 0.08, sz * 0.55]} />
        <meshStandardMaterial color="#5f9a4e" roughness={1} />
      </mesh>
      <Html
        zIndexRange={[8, 0]}
        position={[0, sy + 0.85, 0]}
        center
        distanceFactor={16}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function EvacPathMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  return (
    <group
      position={[entity.position.x, 0.12, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      <mesh receiveShadow>
        <boxGeometry args={[entity.scale.x, 0.06, entity.scale.z]} />
        <meshStandardMaterial
          color="#f0c94d"
          emissive="#c9a020"
          emissiveIntensity={0.45}
          roughness={0.5}
        />
      </mesh>
      {/* Single label at path midpoint height — not along the length */}
      <Html
        zIndexRange={[8, 0]}
        position={[0, 1.2, entity.scale.z * 0.35]}
        center
        distanceFactor={18}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function TerrainMesh({ entity }: { entity: WorldEntity }) {
  return (
    <mesh
      position={[entity.position.x, 0.02, entity.position.z]}
      rotation={[-Math.PI / 2, 0, entity.rotationY ?? 0]}
      receiveShadow
    >
      <planeGeometry args={[entity.scale.x, entity.scale.z]} />
      <meshStandardMaterial color={entity.color ?? "#3a5a3e"} roughness={1} />
    </mesh>
  );
}

function GenericCityMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const isMarker = entity.kind === "marker";
  return (
    <group
      position={[entity.position.x, entity.position.y, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      <mesh
        scale={[entity.scale.x, entity.scale.y, entity.scale.z]}
        castShadow
        receiveShadow
      >
        {isMarker ? (
          <cylinderGeometry args={[0.25, 0.35, 1, 8]} />
        ) : entity.kind === "vegetation" ? (
          <coneGeometry args={[0.5, 1, 7]} />
        ) : (
          <boxGeometry args={[1, 1, 1]} />
        )}
        <meshStandardMaterial
          color={entity.color ?? "#8899aa"}
          roughness={0.75}
          emissive={isMarker ? entity.color ?? "#f0d060" : "#000000"}
          emissiveIntensity={isMarker ? 0.4 : 0}
        />
      </mesh>
      {isMarker ? (
        <Html
        zIndexRange={[8, 0]}
          position={[0, entity.scale.y * 0.7 + 0.5, 0]}
          center
          distanceFactor={16}
          style={{ pointerEvents: "none" }}
        >
          <div className="city-label">{entity.label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function TreeMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const h = entity.scale.y;
  const isPark = entity.meta?.infra === "park";

  if (isPark) {
    const sx = entity.scale.x;
    const sz = entity.scale.z;
    return (
      <group
        position={[entity.position.x, 0, entity.position.z]}
        {...handlers}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
          <planeGeometry args={[sx, sz]} />
          <meshStandardMaterial color="#2f6b3c" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[Math.min(sx, sz) * 0.22, 16]} />
          <meshStandardMaterial color="#3a7a9a" transparent opacity={0.55} />
        </mesh>
        {[
          [-0.9, -0.7],
          [0.8, -0.5],
          [-0.6, 0.7],
          [0.7, 0.6],
          [0.1, 0.1],
        ].map(([px, pz], i) => (
          <group key={i} position={[px * sx * 0.35, 0, pz * sz * 0.35]}>
            <mesh position={[0, 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.1, 0.7, 6]} />
              <meshStandardMaterial color="#5c4033" />
            </mesh>
            <mesh position={[0, 0.85, 0]} castShadow>
              <sphereGeometry args={[0.42, 10, 10]} />
              <meshStandardMaterial color={entity.color ?? "#3d8b4f"} />
            </mesh>
          </group>
        ))}
        <Html
          zIndexRange={[8, 0]}
          position={[0, 1.6, 0]}
          center
          distanceFactor={16}
          style={{ pointerEvents: "none" }}
        >
          <div className="city-label">{entity.label}</div>
        </Html>
      </group>
    );
  }

  return (
    <group
      position={[entity.position.x, 0, entity.position.z]}
      {...handlers}
    >
      <mesh position={[0, h * 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, h * 0.5, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.95} />
      </mesh>
      <mesh position={[0, h * 0.7, 0]} castShadow>
        <sphereGeometry args={[0.55 * entity.scale.x, 12, 12]} />
        <meshStandardMaterial color={entity.color ?? "#3f7a45"} roughness={0.9} />
      </mesh>
    </group>
  );
}

function SewerMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  const handlers = useClickHandlers(entity, onSelect);
  const len = Math.max(entity.scale.x, 1.2);
  const pipeColor = entity.color ?? "#d4a574";

  return (
    <group
      position={[entity.position.x, 0.28, entity.position.z]}
      rotation={[0, entity.rotationY ?? 0, 0]}
      {...handlers}
    >
      {/* Ground trench marker so the run reads on dark grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 0]} receiveShadow>
        <planeGeometry args={[len + 0.4, 0.85]} />
        <meshStandardMaterial color="#1a1612" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <planeGeometry args={[len + 0.15, 0.18]} />
        <meshBasicMaterial color="#f0c94d" transparent opacity={0.85} />
      </mesh>

      {/* Main trunk — warm concrete / copper so it pops on green */}
      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, len, 16]} />
        <meshStandardMaterial
          color={pipeColor}
          metalness={0.35}
          roughness={0.4}
          emissive="#8a5a2b"
          emissiveIntensity={0.22}
        />
      </mesh>
      {/* Safety stripe along the crown */}
      <mesh position={[0, 0.29, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, len * 0.98, 8]} />
        <meshBasicMaterial color="#f5d76e" />
      </mesh>

      {/* Manholes at ends */}
      {[-0.38, 0.38].map((t) => (
        <group key={t} position={[len * t, 0.08, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.18, 16]} />
            <meshStandardMaterial
              color="#c9ced6"
              metalness={0.7}
              roughness={0.25}
              emissive="#9aa3b0"
              emissiveIntensity={0.15}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.26, 16]} />
            <meshBasicMaterial color="#2a3038" />
          </mesh>
        </group>
      ))}

      <Html
        zIndexRange={[8, 0]}
        position={[0, 1.05, 0]}
        center
        distanceFactor={16}
        style={{ pointerEvents: "none" }}
      >
        <div className="city-label sewer-label">{entity.label}</div>
      </Html>
    </group>
  );
}

function EntityMesh({
  entity,
  onSelect,
}: {
  entity: WorldEntity;
  onSelect: (
    e: WorldEntity,
    point: THREE.Vector3,
    clientX: number,
    clientY: number
  ) => void;
}) {
  if (entity.kind === "building") {
    const style = String(entity.meta?.buildingStyle ?? "house");
    if (style === "shop" || style === "warehouse" || style === "civic") {
      return <ShopMesh entity={entity} onSelect={onSelect} />;
    }
    return <HouseMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "road") {
    return <RoadMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "water") {
    return <WaterMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "hazard") {
    return <FloodHazardMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "structure" && entity.meta?.infra === "sewer") {
    return <SewerMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "structure" && entity.meta?.infra === "pier") {
    return <PierMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "structure") {
    return <LeveeMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "path") {
    return <EvacPathMesh entity={entity} onSelect={onSelect} />;
  }
  if (entity.kind === "terrain") {
    return <TerrainMesh entity={entity} />;
  }
  if (entity.kind === "vegetation") {
    return <TreeMesh entity={entity} onSelect={onSelect} />;
  }
  return <GenericCityMesh entity={entity} onSelect={onSelect} />;
}

function TourCameraRig() {
  const cameraGoal = useTourStore((s) => s.camera);
  const locked = useTourStore((s) => s.locked);
  const active = useTourStore((s) => s.active);
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const goalPos = useRef(new THREE.Vector3());
  const goalTgt = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!active) {
      if (controls) controls.enabled = true;
      return;
    }
    goalPos.current.set(...cameraGoal.position);
    goalTgt.current.set(...cameraGoal.target);
    camera.position.lerp(goalPos.current, 0.055);
    if (controls) {
      controls.target.lerp(goalTgt.current, 0.055);
      controls.enabled = !locked;
      controls.update();
    }
  });

  return null;
}

function HighlightAura({ entity }: { entity: WorldEntity }) {
  const highlight = useTourStore((s) => s.highlight);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const matched = entityMatchesHighlight(entity, highlight);

  useFrame(({ clock }) => {
    if (!mat.current || !matched) return;
    mat.current.opacity = 0.35 + Math.sin(clock.elapsedTime * 4.2) * 0.22;
  });

  if (!matched) return null;

  const rx = Math.max(entity.scale.x, entity.scale.z, 0.8) * 0.72;
  const ry = rx * 1.28;

  return (
    <mesh
      position={[entity.position.x, 0.06, entity.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[rx, ry, 48]} />
      <meshBasicMaterial
        ref={mat}
        color="#5eead4"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Hovering holographic drone — clearly NOT city infrastructure. */
function AgentMesh({ agent }: { agent: AgentState }) {
  const tourActive = useTourStore((s) => s.active);
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const hoverY = 3.2;

  const trailPoints = useMemo(() => {
    const pts = [...agent.trail, agent.position].map(
      (p) => new THREE.Vector3(p.x, (p.y < 2 ? hoverY : p.y), p.z)
    );
    return pts.length >= 2 ? pts : null;
  }, [agent.trail, agent.position]);

  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 1.6;
    if (group.current) {
      group.current.position.y =
        hoverY + Math.sin(clock.elapsedTime * 2 + agent.position.x) * 0.15;
    }
  });

  return (
    <group position={[agent.position.x, 0, agent.position.z]}>
      {/* Ground spotlight marker so you see projection onto city */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.35, 0.55, 32]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.55} />
      </mesh>
      {/* Vertical hologram beam */}
      <mesh position={[0, hoverY * 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.08, hoverY, 8]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.25} />
      </mesh>

      <group ref={group} position={[0, hoverY, 0]}>
        <Float speed={3} floatIntensity={0.25} rotationIntensity={0.4}>
          {/* Outer ring */}
          <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.045, 12, 48]} />
            <meshStandardMaterial
              color={agent.color}
              emissive={agent.color}
              emissiveIntensity={1.2}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
          {/* Core diamond */}
          <mesh>
            <octahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial
              color="#0a1218"
              emissive={agent.color}
              emissiveIntensity={0.9}
              metalness={0.8}
              roughness={0.15}
              wireframe={false}
            />
          </mesh>
          <mesh>
            <octahedronGeometry args={[0.32, 0]} />
            <meshBasicMaterial color={agent.color} wireframe transparent opacity={0.7} />
          </mesh>
        </Float>

        {!tourActive ? (
          <Html
            position={[0, 0.95, 0]}
            center
            distanceFactor={12}
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div className="agent-hud-chip" style={{ borderColor: agent.color }}>
              <span className="agent-hud-badge">AI AGENT</span>
              <span className="agent-hud-name" style={{ color: agent.color }}>
                {agent.name}
              </span>
              {agent.currentThought ? (
                <span className="agent-hud-thought">
                  {agent.currentThought.slice(0, 48)}
                </span>
              ) : null}
            </div>
          </Html>
        ) : null}
      </group>

      {trailPoints ? (
        <Line
          points={trailPoints}
          color={agent.color}
          lineWidth={1.5}
          dashed
          dashScale={8}
          dashSize={0.35}
          gapSize={0.2}
          transparent
          opacity={0.55}
        />
      ) : null}
    </group>
  );
}

function SceneContent({
  world,
  agents,
  stressSim,
}: {
  world: WorldSpec;
  agents: AgentState[];
  stressSim: NonNullable<ReturnType<typeof useForgeStore.getState>["session"]>["stressSim"];
}) {
  const openClickCommand = useForgeStore((s) => s.openClickCommand);
  const tourLocked = useTourStore((s) => s.locked);
  const atm = world.atmosphere;

  function openAt(
    point: THREE.Vector3,
    clientX: number,
    clientY: number,
    entityId?: string,
    label?: string
  ) {
    if (tourLocked) return;
    openClickCommand({
      position: { x: point.x, y: point.y, z: point.z },
      entityId,
      label,
      screen: { x: clientX, y: clientY },
    });
  }

  return (
    <>
      <TourCameraRig />
      <color attach="background" args={[atm.skyColor]} />
      <fog attach="fog" args={[atm.fogColor, atm.fogNear, atm.fogFar]} />
      <ambientLight intensity={Math.max(0.55, atm.ambientIntensity)} />
      <directionalLight
        castShadow
        position={[14, 20, 10]}
        intensity={atm.sunIntensity * 1.15}
        color={atm.sunColor}
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight
        intensity={0.45}
        color="#d8e6f2"
        groundColor="#2a3a28"
      />

      {world.entities.map((e) => (
        <group key={e.id}>
          <EntityMesh
            entity={e}
            onSelect={(entity, point, clientX, clientY) => {
              openAt(point, clientX, clientY, entity.id, entity.label);
            }}
          />
          <HighlightAura entity={e} />
        </group>
      ))}

      {stressSim ? (
        <>
          <FloodSurge entities={world.entities} stressSim={stressSim} />
          <CrowdLayer entities={world.entities} stressSim={stressSim} />
        </>
      ) : null}

      {agents.map((a) => (
        <AgentMesh key={a.id} agent={a} />
      ))}

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={40}
        blur={2.2}
        far={14}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.03, 0]}
        receiveShadow
        onClick={(ev) => {
          openAt(ev.point, ev.nativeEvent.clientX, ev.nativeEvent.clientY);
        }}
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#1c2a22" roughness={1} />
      </mesh>

      <OrbitControls
        makeDefault
        enablePan={!tourLocked}
        enableZoom={!tourLocked}
        enableRotate={!tourLocked}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={6}
        maxDistance={55}
        target={[0, 1, 0]}
      />
    </>
  );
}

export function WorldCanvas() {
  const session = useForgeStore((s) => s.session);
  const tourActive = useTourStore((s) => s.active);
  const pack = CLIMATE_PACK;

  if (!session) {
    return (
      <div className="world-empty">
        <div className="world-empty-glow" style={{ background: pack.accentSoft }} />
        <p className="world-empty-kicker">Aetherforge</p>
        <p className="world-empty-hint">
          {tourActive
            ? "Forging the coastal town for your walkthrough…"
            : "AI agents build a 3D flood-resilience world from your idea — then you click problems and they fix them."}
        </p>
        {!tourActive ? (
          <ol className="world-empty-steps">
            <li>
              Open <strong>How to use</strong> for the guided tour
            </li>
            <li>Or type a brief below and press Forge</li>
            <li>Click the map to place houses, sewers, roads…</li>
          </ol>
        ) : null}
      </div>
    );
  }

  const sky = session.world.atmosphere.skyColor;

  return (
    <CanvasErrorBoundary>
      <div className="world-canvas-host">
        <Canvas
          shadows
          camera={{ position: [20, 14, 22], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            background: sky,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(sky, 1);
          }}
        >
          <SceneContent
            world={session.world}
            agents={session.agents}
            stressSim={session.stressSim}
          />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}
