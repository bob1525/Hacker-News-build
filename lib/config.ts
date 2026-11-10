export const PAGE_SIZE = 30;
export const MAX_COMMENT_DEPTH = 8;
/** Authors can edit a comment until this long after it was created. */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const POST_RATE_LIMIT = 8;
export const POST_RATE_WINDOW_MS = 10 * 60 * 1000;
export const COMMENT_RATE_LIMIT = 20;
export const COMMENT_RATE_WINDOW_MS = 10 * 60 * 1000;
export const VOTE_RATE_LIMIT = 60;
export const VOTE_RATE_WINDOW_MS = 60 * 1000;

export const POST_DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
export const COMMENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const SESSION_COOKIE = "hn_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Shared password for every seeded account. Documented on the login page. */
export const DEMO_PASSWORD = "news12345";

export const DEMO_USERNAMES = ["demo", "pg", "dang", "karpathy", "nash", "tptacek"] as const;
