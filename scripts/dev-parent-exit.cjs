"use strict";

/**
 * Next.js `next dev` exits 0 after its worker stops, including when the worker
 * called process.exit(1). Keep a real worker status when one exists.
 */
function devParentExitCode(requested, childCode) {
  if (typeof childCode === "number" && childCode !== 0) return childCode;
  return typeof requested === "number" ? requested : 0;
}

module.exports = { devParentExitCode };
