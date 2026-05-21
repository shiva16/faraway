import type { SpeciesDef } from './botany';

// ── Generalized Lotka-Volterra ecological simulation engine ───────────────────
// Ported from EcoKnowGames (simulator.R / find_matrix.R)
// Core update: ΔN_i = N_i × (r_i + Σ_j A_ij × N_j)
//
// A[i][j] = effect of species j on species i's growth rate.
// Stable zone: all species maintain N > 0.05 after simulation.

export type ZoneStability = 'empty' | 'growing' | 'thriving' | 'stressed' | 'collapsed';

export interface ForestZone {
  id: string;            // `${zoneX},${zoneY}`
  speciesIds: string[];
  N: number[];           // populations per species, 0–1
  r: number[];           // intrinsic growth rates
  A: number[][];         // interaction (community) matrix
  stability: ZoneStability;
  tick: number;
}

export const ZONE_SIZE = 8; // tiles per zone edge

/** Intrinsic growth rate — pioneers grow faster, keystone species slower */
export function speciesGrowthRate(def: SpeciesDef): number {
  const base = 0.002 + def.biodiversityScore * 0.0003;
  return def.ecologicalRoles.includes('pioneer') ? base * 2.5 : base;
}

/** Build A-matrix from species interaction data.
 *  Diagonal = self-limitation (stronger for high-biodiversity species).
 *  Off-diagonal A[i][j] = effect of j on i from i's interactions map.
 */
export function buildAMatrix(speciesIds: string[], defs: SpeciesDef[]): number[][] {
  const n = speciesIds.length;
  const A: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const def = defs.find(d => d.id === speciesIds[i]);
    // Self-limitation: higher for dominant canopy trees (prevents runaway growth)
    A[i][i] = def ? -(0.003 + def.biodiversityScore * 0.0002) : -0.005;
    if (def?.interactions) {
      for (let j = 0; j < n; j++) {
        if (i !== j) A[i][j] = def.interactions[speciesIds[j]] ?? 0;
      }
    }
  }
  return A;
}

/** Single GLV tick — matches EcoKnowGames simulator.R:
 *  New_Ns <- Ns + Ns*(rr + AA %*% Ns)  */
export function stepGLV(N: number[], r: number[], A: number[][]): number[] {
  return N.map((ni, i) => {
    if (ni <= 0) return 0;
    const interaction = A[i].reduce((s, aij, j) => s + aij * N[j], 0);
    return Math.max(0, Math.min(2, ni + ni * (r[i] + interaction)));
  });
}

/** Classify zone stability from current population vector */
export function assessStability(N: number[], speciesCount: number): ZoneStability {
  if (speciesCount === 0 || N.length === 0) return 'empty';
  if (N.some(n => n < 0.05)) return 'collapsed';
  const mean = N.reduce((s, n) => s + n, 0) / N.length;
  if (mean >= 0.5 && speciesCount >= 3) return 'thriving';
  if (mean >= 0.2 && speciesCount >= 2) return 'growing';
  return 'stressed';
}

/** Initialise a new zone from a set of species */
export function makeZone(id: string, speciesIds: string[], defs: SpeciesDef[]): ForestZone {
  const r = speciesIds.map(sid => {
    const d = defs.find(x => x.id === sid);
    return d ? speciesGrowthRate(d) : 0.003;
  });
  const A = buildAMatrix(speciesIds, defs);
  const N = speciesIds.map(() => 0.5);
  return { id, speciesIds, N, r, A, stability: 'growing', tick: 0 };
}

/** Advance a zone by one simulation tick */
export function tickZone(zone: ForestZone): ForestZone {
  const newN = stepGLV(zone.N, zone.r, zone.A).map(n => Math.min(1, n));
  const stability = assessStability(newN, zone.speciesIds.length);
  return { ...zone, N: newN, stability, tick: zone.tick + 1 };
}
