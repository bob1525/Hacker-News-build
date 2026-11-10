import { assertAuthSecret, enforceAuthSecretOrExit } from "./lib/auth-secret";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    assertAuthSecret(process.env.AUTH_SECRET);
    return;
  }
  enforceAuthSecretOrExit(process.env.AUTH_SECRET);
}
