import { buildCommentTree, maxThreadDepth } from "@/lib/domain/comments";
import { sortByHot, sortByNewest } from "@/lib/domain/ranking";

export const HOT_POST_TITLE = "SQLite is quietly winning the small-data era";
export const NEWEST_POST_TITLE = "Just shipped a tiny log viewer";
export const DEEP_THREAD_TITLE = "Ask HN: How do you take notes while reading papers?";
export const DEEP_COMMENT_SNIPPET = "Indentation is a feature, infinite folders are not.";
export const READER_COUNT = 30;

export type SeedUser = {
  username: string;
  email: string;
  about: string;
};

export type SeedComment = {
  author: string;
  text: string;
  hoursAgo: number;
  upvotes: number;
  replies?: SeedComment[];
};

export type SeedPost = {
  author: string;
  title: string;
  url: string | null;
  text: string;
  hoursAgo: number;
  upvotes: number;
  comments?: SeedComment[];
};

export const namedUsers: SeedUser[] = [
  {
    username: "pg",
    email: "pg@example.com",
    about: "I helped start Y Combinator. I still read the comments.",
  },
  {
    username: "dang",
    email: "dang@example.com",
    about: "Moderator. Curious, specific, and kind beats clever.",
  },
  {
    username: "karpathy",
    email: "karpathy@example.com",
    about: "I like neural nets, software 2.0, and building things from scratch.",
  },
  {
    username: "patio11",
    email: "patio11@example.com",
    about: "Writes about businesses, software, and the gap between them.",
  },
  {
    username: "tptacek",
    email: "tptacek@example.com",
    about: "Security person. Long comments, short patience for vague claims.",
  },
  {
    username: "swyx",
    email: "swyx@example.com",
    about: "Learn in public. Interested in AI engineering and developer tools.",
  },
  {
    username: "levelsio",
    email: "levelsio@example.com",
    about: "Ships small internet products, usually alone.",
  },
  {
    username: "sama",
    email: "sama@example.com",
    about: "Thinking about AI, energy, and ambitious startups.",
  },
  {
    username: "rvn",
    email: "rvn@example.com",
    about: "Databases, compilers, and other things that should be boring.",
  },
  {
    username: "sophie",
    email: "sophie@example.com",
    about: "Design engineer. Cares about reading comfort and fast interfaces.",
  },
  {
    username: "julia",
    email: "julia@example.com",
    about: "Distributed systems. Asks too many questions about failure modes.",
  },
  {
    username: "nash",
    email: "nash@example.com",
    about: "Researcher and product person. Here mostly for the comment threads.",
  },
  {
    username: "mxcl",
    email: "mxcl@example.com",
    about: "Makes tools. Prefers one command to a dashboard.",
  },
  {
    username: "demo",
    email: "demo@example.com",
    about: "Demo account. The password is on the login page. Feel free to post.",
  },
  {
    username: "lurker",
    email: "lurker@example.com",
    about: "Reads almost everything. Has not posted yet.",
  },
];

function comment(
  author: string,
  hoursAgo: number,
  upvotes: number,
  text: string,
  replies: SeedComment[] = [],
): SeedComment {
  return { author, text, hoursAgo, upvotes, replies };
}

export const posts: SeedPost[] = [
  {
    author: "rvn",
    title: HOT_POST_TITLE,
    url: "https://sqlite.org/whentouse.html",
    text: "",
    hoursAgo: 1,
    upvotes: 36,
    comments: [
      comment(
        "patio11",
        0.7,
        6,
        "The quiet part is operational. One file you can copy is a backup strategy a new teammate can understand on day one.",
      ),
      comment(
        "julia",
        0.55,
        4,
        "I still reach for a server database once more than one process needs to write. SQLite's single-writer story is the whole design, and it is a good design until it is not.",
        [
          comment(
            "rvn",
            0.4,
            3,
            "Agreed. WAL mode buys you readers during a write, not a second writer. If you need that, you have already left the problem SQLite wants.",
          ),
        ],
      ),
      comment("mxcl", 0.3, 2, "Also: the CLI is part of the product. `.schema` has taught more people SQL than most tutorials."),
    ],
  },
  {
    author: "levelsio",
    title: NEWEST_POST_TITLE,
    url: "https://example.com/log-viewer",
    text: "Single binary, no account, tail and filter. Curious if this is useful or if I should stop here.",
    hoursAgo: 0.05,
    upvotes: 0,
  },
  {
    author: "nash",
    title: DEEP_THREAD_TITLE,
    url: null,
    text: "I've been reading more systems papers this year and my notes are a mess of highlights. If you read papers regularly, what is your actual setup?\n\nI'm curious about tools, but more about the habit: what do you write down, and what do you ignore?",
    hoursAgo: 20,
    upvotes: 18,
    comments: [
      comment(
        "karpathy",
        18,
        7,
        "I keep one plain text file per paper. Three headings only: problem, trick, and what I would try next. If I cannot fill those in, I did not really read it.",
        [
          comment(
            "pg",
            16,
            4,
            "The 'what I would try next' line is the whole game. A summary of the abstract is how you pretend to have read something.",
            [
              comment(
                "nash",
                14,
                2,
                "That matches the step I keep skipping. I bookmark the PDF and never write the next experiment, so the paper disappears.",
                [
                  comment(
                    "dang",
                    12,
                    3,
                    `Write the note before you close the PDF. A short note you will reread beats a perfect system you will not. ${DEEP_COMMENT_SNIPPET}`,
                  ),
                ],
              ),
            ],
          ),
          comment(
            "swyx",
            15,
            3,
            "I learn it in public: one post per paper, even if the post is six sentences. The comments tell me what I misunderstood.",
          ),
        ],
      ),
      comment(
        "tptacek",
        17,
        5,
        "Most paper-note systems fail because they try to be a second brain. Keep a dated log. Future you can grep a log. Future you will not maintain a taxonomy.",
        [
          comment(
            "sophie",
            13,
            2,
            "A dated log also fixes the design problem. One column of text, oldest at the top, search when you need it. The tool barely matters.",
          ),
        ],
      ),
      comment(
        "patio11",
        11,
        4,
        "I write notes as if I had to explain the paper to a sharp coworker who has ten minutes. Jargon I cannot translate gets marked as 'do not understand yet' instead of copied.",
      ),
    ],
  },
  {
    author: "pg",
    title: "How to get startup ideas",
    url: "https://paulgraham.com/startupideas.html",
    text: "",
    hoursAgo: 30,
    upvotes: 22,
    comments: [
      comment(
        "sama",
        26,
        3,
        "The ideas that survive contact with a user are rarely the ones that sounded clever in a notebook.",
      ),
      comment(
        "levelsio",
        22,
        2,
        "I would add: ship the embarrassing version before you name the company. The name can wait. The user cannot.",
      ),
      comment("nash", 18, 1, "Reread this every time a brainstorming doc gets longer than a page."),
    ],
  },
  {
    author: "karpathy",
    title: "llama2.c — inference in one file",
    url: "https://github.com/karpathy/llama2.c",
    text: "A single C file you can read over a weekend. Useful when the framework is hiding the actual model.",
    hoursAgo: 14,
    upvotes: 24,
    comments: [
      comment("rvn", 12, 4, "The pedagogical win is that memory is just a float array. Once you see that, the rest of the stack gets less magical."),
      comment(
        "julia",
        10,
        2,
        "I pointed a new hire at this before the internal inference repo. They asked better questions afterwards.",
        [comment("karpathy", 8, 1, "That is the hope. The code is allowed to be small if the idea is the point.")],
      ),
      comment("swyx", 9, 3, "One-file projects are underrated onboarding. A repo with forty packages teaches the tools, not the thing."),
    ],
  },
  {
    author: "tptacek",
    title: "Ask HN: What security advice do you actually follow?",
    url: null,
    text: "Not the poster on the wall. The habit you still do when the build is late. I'll start: unique passwords in a manager, and I read the diff before I run a stranger's install script.",
    hoursAgo: 26,
    upvotes: 15,
    comments: [
      comment(
        "julia",
        22,
        3,
        "SSH keys with a hardware token for production, and a boring staging environment that is allowed to be less precious.",
        [
          comment(
            "tptacek",
            20,
            2,
            "Staging that shares production credentials is not staging. It is production with a different hostname.",
          ),
        ],
      ),
      comment("mxcl", 19, 2, "I turned off password SSH everywhere and stopped negotiating with myself about it."),
      comment(
        "dang",
        16,
        1,
        "A useful version of this thread names the behavior, not the product. 'We require review on auth changes' is advice. 'Use our startup' is an ad.",
      ),
    ],
  },
  {
    author: "sophie",
    title: "Show HN: A reading view that respects the back button",
    url: "https://example.com/reading-view",
    text: "It is a local viewer for long articles. No account, no infinite scroll, and the back button returns you to the exact paragraph.",
    hoursAgo: 12,
    upvotes: 9,
    comments: [
      comment("nash", 10, 2, "The paragraph restore is the feature. Most reading modes throw away the only piece of state I cared about."),
      comment("pg", 8, 1, "Small, specific, and easy to explain. That is a good Show HN."),
    ],
  },
  {
    author: "julia",
    title: "Ferrocene is a qualified Rust toolchain for safety-critical code",
    url: "https://ferrocene.dev/en/",
    text: "Ferrocene qualifies the Rust compiler for environments that need a named, supported toolchain. Worth reading if you only know Rust from weekend projects.",
    hoursAgo: 16,
    upvotes: 12,
    comments: [
      comment("rvn", 13, 2, "Qualification is a product, not a compiler flag. Someone has to answer the phone when a regulator asks which commit you shipped."),
      comment("tptacek", 11, 1, "The interesting claim is the support boundary, not the syntax. I want to know what they refuse to qualify."),
    ],
  },
  {
    author: "mxcl",
    title: "Show HN: A package manager that only prints what it will do",
    url: "https://example.com/dry-run-pm",
    text: "Every install is a dry run until you pass --commit. The output is a diff of the filesystem, not a progress bar.",
    hoursAgo: 22,
    upvotes: 8,
    comments: [
      comment("sophie", 18, 2, "Showing the diff before the mutation is the right default. Progress bars are how tools hide the actual change."),
      comment("levelsio", 15, 1, "I would use this for one-off servers. My laptop can stay messy."),
    ],
  },
  {
    author: "swyx",
    title: "The rise of the AI engineer",
    url: "https://www.latent.space/p/ai-engineer",
    text: "",
    hoursAgo: 48,
    upvotes: 17,
    comments: [
      comment(
        "karpathy",
        40,
        3,
        "The useful split is still: people who understand the model, and people who understand the product wrapped around it. The title matters less than which one you are avoiding.",
      ),
      comment("nash", 30, 1, "A lot of the new job is evaluation. If you cannot tell a better answer from a louder one, the model will not save you."),
    ],
  },
  {
    author: "sama",
    title: "How to be successful",
    url: "https://blog.samaltman.com/how-to-be-successful",
    text: "",
    hoursAgo: 80,
    upvotes: 13,
  },
  {
    author: "dang",
    title: "Ask HN: What thread here changed how you work?",
    url: null,
    text: "Looking for a specific change, not a favorite commenter. What did you start doing, or stop doing, because of a discussion?",
    hoursAgo: 36,
    upvotes: 10,
    comments: [
      comment("patio11", 30, 2, "I stopped writing status updates that hide the risk. A thread on incident reviews convinced me that 'on track' is not a status."),
      comment(
        "sophie",
        28,
        1,
        "I started putting the reproduction above the theory. Someone here said a bug report without steps is a mood. That stuck.",
        [comment("dang", 24, 1, "Moods are allowed in the comments. They are a poor substitute for the steps.")],
      ),
    ],
  },
  {
    author: "rvn",
    title: "Why SQLite does not use Git",
    url: "https://sqlite.org/whynotgit.html",
    text: "",
    hoursAgo: 60,
    upvotes: 9,
    comments: [
      comment("mxcl", 50, 1, "Fossil being purpose-built is the part people skip. The VCS is allowed to know about the project it serves."),
    ],
  },
  {
    author: "pg",
    title: "Write simply",
    url: "https://paulgraham.com/simply.html",
    text: "",
    hoursAgo: 90,
    upvotes: 14,
    comments: [
      comment("sophie", 70, 2, "Simple sentences survive a reread. Clever ones need the author in the room."),
      comment("nash", 60, 1, "I use this as an editing pass: if a sentence only works when you already agree, cut it."),
    ],
  },
  {
    author: "karpathy",
    title: "Software 2.0",
    url: "https://karpathy.medium.com/software-2.0-a64152b37c35",
    text: "",
    hoursAgo: 110,
    upvotes: 16,
    comments: [
      comment(
        "julia",
        90,
        2,
        "The part that aged well is the dataset as the program. The part people quote is the headline. Read the dataset section again.",
      ),
    ],
  },
  {
    author: "levelsio",
    title: "Show HN: A nomad tax calculator for one person",
    url: "https://example.com/nomad-tax",
    text: "It compares a year of income across a handful of countries and shows the assumptions. Not advice. The assumptions are the product.",
    hoursAgo: 18,
    upvotes: 7,
    comments: [comment("patio11", 14, 2, "Labeling the assumptions in the first screen is the difference between a tool and a vibe.")],
  },
  {
    author: "sophie",
    title: "Ask HN: How do you review UI without bikeshedding color?",
    url: null,
    text: "Our reviews keep collapsing into preference. What agenda, artifact, or question has actually kept a UI review about the user's task?",
    hoursAgo: 28,
    upvotes: 6,
    comments: [
      comment("dang", 24, 2, "Start from a task and a screenshot of the failure. Color arguments get quieter when the task is still broken."),
      comment(
        "pg",
        21,
        1,
        "Ask what the user does next. If nobody can answer, you are reviewing a poster.",
        [comment("sophie", 18, 1, "I'm stealing 'what does the user do next' as the first line of the review doc.")],
      ),
    ],
  },
  {
    author: "julia",
    title: "Jepsen reports are still the best writing in distributed systems",
    url: "https://jepsen.io/analyses",
    text: "",
    hoursAgo: 70,
    upvotes: 11,
    comments: [
      comment("tptacek", 60, 2, "They show the failure with a test you can rerun. That is a higher standard than a postmortem written after the slide deck."),
    ],
  },
  {
    author: "tptacek",
    title: "The cryptopals crypto challenges",
    url: "https://cryptopals.com/",
    text: "",
    hoursAgo: 100,
    upvotes: 8,
  },
  {
    author: "patio11",
    title: "Ask HN: What did running a small software business teach you?",
    url: null,
    text: "Not fundraising stories. The unglamorous lesson: billing, support, or the sentence you now put in the contract.",
    hoursAgo: 55,
    upvotes: 9,
    comments: [
      comment("levelsio", 48, 2, "Charge earlier than feels polite. I lost a year being proud of free users."),
      comment("mxcl", 40, 1, "Write down how to cancel. If cancellation is a scavenger hunt, you will hear about it forever."),
    ],
  },
  {
    author: "mxcl",
    title: "brew install is still the nicest onboarding",
    url: "https://brew.sh/",
    text: "",
    hoursAgo: 44,
    upvotes: 6,
  },
  {
    author: "nash",
    title: "Ask HN: How do you keep a research log you will actually reread?",
    url: null,
    text: "I have notes in four places and trust none of them. If you have a log you opened again last month, what does an entry look like?",
    hoursAgo: 33,
    upvotes: 7,
    comments: [
      comment(
        "karpathy",
        29,
        2,
        "Date, question, result, and a link. If there is no result yet, the entry says what would change my mind.",
        [
          comment("nash", 26, 1, "The 'what would change my mind' line is the piece my notes are missing. They record activity, not a bet."),
        ],
      ),
      comment("patio11", 25, 1, "I reread logs that are short enough to finish. A log you cannot finish becomes an archive, and archives are where questions go to die."),
    ],
  },
  {
    author: "swyx",
    title: "Show HN: A checklist for shipping a side project in a weekend",
    url: "https://example.com/weekend-checklist",
    text: "Twelve boxes. The last one is 'tell one specific person', not 'post everywhere'.",
    hoursAgo: 9,
    upvotes: 5,
    comments: [comment("levelsio", 8, 1, "The specific person is the whole checklist. The other boxes are how you avoid hiding from them.")],
  },
  {
    author: "sama",
    title: "Moore's law for everything",
    url: "https://moores.samaltman.com/",
    text: "",
    hoursAgo: 140,
    upvotes: 10,
  },
  {
    author: "pg",
    title: "Beating the averages",
    url: "https://paulgraham.com/avg.html",
    text: "",
    hoursAgo: 200,
    upvotes: 12,
    comments: [comment("rvn", 150, 1, "The language is the excuse. The real advantage in that essay is a small team that can rewrite.")],
  },
  {
    author: "karpathy",
    title: "The unreasonable effectiveness of recurrent neural networks",
    url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
    text: "",
    hoursAgo: 180,
    upvotes: 8,
  },
  {
    author: "julia",
    title: "Ask HN: What on-call setup does not burn people out?",
    url: null,
    text: "We have a rotation, a channel, and too many pages that are not actionable. What did you delete from the pager that actually helped?",
    hoursAgo: 24,
    upvotes: 5,
    comments: [
      comment("tptacek", 20, 2, "Delete alerts that do not have a next action written on them. If the page cannot say what to do, it is a metric, not an alert."),
      comment("dang", 18, 1, "Also delete alerts nobody trusts. A page people mute is worse than silence, because it teaches them to mute the next one."),
      comment("mxcl", 16, 1, "We added a weekly prune. If an alert did not fire or did not help, it has to be defended or it goes."),
    ],
  },
  {
    author: "tptacek",
    title: "Latency numbers every programmer should know",
    url: "https://gist.github.com/jboner/2841832",
    text: "The numbers move, the ratios are the point. I still send this to people who want to add a network hop 'just for cleanliness'.",
    hoursAgo: 50,
    upvotes: 13,
    comments: [
      comment("rvn", 42, 2, "The useful exercise is replacing one number with a measurement from your own system. The gist is a prior, not a result."),
    ],
  },
  {
    author: "sophie",
    title: "Designing for high information density",
    url: null,
    text: "Dense is not the same as cramped. The interfaces I reread — flight strips, old mail clients, this site — share alignment and a stable rhythm more than they share a small font.",
    hoursAgo: 42,
    upvotes: 4,
    comments: [
      comment("nash", 36, 1, "Stable rhythm is the phrase I needed. I keep adding padding and calling it clarity, then I cannot see the thread."),
      comment("pg", 30, 1, "A page that shows thirty things can still be calm if each thing is in the same place every time."),
    ],
  },
  {
    author: "rvn",
    title: "The Algorithm Design Manual is still worth a slow read",
    url: "https://www.algorist.com/",
    text: "",
    hoursAgo: 96,
    upvotes: 6,
  },
  {
    author: "patio11",
    title: "Calendar scheduling is a product, not a feature",
    url: null,
    text: "If your app's only job is to find a time, the failure modes are the product: time zones, buffers, and the person who does not live in their calendar.",
    hoursAgo: 64,
    upvotes: 5,
    comments: [comment("sophie", 50, 1, "Buffers are the feature users thank you for and product managers try to remove.")],
  },
  {
    author: "mxcl",
    title: "Ask HN: What CLI tool do you miss on a fresh machine?",
    url: null,
    text: "The one you install before the editor plugins. Mine is ripgrep. Curious which tool makes a laptop feel like yours.",
    hoursAgo: 15,
    upvotes: 8,
    comments: [
      comment("rvn", 13, 2, "sqlite3, already there more often than people think, and jq when it is not a one-liner anymore."),
      comment(
        "julia",
        12,
        1,
        "tmux. Not because I need multiplexing on day one, but because my shell history stops vanishing when the laptop sleeps.",
        [comment("mxcl", 10, 1, "History that survives a nap is a shockingly high bar, and a lot of tools miss it.")],
      ),
      comment("levelsio", 9, 1, "A password manager CLI. I will not copy a token through a notes app again."),
    ],
  },
  {
    author: "swyx",
    title: "Learn in public, with the drafts left visible",
    url: null,
    text: "The useful version is not a personal brand. It is a trail of what you tried, including the attempts that did not become a post.",
    hoursAgo: 38,
    upvotes: 6,
    comments: [comment("nash", 32, 1, "Leaving the dead ends visible is what makes the trail usable. A polished recap hides the actual search.")],
  },
  {
    author: "julia",
    title: "A note on retries that made an outage worse",
    url: null,
    text: "We retried a write with no idempotency key, timed the retry to the same window as the health check, and then watched the database do the work three times. The fix was smaller than the postmortem.",
    hoursAgo: 11,
    upvotes: 4,
    comments: [
      comment("tptacek", 9, 2, "Retries without a budget are self-inflicted load. Put a number on them before you put a loop in."),
    ],
  },
  {
    author: "dang",
    title: "A reminder on titles",
    url: null,
    text: "Say the thing. If the title needs the first comment to be understood, the title is not done. Curiosity gaps are how readers learn to skip you.",
    hoursAgo: 8,
    upvotes: 3,
  },
];

export function readerUsername(index: number): string {
  return `reader${String(index).padStart(2, "0")}`;
}

export function allSeedUsernames(): string[] {
  return [...namedUsers.map((user) => user.username), ...Array.from({ length: READER_COUNT }, (_, index) => readerUsername(index + 1))];
}

function eachComment(post: SeedPost, visit: (comment: SeedComment, depth: number, parent: SeedComment | null) => void) {
  const walk = (comments: SeedComment[] | undefined, depth: number, parent: SeedComment | null) => {
    for (const entry of comments ?? []) {
      visit(entry, depth, parent);
      walk(entry.replies, depth + 1, entry);
    }
  };
  walk(post.comments, 1, null);
}

export function commentCount(items: SeedPost[] = posts): number {
  let count = 0;
  for (const post of items) eachComment(post, () => { count += 1; });
  return count;
}

export function seedRankingSamples(now = new Date()) {
  return posts.map((post) => ({
    title: post.title,
    points: post.upvotes,
    createdAt: new Date(now.getTime() - post.hoursAgo * 3_600_000),
    text: post.text,
  }));
}

export function assertSeedRanking(now = new Date()): void {
  const samples = seedRankingSamples(now);
  const hottest = sortByHot(samples, now)[0];
  const newest = sortByNewest(samples)[0];
  if (hottest?.title !== HOT_POST_TITLE) {
    throw new Error(`Expected “${HOT_POST_TITLE}” to rank first, found “${hottest?.title ?? "nothing"}”.`);
  }
  if (newest?.title !== NEWEST_POST_TITLE) {
    throw new Error(`Expected “${NEWEST_POST_TITLE}” to be newest, found “${newest?.title ?? "nothing"}”.`);
  }
}

export function assertSeedIntegrity(): void {
  if (posts.length < 32) throw new Error(`Expected at least 32 posts, found ${posts.length}.`);
  if (commentCount() < 40) throw new Error(`Expected at least 40 comments, found ${commentCount()}.`);

  const names = new Set(namedUsers.map((user) => user.username));
  const emails = new Set(namedUsers.map((user) => user.email));
  if (names.size !== namedUsers.length) throw new Error("Duplicate usernames in seed users.");
  if (emails.size !== namedUsers.length) throw new Error("Duplicate emails in seed users.");

  const titles = new Set<string>();
  let showCount = 0;
  let askCount = 0;
  let ferrocene = 0;
  let maxDepth = 0;

  for (const post of posts) {
    if (!names.has(post.author)) throw new Error(`Unknown post author ${post.author}.`);
    if (titles.has(post.title)) throw new Error(`Duplicate title “${post.title}”.`);
    titles.add(post.title);
    if (post.title.length > 120) throw new Error(`Title too long: ${post.title}`);
    if (post.text.length > 5000) throw new Error(`Text too long on ${post.title}`);
    if (post.upvotes < 0) throw new Error(`Negative upvotes on ${post.title}`);
    if (post.title.startsWith("Show HN:")) showCount += 1;
    if (post.url === null) askCount += 1;
    if (`${post.title}\n${post.text}`.toLowerCase().includes("ferrocene")) ferrocene += 1;
    if (post.author === "demo" || post.author === "lurker") {
      throw new Error(`${post.author} should stay post-free so empty profiles stay truthful.`);
    }

    eachComment(post, (entry, depth, parent) => {
      if (!names.has(entry.author)) throw new Error(`Unknown comment author ${entry.author}.`);
      if (entry.hoursAgo >= post.hoursAgo) {
        throw new Error(`Comment by ${entry.author} on “${post.title}” is not newer than the post.`);
      }
      if (parent && entry.hoursAgo >= parent.hoursAgo) {
        throw new Error(`Reply by ${entry.author} is not newer than its parent on “${post.title}”.`);
      }
      if (entry.text.trim().length === 0) throw new Error("Empty seed comment.");
      maxDepth = Math.max(maxDepth, depth);
    });
  }

  if (showCount < 3) throw new Error("Need at least 3 Show HN posts.");
  if (askCount < 6) throw new Error("Need at least 6 text posts.");
  if (ferrocene !== 1) throw new Error(`Expected the word ferrocene on exactly one post, found ${ferrocene}.`);
  if (maxDepth < 4) throw new Error(`Expected a comment thread at least 4 levels deep, found ${maxDepth}.`);

  const deep = posts.find((post) => post.title === DEEP_THREAD_TITLE);
  if (!deep) throw new Error("Missing the deep discussion post.");
  const flat: Array<{ id: string; parentId: string | null; createdAt: Date }> = [];
  const walkFlat = (entries: SeedComment[], parentId: string | null) => {
    entries.forEach((entry, index) => {
      const id = `${parentId ?? "root"}-${index}-${entry.author}`;
      flat.push({ id, parentId, createdAt: new Date(Date.now() - entry.hoursAgo * 3_600_000) });
      walkFlat(entry.replies ?? [], id);
    });
  };
  walkFlat(deep.comments ?? [], null);
  if (maxThreadDepth(buildCommentTree(flat)) < 4) {
    throw new Error("Deep thread did not survive a tree build.");
  }

  const authors = new Set(posts.map((post) => post.author));
  if (!authors.has("pg")) throw new Error("pg should have posts for the profile page.");
  let pgComments = 0;
  for (const post of posts) eachComment(post, (entry) => { if (entry.author === "pg") pgComments += 1; });
  if (pgComments < 1) throw new Error("pg should have comments for the profile page.");
}
