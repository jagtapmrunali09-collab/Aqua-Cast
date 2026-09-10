/**
 * hydraulics.js
 * Pipe/culvert conveyance capacity via Manning's Equation, for circular
 * drainage pipes flowing full or partially full under gravity.
 *
 *   Q = (1/n) * A * R^(2/3) * S^(1/2)
 *     Q -> discharge capacity, m^3/s
 *     n -> Manning's roughness coefficient
 *     A -> flow cross-sectional area, m^2
 *     R -> hydraulic radius (A / wetted perimeter), m
 *     S -> pipe invert slope, m/m
 */

export const MANNINGS_N = {
  concrete: 0.013,
  brick_masonry: 0.015,
  corrugated_metal: 0.024,
  earthen_channel: 0.030,
};

/**
 * Circular-pipe flow geometry at depth y (0 <= y <= D), from the central
 * angle theta subtended by the water-surface chord.
 */
function flowGeometry(diameterM, depthM) {
  const y = Math.min(Math.max(depthM, 0), diameterM);
  if (y <= 0) return { area: 0, wettedPerimeter: 0, hydraulicRadius: 0, theta: 0 };
  const theta = 2 * Math.acos(1 - (2 * y) / diameterM);
  const area = (diameterM ** 2 / 8) * (theta - Math.sin(theta));
  const wettedPerimeter = (diameterM / 2) * theta;
  const hydraulicRadius = wettedPerimeter > 0 ? area / wettedPerimeter : 0;
  return { area, wettedPerimeter, hydraulicRadius, theta };
}

export function manningDischarge({ area, hydraulicRadius, slope, n }) {
  if (slope <= 0 || area <= 0) return 0;
  return (1 / n) * area * hydraulicRadius ** (2 / 3) * Math.sqrt(slope);
}

/**
 * Silt/debris blockage narrows the usable bore. Approximated as an
 * equivalent circular bore of the same open area — conservative and
 * tractable for a nowcasting engine (siltBlockPct: 0-100, from the UI slider).
 */
function effectiveDiameter(diameterM, siltBlockPct) {
  const openFraction = 1 - Math.min(Math.max(siltBlockPct, 0), 95) / 100;
  return diameterM * Math.sqrt(openFraction);
}

export function pipeFullCapacity({ diameterM, slope, material = 'concrete', siltBlockPct = 0 }) {
  const n = MANNINGS_N[material] ?? MANNINGS_N.concrete;
  const dEff = effectiveDiameter(diameterM, siltBlockPct);
  const { area, hydraulicRadius } = flowGeometry(dEff, dEff); // y = D -> full flow
  return manningDischarge({ area, hydraulicRadius, slope, n });
}

/**
 * Given a required discharge, finds the flow depth (and % fill) the pipe
 * settles at via bisection on the monotonic depth -> discharge curve.
 * If the required discharge exceeds full-pipe capacity, the pipe is
 * surcharged and cannot convey the excess.
 */
export function solveFlowDepthForDischarge({
  diameterM,
  slope,
  material = 'concrete',
  siltBlockPct = 0,
  targetQ,
}) {
  const n = MANNINGS_N[material] ?? MANNINGS_N.concrete;
  const dEff = effectiveDiameter(diameterM, siltBlockPct);
  const qFull = pipeFullCapacity({ diameterM, slope, material, siltBlockPct });

  if (targetQ <= 0) {
    return { depthM: 0, fillPct: 0, surcharged: false, qFull, qRequired: targetQ };
  }
  if (targetQ >= qFull) {
    return { depthM: dEff, fillPct: 100, surcharged: true, qFull, qRequired: targetQ };
  }

  let lo = 0;
  let hi = dEff;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const { area, hydraulicRadius } = flowGeometry(dEff, mid);
    const q = manningDischarge({ area, hydraulicRadius, slope, n });
    if (q < targetQ) lo = mid;
    else hi = mid;
  }
  const depthM = (lo + hi) / 2;
  return { depthM, fillPct: (depthM / dEff) * 100, surcharged: false, qFull, qRequired: targetQ };
}
