/**
 * hydrology.js
 * Surface runoff estimation using the Rational Method.
 *
 *   Q = C * I * A / 360        (metric form)
 *     Q -> runoff discharge, m^3/s
 *     C -> dimensionless runoff coefficient (land-use imperviousness)
 *     I -> rainfall intensity, mm/hr
 *     A -> contributing catchment area, hectares
 *     360 -> unit-conversion constant (mm/hr * ha -> m^3/s)
 */

// Runoff coefficients by land-use class, representative of a dense
// Indian metro block (roofs, paved roads, informal settlements, open ground).
export const LAND_USE_COEFFICIENTS = {
  concrete_roof: 0.90,
  asphalt_road: 0.85,
  paved_courtyard: 0.80,
  dense_informal_settlement: 0.70,
  open_ground_compacted: 0.45,
  park_lawn: 0.20,
  water_body: 0.05,
};

/** Area-weighted composite C for a catchment made of several land-use classes. */
export function weightedRunoffCoefficient(landUseAreas) {
  // landUseAreas: { [landUseKey]: areaHectares }
  let totalArea = 0;
  let weightedC = 0;
  for (const [key, area] of Object.entries(landUseAreas || {})) {
    const c = LAND_USE_COEFFICIENTS[key];
    if (c === undefined || !area) continue;
    totalArea += area;
    weightedC += c * area;
  }
  if (totalArea === 0) return { C: 0, totalAreaHa: 0 };
  return { C: weightedC / totalArea, totalAreaHa: totalArea };
}

export function rationalMethodRunoff({ C, intensityMmPerHr, areaHectares }) {
  if (C < 0 || C > 1) throw new Error('Runoff coefficient C must lie within [0, 1]');
  if (intensityMmPerHr < 0 || areaHectares < 0) {
    throw new Error('Intensity and area must be non-negative');
  }
  return (C * intensityMmPerHr * areaHectares) / 360; // m^3/s
}

/** Applies the Rational Method across a 0-3hr Doppler nowcast time series. */
export function catchmentRunoffSeries({ landUseAreas, radarSeries }) {
  // radarSeries: [{ tMinutes, intensityMmPerHr }, ...]
  const { C, totalAreaHa } = weightedRunoffCoefficient(landUseAreas);
  return radarSeries.map(({ tMinutes, intensityMmPerHr }) => ({
    tMinutes,
    intensityMmPerHr,
    runoffCumecs: rationalMethodRunoff({ C, intensityMmPerHr, areaHectares: totalAreaHa }),
  }));
}
