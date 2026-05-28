// Cinematic postprocessing stack para look "Leapfrog/Datamine".
// SSAO + Bloom suaves; toggleable desde HUD.
import { EffectComposer, Bloom, SSAO, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

type Props = {
  enabled: boolean;
  intensity?: "soft" | "medium" | "strong";
};

export function CinematicEffects({ enabled, intensity = "medium" }: Props) {
  if (!enabled) return null;

  const bloomIntensity = intensity === "soft" ? 0.25 : intensity === "strong" ? 0.9 : 0.5;
  const ssaoIntensity = intensity === "soft" ? 8 : intensity === "strong" ? 30 : 18;

  return (
    <EffectComposer multisampling={4} enableNormalPass>
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
