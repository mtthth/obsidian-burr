import { repetitions } from "./repetitions.ts";
import type { Detector } from "./types.ts";
import { weak } from "./weak.ts";

export type { DetectionInput, Detector, Explanation, Highlight } from "./types.ts";

/**
 * Les détecteurs actifs. Un nouveau détecteur s'inscrit ici et nulle part ailleurs. L'ordre compte :
 * quand deux plages se chevauchent, celle du détecteur le plus haut dans la liste est gardée.
 */
export const detectors: readonly Detector[] = [repetitions, weak];
