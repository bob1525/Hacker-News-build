"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require("child_process");
const { devParentExitCode } = require("./dev-parent-exit.cjs");

if (process.env.NEXT_PRIVATE_WORKER !== "1") {
  let childCode = null;
  const originalFork = childProcess.fork;
  childProcess.fork = function forkWithStatus(...args) {
    const child = originalFork.apply(this, args);
    child.on("exit", (code) => {
      if (typeof code === "number") childCode = code;
    });
    return child;
  };

  const originalExit = process.exit.bind(process);
  process.exit = function exitWithChildStatus(code) {
    return originalExit(devParentExitCode(code, childCode));
  };
}
