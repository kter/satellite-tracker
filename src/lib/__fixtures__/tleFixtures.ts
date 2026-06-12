/**
 * Real TLEs fetched from CelesTrak on 2026-06-12 (same data as tests/fixtures/*.tle).
 * Column alignment matters to SGP4 — never hand-edit these except DECAYED_*,
 * which deliberately carries an eccentricity that puts perigee underground.
 */

export const ISS_NAME = 'ISS (ZARYA)'
export const ISS_L1 = '1 25544U 98067A   26162.83551936  .00007284  00000+0  13937-3 0  9993'
export const ISS_L2 = '2 25544  51.6334 326.5798 0004934 175.2433 184.8603 15.49179015570924'
/** ms timestamp near the ISS TLE epoch (2026 day 162.84 ≈ 2026-06-11 20:03 UTC) */
export const ISS_EPOCH_MS = Date.UTC(2026, 5, 11, 20, 0, 0)

export const CSS_NAME = 'CSS (TIANHE)'
export const CSS_L1 = '1 48274U 21035A   26162.53781053  .00016554  00000+0  19807-3 0  9993'
export const CSS_L2 = '2 48274  41.4693 356.3768 0008209  31.5834 328.5496 15.60566891292282'

export const GEO_NAME = 'TDRS 3'
export const GEO_L1 = '1 19548U 88091B   26162.38845874 -.00000292  00000+0  00000+0 0  9999'
export const GEO_L2 = '2 19548  12.6066 341.0383 0038379 356.1165  13.5633  1.00275420125335'

/** ISS elements with eccentricity bumped to 0.5 → perigee far below ground → SGP4 error */
export const DECAYED_L1 = ISS_L1
export const DECAYED_L2 = '2 25544  51.6334 326.5798 5000000 175.2433 184.8603 15.49179015570924'

export const ISS_3LE = `${ISS_NAME}\n${ISS_L1}\n${ISS_L2}`
export const TWO_SATS_3LE = `${ISS_3LE}\n${CSS_NAME}\n${CSS_L1}\n${CSS_L2}`
