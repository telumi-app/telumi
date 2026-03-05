/**
 * Boot-time tracker.
 *
 * Records when the player page was first loaded.  Used to compute
 * "uptime" in heartbeat payloads so the backend can detect devices
 * that restart frequently (crash loops, OOM, etc.).
 */

const bootTimestamp = Date.now();

/** Get the timestamp (epoch ms) when the player booted. */
export function getBootTimestamp(): number {
  return bootTimestamp;
}

/** Get uptime in milliseconds since boot. */
export function getUptimeMs(): number {
  return Date.now() - bootTimestamp;
}

/** Player version — injected at build time or hardcoded. */
export const PLAYER_VERSION = '2.0.0';
