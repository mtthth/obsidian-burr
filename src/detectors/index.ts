import { repetitions } from "./repetitions.ts";
import type { Detector } from "./types.ts";

export type { DetectionInput, Detector, Explanation, Highlight } from "./types.ts";

/** Les détecteurs actifs. Un nouveau détecteur s'inscrit ici et nulle part ailleurs. */
export const detectors: readonly Detector[] = [repetitions];
