// Cinematic postprocessing stack para look "Leapfrog/Datamine".
// SSAO + Bloom suaves; toggleable desde HUD.
// Wrapped in an error boundary so a failing postprocessing pass NEVER blanks the Canvas.
import { Component, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, SSAO, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

type Props = {
  enabled: boolean;
  intensity?: "soft" | "medium" | "strong";
  onError?: (msg: string) => void;
};

class FxBoundary extends Component<{ children: ReactNode; onError?: (msg: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.warn("[CinematicEffects] disabled — postprocessing crashed:", err?.message);
    this.props.onError?.(err?.message ?? "postprocessing error");
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function Inner({ intensity }: { intensity: "soft" | "medium" | "strong" }) {
  // Force WebGL2 check; SSAO requires it.
  const gl = useThree((s) => s.gl);
  const ctx = gl.getContext();
  const isWebGL2 = typeof (ctx as WebGL2RenderingContext).createVertexArray === "function";

  const bloomIntensity = intensity === "soft" ? 0.25 : intensity === "strong" ? 0.9 : 0.5;
  const ssaoIntensity = intensity === "soft" ? 8 : intensity === "strong" ? 30 : 18;

  return (
    <EffectComposer multisampling={4} enableNormalPass={isWebGL2}>
      {isWebGL2 ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={20}
          intensity={ssaoIntensity}
          luminanceInfluence={0.5}
          worldDistanceThreshold={1200}
          worldDistanceFalloff={400}
          worldProximityThreshold={6}
          worldProximityFalloff={2}
        />
      ) : <></>}
      <Bloom
        luminanceThreshold={0.35}
        luminanceSmoothing={0.8}
        intensity={bloomIntensity}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.2} darkness={0.55} />
    </EffectComposer>
  );
}

export function CinematicEffects({ enabled, intensity = "medium", onError }: Props) {
  if (!enabled) return null;
  return (
    <FxBoundary onError={onError}>
      <Inner intensity={intensity} />
    </FxBoundary>
  );
}
