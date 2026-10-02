"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Visor 3D de una pieza (Taller 3D, compartido storefront ↔ admin).
 *
 * - Z arriba (como el STL y el laminador), pieza apoyada en z = 0 y centrada
 *   en la cama. La cama se dibuja con una grilla cada 10 mm (línea fuerte
 *   cada 50) y el volumen de impresión como una caja de aristas tenues.
 * - Los colores de la grilla salen del `color` CSS del contenedor
 *   (`currentColor`): en la tienda `text-fg-muted`, en el admin
 *   `text-adm-fg-muted`. El fondo es transparente (lo pone el contenedor).
 * - Un solo contexto WebGL por instancia; se renderiza a demanda (sin loop)
 *   y al desmontar se liberan geometrías, materiales y el renderer.
 * - Cargalo con `next/dynamic(..., { ssr: false })`: usa `window` y WebGL.
 */

export interface ViewerProps {
  /** 9 floats por triángulo, en las unidades del archivo. `null` = sin pieza. */
  positions: Float32Array | null;
  /** Factor a mm (unidad × escala). */
  scale?: number;
  /** Hex del filamento. */
  color: string;
  /** Cama de la impresora más grande [x, y, z] en mm (null = grilla a medida de la pieza). */
  bed?: [number, number, number] | null;
  className?: string;
  /** Texto accesible del canvas. */
  label?: string;
  /** Cambiarlo vuelve a encuadrar la pieza. */
  resetSignal?: number;
  /** Miniatura PNG (sin la cama) después de cada cambio de pieza, escala o color. */
  onSnapshot?: (dataUrl: string) => void;
  /** Qué mostrar si el navegador no tiene WebGL. */
  fallback?: ReactNode;
  /** Capas encima del canvas (botones, medidas). */
  children?: ReactNode;
}

interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  bed: Group;
  piece: Mesh<BufferGeometry, MeshStandardMaterial> | null;
  /** bbox de la geometría cruda (sin escalar). */
  raw: { min: Vector3; size: Vector3 } | null;
  render: () => void;
}

function disposeObject(root: Group | Mesh) {
  root.traverse((obj) => {
    const withGeo = obj as Partial<Mesh>;
    withGeo.geometry?.dispose();
    const mat = withGeo.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/** Grilla de la cama + contorno + volumen de impresión. */
function buildBed(size: [number, number, number], ink: Color): Group {
  const [bx, by, bz] = size;
  const group = new Group();
  const minor: number[] = [];
  const major: number[] = [];
  const hx = bx / 2;
  const hy = by / 2;
  for (let x = 0; x <= bx + 1e-6; x += 10) {
    (Math.round(x) % 50 === 0 ? major : minor).push(x - hx, -hy, 0, x - hx, hy, 0);
  }
  for (let y = 0; y <= by + 1e-6; y += 10) {
    (Math.round(y) % 50 === 0 ? major : minor).push(-hx, y - hy, 0, hx, y - hy, 0);
  }
  const lines = (arr: number[], opacity: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
    return new LineSegments(g, new LineBasicMaterial({ color: ink, transparent: true, opacity, depthWrite: false }));
  };
  group.add(lines(minor, 0.16), lines(major, 0.34));

  // Placa: un velo apenas visible para que la cama se lea como superficie.
  const plate = new Mesh(
    new PlaneGeometry(bx, by),
    new MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.05, depthWrite: false }),
  );
  plate.position.z = -0.05;
  group.add(plate);

  // Contorno de la cama y volumen de impresión.
  const outline = lines([-hx, -hy, 0, hx, -hy, 0, hx, -hy, 0, hx, hy, 0, hx, hy, 0, -hx, hy, 0, -hx, hy, 0, -hx, -hy, 0], 0.7);
  group.add(outline);
  const volume = new LineSegments(
    new EdgesGeometry(new BoxGeometry(bx, by, bz)),
    new LineBasicMaterial({ color: ink, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  volume.position.z = bz / 2;
  group.add(volume);
  return group;
}

function inkFrom(el: HTMLElement): Color {
  const css = getComputedStyle(el).color;
  const c = new Color();
  try {
    // `rgb(…)` / `rgba(…)`: three toma el color e ignora el alfa.
    c.setStyle(css.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, "rgb($1,$2,$3)"));
  } catch {
    c.set("#888888");
  }
  return c;
}

function webglAvailable(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function Viewer({
  positions,
  scale = 1,
  color,
  bed = null,
  className,
  label = "Vista 3D de la pieza",
  resetSignal = 0,
  onSnapshot,
  fallback,
  children,
}: ViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  // Sin WebGL (navegador viejo, aceleración apagada): se muestra el `fallback`.
  const [failed, setFailed] = useState(() => !webglAvailable());
  const snapshotRef = useRef(onSnapshot);
  const snapshotTimer = useRef<number | null>(null);
  const bedKey = bed ? bed.join("x") : "";
  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  // --- Escena (una vez por montaje) ------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      // Raro (se chequeó al montar), pero puede pasar si el navegador se queda sin contextos.
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);
    host.prepend(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.5, 20_000);
    camera.up.set(0, 0, 1);
    scene.add(new HemisphereLight(0xffffff, 0x8a8a8a, 1.5));
    scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(1, -1.4, 2.2);
    scene.add(key);
    const rim = new DirectionalLight(0xffffff, 0.55);
    rim.position.set(-1.5, 1.2, 0.6);
    scene.add(rim);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.62; // un poco por debajo de la cama, no más

    const bedGroup = new Group();
    scene.add(bedGroup);

    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);

    const stage: Stage = { renderer, scene, camera, controls, bed: bedGroup, piece: null, raw: null, render };
    stageRef.current = stage;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      ro.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      disposeObject(bedGroup);
      if (stage.piece) disposeObject(stage.piece);
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      stageRef.current = null;
    };
    // `label` sólo al crear el canvas; se actualiza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stageRef.current?.renderer.domElement.setAttribute("aria-label", label);
  }, [label]);

  // --- Encuadre, cama y miniatura -------------------------------------------
  const frame = () => {
    const stage = stageRef.current;
    const host = hostRef.current;
    if (!stage || !host) return;
    const { camera, controls, raw } = stage;
    const size = raw ? raw.size.clone().multiplyScalar(scale) : new Vector3(40, 40, 40);

    // Cama: la de la impresora o una grilla a medida de la pieza.
    disposeObject(stage.bed);
    stage.bed.clear();
    const bedSize: [number, number, number] = bed ?? [
      Math.max(60, Math.ceil((size.x * 1.6) / 10) * 10),
      Math.max(60, Math.ceil((size.y * 1.6) / 10) * 10),
      Math.max(60, Math.ceil((size.z * 1.3) / 10) * 10),
    ];
    stage.bed.add(buildBed(bedSize, inkFrom(host)));

    // Cámara: encuadra la pieza (la cama se ve alrededor; con la rueda se aleja).
    const radius = Math.max(size.length() / 2, 8);
    const dist = (radius / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.08;
    const target = new Vector3(0, 0, size.z / 2);
    const dir = new Vector3(0.85, -1.25, 0.95).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.near = Math.max(dist / 200, 0.1);
    camera.far = dist * 40 + Math.max(...bedSize) * 4;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.minDistance = radius * 0.6;
    controls.maxDistance = Math.max(dist * 6, Math.max(...bedSize) * 3);
    controls.update();
    stage.render();
  };

  const scheduleSnapshot = () => {
    if (!snapshotRef.current) return;
    if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
    snapshotTimer.current = window.setTimeout(() => {
      const stage = stageRef.current;
      if (!stage?.piece || !snapshotRef.current) return;
      stage.bed.visible = false;
      stage.render();
      try {
        snapshotRef.current(stage.renderer.domElement.toDataURL("image/png"));
      } catch {
        // canvas sin permiso de lectura: sin miniatura
      }
      stage.bed.visible = true;
      stage.render();
    }, 180);
  };
  useEffect(
    () => () => {
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
    },
    [],
  );

  // Pieza nueva: geometría nueva (la anterior se libera).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.piece) {
      stage.scene.remove(stage.piece);
      disposeObject(stage.piece);
      stage.piece = null;
      stage.raw = null;
    }
    if (positions && positions.length >= 9) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      // flatShading: normales por cara en el shader (no duplica memoria en mallas de millones de triángulos).
      const material = new MeshStandardMaterial({ color: new Color(color), roughness: 0.62, metalness: 0.02, flatShading: true });
      const mesh = new Mesh(geometry, material);
      stage.piece = mesh;
      stage.raw = { min: box.min.clone(), size: box.getSize(new Vector3()) };
      stage.scene.add(mesh);
    }
    // El resto (escala, encuadre) lo hace el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // Escala / cama / pieza: reubica y encuadra.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.piece && stage.raw) {
      const { min, size } = stage.raw;
      stage.piece.scale.setScalar(scale);
      // Centrada en x/y, apoyada en z = 0.
      stage.piece.position.set(-(min.x + size.x / 2) * scale, -(min.y + size.y / 2) * scale, -min.z * scale);
    }
    frame();
    scheduleSnapshot();
    // frame/scheduleSnapshot leen refs; dependen sólo de estos valores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, scale, bedKey, resetSignal]);

  // Color: se repinta sin rearmar nada.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.piece) return;
    stage.piece.material.color.set(color);
    stage.render();
    scheduleSnapshot();
  }, [color]);

  if (failed) return <div className={className}>{fallback ?? null}</div>;

  return (
    <div ref={hostRef} className={className} style={{ position: "relative" }} onDoubleClick={frame}>
      {children}
    </div>
  );
}

export default Viewer;
