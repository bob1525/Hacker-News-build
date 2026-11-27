export const PAGE_SIZE = 30;
/**
 * A reply is rejected when its parent is already this deep.
 * 16 keeps a hard stop and doubles the previous cap of 8.
 * The first level is the root comment.
 */
export const MAX_COMMENT_DEPTH = 16;
/** Pixels added per nested reply. Stops growing so a deep thread stays on screen. */
export const COMMENT_INDENT_PX = 12;
export const COMMENT_INDENT_CAP_PX = 120;
/** Authors can edit a comment until this long after it was created. */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const POST_RATE_LIMIT = 8;
export const POST_RATE_WINDOW_MS = 10 * 60 * 1000;
export const COMMENT_RATE_LIMIT = 20;
export const COMMENT_RATE_WINDOW_MS = 10 * 60 * 1000;
export const VOTE_RATE_LIMIT = 60;
export const VOTE_RATE_WINDOW_MS = 60 * 1000;
/** Karma from other people required before a downvote. Upvotes have no karma floor. */
export const DOWNVOTE_MIN_KARMA = 1;
export const VERIFY_EMAIL_RATE_LIMIT = 3;
export const VERIFY_EMAIL_RATE_WINDOW_MS = 10 * 60 * 1000;
/** Verification links stop working after this long. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_RATE_LIMIT = 3;
export const PASSWORD_RESET_RATE_WINDOW_MS = 10 * 60 * 1000;
/** Reset links stop working after this long. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_CHANGE_RATE_LIMIT = 3;
export const EMAIL_CHANGE_RATE_WINDOW_MS = 10 * 60 * 1000;
/** Email-change links stop working after this long. */
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

export const POST_DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
export const COMMENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const SESSION_COOKIE = "hn_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Shared password for every seeded account. Documented on the login page. */
export const DEMO_PASSWORD = "news12345";

export const DEMO_USERNAMES = ["demo", "pg", "dang", "karpathy", "nash", "tptacek"] as const;
