export const MIN_AUTH_SECRET_LENGTH = 32;

const PLACEHOLDER_FRAGMENTS = ["change_me", "change-me", "replace-with", "placeholder", "your-secret"];

export function authSecretProblem(value: string | undefined | null): string | null {
  const secret = (value ?? "").trim();
  if (!secret) {
    return "AUTH_SECRET is missing. Copy .env.example to .env and set AUTH_SECRET to a long random string before starting the app.";
  }
  const normalized = secret.toLowerCase();
  if (PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return "AUTH_SECRET is still a placeholder. Generate a long random string and replace it before starting the app. Production must not use the example value.";
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    return `AUTH_SECRET is too short (${secret.length} characters). Use at least ${MIN_AUTH_SECRET_LENGTH} characters.`;
  }
  return null;
}

export function assertAuthSecret(value: string | undefined | null): asserts value is string {
  const problem = authSecretProblem(value);
  if (problem) throw new Error(problem);
}

export function enforceAuthSecretOrExit(
  value: string | undefined | null = process.env.AUTH_SECRET,
  exit: (code: number) => never = process.exit,
  write: (message: string) => void = console.error,
): void {
  const problem = authSecretProblem(value);
  if (!problem) return;
  write(problem);
  exit(1);
}
