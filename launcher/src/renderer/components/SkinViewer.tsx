import { useEffect, useRef } from "react";
import { SkinViewer as Viewer, IdleAnimation, WalkingAnimation } from "skinview3d";

const DEFAULT_SKIN = "https://mc-heads.net/skin/MHF_Steve";

interface Props {
  skinUrl: string | null;
  slim: boolean;
  width?: number;
  height?: number;
  walking?: boolean;
}

/** Interactive 3D player model (drag to rotate, scroll to zoom). Falls back to the default skin offline. */
export function SkinViewer({ skinUrl, slim, width = 260, height = 380, walking = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const v = new Viewer({ canvas: canvas.current, width, height });
    v.controls.enableZoom = true;
    v.controls.enablePan = false;
    v.zoom = 0.85;
    v.fov = 55;
    v.autoRotate = false;
    viewer.current = v;
    return () => v.dispose();
  }, [width, height]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.animation = walking ? new WalkingAnimation() : new IdleAnimation();
    void v.loadSkin(skinUrl ?? DEFAULT_SKIN, { model: slim ? "slim" : "default" }).catch(() => v.loadSkin(null));
  }, [skinUrl, slim, walking]);

  return <canvas ref={canvas} className="skin-canvas" aria-label="3D player model" />;
}
