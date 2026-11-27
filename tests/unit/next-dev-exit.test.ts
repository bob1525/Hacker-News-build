import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { devParentExitCode } = require("../../scripts/dev-parent-exit.cjs") as {
  devParentExitCode: (requested: number | undefined, childCode: number | null) => number;
};

describe("next dev exit code", () => {
  it("keeps the worker status when the Next.js parent asks to exit 0", () => {
    expect(devParentExitCode(0, 1)).toBe(1);
    expect(devParentExitCode(0, null)).toBe(0);
    expect(devParentExitCode(undefined, null)).toBe(0);
  });

  it("exits 1 when next dev is started with an unacceptable AUTH_SECRET", async () => {
    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--require", "./scripts/next-dev-exit.cjs", "./node_modules/next/dist/bin/next", "dev", "--port", "3217"],
        {
          env: { ...process.env, AUTH_SECRET: "too-short" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`next dev did not exit\n${output.slice(-2000)}`));
      }, 90_000);
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ code, output });
      });
    });

    expect(result.output).toMatch(/AUTH_SECRET is too short/);
    expect(result.code).toBe(1);
  }, 100_000);
});
