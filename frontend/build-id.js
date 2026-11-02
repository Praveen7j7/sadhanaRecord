// Build id: the IST date and time of the build, e.g. 2026.10.02-2207 (shown in the Run Log as app_build).
// Every build gets its own id, so every publish is a new version that phones pick up.
const t = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
export const BUILD_ID = process.env.BUILD_ID || `${t.slice(0, 10).replace(/-/g, '.')}-${t.slice(11, 13)}${t.slice(14, 16)}`;
