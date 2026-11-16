// Interview question bank for the built-in engine. Each question has a
// condition (tech used, problem found, file present) so the final list is
// about THIS project, not generic trivia.

import type { Finding } from "./analyzer.js";
import type { RepoSnapshot } from "./github.js";
import type { Report } from "./types.js";

type Question = Report["questions"][number];
type Difficulty = Question["difficulty"];

interface Context {
  snap: RepoSnapshot;
  tech: Set<string>;
  rules: Set<string>;
  findings: Finding[];
  /** First path that matches, or undefined. */
  file: (re: RegExp) => string | undefined;
}

interface Template {
  id: string;
  /** Higher = more specific to this project, picked first. */
  weight: number;
  when: (c: Context) => boolean;
  build: (c: Context) => Omit<Question, "difficulty"> & { difficulty: Difficulty };
}

const findingPath = (c: Context, rule: string) => c.findings.find((f) => f.rule === rule)?.path ?? "your code";

const TEMPLATES: Template[] = [
  // ------------------------------------------------ about problems found
  {
    id: "secret",
    weight: 10,
    when: (c) => c.rules.has("secret") || c.rules.has("envCommitted"),
    build: (c) => ({
      question: `A secret appears to be committed in ${findingPath(c, c.rules.has("secret") ? "secret" : "envCommitted")}. What is the risk, and what exact steps would you take to fix it?`,
      difficulty: "medium",
      topic: "Security",
      goodAnswerCovers: [
        "Anyone can read it in the public repo and git history",
        "Rotate/revoke the leaked key immediately",
        "Move it to environment variables and add .env to .gitignore",
        "Optionally rewrite git history (git filter-repo / BFG)",
      ],
    }),
  },
  {
    id: "sqlConcat",
    weight: 10,
    when: (c) => c.rules.has("sqlConcat"),
    build: (c) => ({
      question: `In ${findingPath(c, "sqlConcat")} a SQL query is built from strings. Show how an attacker could abuse it and how you would rewrite it.`,
      difficulty: "hard",
      topic: "Security",
      goodAnswerCovers: [
        "SQL injection: user input changes the query",
        "Example such as ' OR 1=1 --",
        "Parameterized queries / prepared statements",
        "Validate input and use least-privilege DB user",
      ],
    }),
  },
  {
    id: "unsafeHtml",
    weight: 9,
    when: (c) => c.rules.has("unsafeHtml"),
    build: (c) => ({
      question: `${findingPath(c, "unsafeHtml")} uses innerHTML/eval. What is XSS and how would you make this code safe?`,
      difficulty: "medium",
      topic: "Security",
      goodAnswerCovers: [
        "XSS lets attacker-controlled script run in the user's browser",
        "Can steal tokens/cookies or act as the user",
        "Render as text (textContent / JSX) instead",
        "Sanitize with DOMPurify if HTML is truly needed",
      ],
    }),
  },
  {
    id: "noTests",
    weight: 7,
    when: (c) => c.rules.has("noTests"),
    build: () => ({
      question: "Your project has no automated tests. If you had one day, what would you test first and how?",
      difficulty: "medium",
      topic: "Testing",
      goodAnswerCovers: [
        "Pick the most important / riskiest logic first",
        "Name a concrete tool (Jest, Vitest, pytest, JUnit)",
        "Difference between unit and integration/end-to-end tests",
        "Run tests automatically in CI",
      ],
    }),
  },
  {
    id: "largeFile",
    weight: 7,
    when: (c) => c.rules.has("largeFile"),
    build: (c) => ({
      question: `${findingPath(c, "largeFile")} is very long. Walk me through how you would split it up.`,
      difficulty: "medium",
      topic: "Code design",
      goodAnswerCovers: [
        "Identify the separate responsibilities in the file",
        "Extract them into modules/components/hooks with clear names",
        "Single Responsibility Principle",
        "Easier to test, read and review",
      ],
    }),
  },
  {
    id: "emptyCatch",
    weight: 6,
    when: (c) => c.rules.has("emptyCatch") || c.rules.has("bareExcept"),
    build: (c) => ({
      question: `In ${findingPath(c, c.rules.has("emptyCatch") ? "emptyCatch" : "bareExcept")} errors are swallowed. How should errors be handled in this project?`,
      difficulty: "medium",
      topic: "Error handling",
      goodAnswerCovers: [
        "Silent failures hide bugs and confuse users",
        "Catch only the errors you expect",
        "Log the error and show a helpful message to the user",
        "Central error handling (middleware / error boundary)",
      ],
    }),
  },
  {
    id: "keyIndex",
    weight: 6,
    when: (c) => c.rules.has("keyIndex"),
    build: (c) => ({
      question: `In ${findingPath(c, "keyIndex")} you use the array index as a React key. Why is that a problem?`,
      difficulty: "easy",
      topic: "React rendering",
      goodAnswerCovers: [
        "Keys let React match old and new list items",
        "Index keys break when items are added, removed or reordered",
        "Can cause wrong state/inputs to stay on the wrong item",
        "Use a stable unique id from the data",
      ],
    }),
  },
  {
    id: "localhost",
    weight: 6,
    when: (c) => c.rules.has("localhost"),
    build: (c) => ({
      question: `${findingPath(c, "localhost")} has a hardcoded localhost URL. How would you deploy this app so it works in production?`,
      difficulty: "medium",
      topic: "Deployment",
      goodAnswerCovers: [
        "Use environment variables for the API base URL",
        "Different values for development and production",
        "Name a hosting option (Vercel, Render, Netlify, etc.)",
        "CORS configuration for the deployed frontend",
      ],
    }),
  },
  {
    id: "anyType",
    weight: 5,
    when: (c) => c.rules.has("anyType"),
    build: (c) => ({
      question: `You use "any" in ${findingPath(c, "anyType")}. What does that cost you, and what would you use instead?`,
      difficulty: "easy",
      topic: "TypeScript",
      goodAnswerCovers: [
        "any turns off type checking for that value",
        "Bugs then show up at runtime instead of compile time",
        "Write an interface/type, or use unknown and narrow it",
        "Validate external data (e.g. with Zod)",
      ],
    }),
  },
  {
    id: "noReadme",
    weight: 4,
    when: (c) => c.rules.has("noReadme") || c.rules.has("shortReadme"),
    build: () => ({
      question: "Explain this project to me in 60 seconds: what problem it solves, who it is for, and how it works.",
      difficulty: "easy",
      topic: "Communication",
      goodAnswerCovers: [
        "The problem and the target user",
        "The main features",
        "The tech stack and why",
        "One challenge you solved",
      ],
    }),
  },

  // ------------------------------------------------ about the tech stack
  {
    id: "react-state",
    weight: 5,
    when: (c) => c.tech.has("React") || c.tech.has("Next.js"),
    build: (c) => ({
      question: `How is state managed in this app${c.tech.has("State library") ? ", and why did you add a state library instead of plain React state" : ""}? Where does each piece of state live?`,
      difficulty: "medium",
      topic: "State management",
      goodAnswerCovers: [
        "Local state (useState) vs shared/global state",
        "Lifting state up or using context/store",
        "Server data vs UI state",
        "A concrete example from the project",
      ],
    }),
  },
  {
    id: "react-effect",
    weight: 4,
    when: (c) => c.tech.has("React"),
    build: () => ({
      question: "When does useEffect run, and what bugs can a wrong dependency array cause?",
      difficulty: "medium",
      topic: "React hooks",
      goodAnswerCovers: [
        "Runs after render; dependencies control when it re-runs",
        "Missing deps: stale values; extra deps: infinite loops",
        "Cleanup function for subscriptions/timers",
        "Avoid effects for values you can compute during render",
      ],
    }),
  },
  {
    id: "nextjs",
    weight: 5,
    when: (c) => c.tech.has("Next.js"),
    build: () => ({
      question: "Which pages in your Next.js app are rendered on the server and which on the client, and why?",
      difficulty: "hard",
      topic: "Rendering",
      goodAnswerCovers: [
        "Server components / SSR vs client components",
        "SEO and first-load speed benefits of server rendering",
        "Interactivity needs the client ('use client')",
        "Static generation / caching where data rarely changes",
      ],
    }),
  },
  {
    id: "express-api",
    weight: 5,
    when: (c) => c.tech.has("Express") || c.tech.has("Node.js framework"),
    build: (c) => ({
      question: `Walk me through what happens when a request hits your API${c.file(/(^|\/)(server|app|index)\.(js|ts)$/) ? ` (starting in ${c.file(/(^|\/)(server|app|index)\.(js|ts)$/)})` : ""}, from the route to the response.`,
      difficulty: "medium",
      topic: "Backend",
      goodAnswerCovers: [
        "Middleware order (JSON parsing, CORS, auth)",
        "Route handler and input validation",
        "Database/service call",
        "Error handling and status codes",
      ],
    }),
  },
  {
    id: "validation",
    weight: 3,
    when: (c) => c.tech.has("Express") || c.tech.has("Flask") || c.tech.has("FastAPI") || c.tech.has("Django"),
    build: () => ({
      question: "How do you validate the data clients send to your API? What happens if someone sends bad data?",
      difficulty: "medium",
      topic: "API design",
      goodAnswerCovers: [
        "Never trust client input",
        "Schema validation (Zod/Joi/Pydantic/serializers)",
        "Return 400 with a clear error message",
        "Prevents crashes and security issues",
      ],
    }),
  },
  {
    id: "auth",
    weight: 7,
    when: (c) => c.tech.has("Authentication"),
    build: () => ({
      question: "How does login work in your app? Where is the token or session stored, and how do you protect passwords?",
      difficulty: "hard",
      topic: "Authentication",
      goodAnswerCovers: [
        "Passwords hashed with bcrypt/argon2, never stored plain",
        "JWT vs session cookie and where it is stored",
        "httpOnly cookies vs localStorage and XSS risk",
        "Token expiry and protecting routes with middleware",
      ],
    }),
  },
  {
    id: "mongo",
    weight: 5,
    when: (c) => c.tech.has("MongoDB"),
    build: () => ({
      question: "Why did you choose MongoDB for this project instead of a SQL database? Describe your main schema.",
      difficulty: "medium",
      topic: "Database",
      goodAnswerCovers: [
        "Document model vs tables and relations",
        "Fit for this project's data shape",
        "Trade-offs: joins, transactions, consistency",
        "Indexes on fields you query often",
      ],
    }),
  },
  {
    id: "sql",
    weight: 5,
    when: (c) => c.tech.has("SQL database"),
    build: () => ({
      question: "Describe your database tables and their relationships. Which queries would get slow as data grows?",
      difficulty: "hard",
      topic: "Database",
      goodAnswerCovers: [
        "Tables, primary and foreign keys",
        "One-to-many / many-to-many relationships",
        "Indexes for frequent WHERE/JOIN columns",
        "N+1 queries and pagination",
      ],
    }),
  },
  {
    id: "socket",
    weight: 6,
    when: (c) => c.tech.has("Socket.io"),
    build: () => ({
      question: "How does real-time communication work in your app, and what happens when a user's connection drops?",
      difficulty: "hard",
      topic: "Real-time",
      goodAnswerCovers: [
        "WebSockets keep a two-way connection open",
        "Events/rooms used in the project",
        "Reconnection and missed messages",
        "Scaling across servers (Redis adapter)",
      ],
    }),
  },
  {
    id: "typescript",
    weight: 3,
    when: (c) => c.tech.has("TypeScript") && !c.rules.has("anyType"),
    build: () => ({
      question: "Why did you use TypeScript here? Give one bug it caught or would catch in this project.",
      difficulty: "easy",
      topic: "TypeScript",
      goodAnswerCovers: [
        "Catches type errors before running the code",
        "Better autocomplete and safer refactoring",
        "A concrete example from the project",
        "Types do not check runtime data from APIs",
      ],
    }),
  },
  {
    id: "tailwind",
    weight: 2,
    when: (c) => c.tech.has("Tailwind CSS"),
    build: () => ({
      question: "Why Tailwind CSS instead of plain CSS or CSS modules? How do you keep repeated class lists manageable?",
      difficulty: "easy",
      topic: "Styling",
      goodAnswerCovers: [
        "Utility classes, fast to build and consistent spacing/colors",
        "No unused CSS in the production build",
        "Extract repeated markup into components",
        "Downside: long class strings",
      ],
    }),
  },
  {
    id: "django-flask",
    weight: 5,
    when: (c) => c.tech.has("Django") || c.tech.has("Flask") || c.tech.has("FastAPI"),
    build: (c) => {
      const fw = ["Django", "Flask", "FastAPI"].find((f) => c.tech.has(f))!;
      return {
        question: `Why did you choose ${fw} for this project? What would change if it had 10,000 users a day?`,
        difficulty: "medium",
        topic: "Backend",
        goodAnswerCovers: [
          `What ${fw} gives you out of the box`,
          "Production server (gunicorn/uvicorn) instead of the dev server",
          "Database indexes and caching",
          "Running multiple instances behind a load balancer",
        ],
      };
    },
  },
  {
    id: "ml",
    weight: 6,
    when: (c) => c.tech.has("Machine learning"),
    build: () => ({
      question: "How did you evaluate your model? How do you know it is not overfitting?",
      difficulty: "hard",
      topic: "Machine learning",
      goodAnswerCovers: [
        "Train / validation / test split",
        "The metric chosen and why (accuracy, F1, RMSE...)",
        "Comparing training vs validation score",
        "Regularization, more data or simpler model",
      ],
    }),
  },
  {
    id: "spring",
    weight: 5,
    when: (c) => c.tech.has("Spring Boot"),
    build: () => ({
      question: "Explain dependency injection in your Spring Boot app. How are your controllers, services and repositories connected?",
      difficulty: "medium",
      topic: "Spring Boot",
      goodAnswerCovers: [
        "Spring creates beans and injects them",
        "Controller -> Service -> Repository layers",
        "Constructor injection is preferred",
        "Makes classes easy to test with mocks",
      ],
    }),
  },
  {
    id: "docker",
    weight: 3,
    when: (c) => c.tech.has("Docker"),
    build: () => ({
      question: "What does your Dockerfile do step by step, and how would you make the image smaller?",
      difficulty: "medium",
      topic: "DevOps",
      goodAnswerCovers: [
        "Base image, copy files, install deps, start command",
        "Layer caching: copy dependency files first",
        "Multi-stage builds and slim/alpine base images",
        ".dockerignore",
      ],
    }),
  },

  // ------------------------------------------------ always available
  {
    id: "hardest",
    weight: 1,
    when: () => true,
    build: (c) => ({
      question: `What was the hardest bug or problem you faced while building ${c.snap.repo.name}, and how did you solve it?`,
      difficulty: "easy",
      topic: "Experience",
      goodAnswerCovers: [
        "A specific, real problem",
        "How you debugged it (steps, tools)",
        "The fix and why it worked",
        "What you learned",
      ],
    }),
  },
  {
    id: "scale",
    weight: 1,
    when: () => true,
    build: (c) => ({
      question: `If ${c.snap.repo.name} suddenly had 100x more users, what would break first and what would you change?`,
      difficulty: "hard",
      topic: "Scalability",
      goodAnswerCovers: [
        "Identify the bottleneck (database, server, API limits)",
        "Caching and database indexes",
        "Horizontal scaling / load balancing",
        "Measure first: monitoring and logs",
      ],
    }),
  },
  {
    id: "improve",
    weight: 1,
    when: () => true,
    build: (c) => ({
      question: `If you rebuilt ${c.snap.repo.name} from scratch, what would you do differently?`,
      difficulty: "medium",
      topic: "Reflection",
      goodAnswerCovers: [
        "A concrete design or tech choice to change",
        "Why: the problem it caused",
        "Testing / structure improvements",
        "Shows honest self-review",
      ],
    }),
  },
  {
    id: "structure",
    weight: 1,
    when: () => true,
    build: () => ({
      question: "Walk me through the folder structure of the project. Where would a new developer add a new feature?",
      difficulty: "easy",
      topic: "Project structure",
      goodAnswerCovers: [
        "What each main folder contains",
        "How frontend/backend or layers are separated",
        "Where shared code lives",
        "A concrete example of adding a feature",
      ],
    }),
  },
  {
    id: "mainFile",
    weight: 2,
    when: (c) => mainFile(c) !== undefined,
    build: (c) => ({
      question: `Explain what ${mainFile(c)} does. Why did you put that logic there?`,
      difficulty: "medium",
      topic: "Code walkthrough",
      goodAnswerCovers: [
        "The file's main responsibility",
        "How it connects to the rest of the code",
        "The key functions or components inside it",
        "Something you would improve in it",
      ],
    }),
  },
  {
    id: "testsExist",
    weight: 2,
    when: (c) => !c.rules.has("noTests"),
    build: () => ({
      question: "What do your tests cover, and what important behaviour is still untested?",
      difficulty: "medium",
      topic: "Testing",
      goodAnswerCovers: [
        "Which parts have tests and what type (unit, integration, e2e)",
        "How to run them",
        "A gap in coverage and why it matters",
        "Mocking external services or the database",
      ],
    }),
  },
  {
    id: "security",
    weight: 1,
    when: (c) => !c.rules.has("secret") && !c.rules.has("sqlConcat") && !c.rules.has("unsafeHtml"),
    build: (c) => ({
      question: `Where is ${c.snap.repo.name} most open to attack, and how have you protected it?`,
      difficulty: "hard",
      topic: "Security",
      goodAnswerCovers: [
        "Untrusted input: validation and sanitising",
        "Secrets kept in environment variables",
        "Authentication/authorization checks where needed",
        "Keeping dependencies updated (npm audit, Dependabot)",
      ],
    }),
  },
  {
    id: "deploy",
    weight: 1,
    when: (c) => !c.rules.has("localhost"),
    build: () => ({
      question: "How would you deploy this project, and how would you know if it broke in production?",
      difficulty: "medium",
      topic: "Deployment",
      goodAnswerCovers: [
        "A concrete hosting choice and why",
        "Environment variables / config per environment",
        "CI/CD: build and test before deploy",
        "Logs, monitoring or error tracking (e.g. Sentry)",
      ],
    }),
  },
];

/** The most "central" source file: an entry point if there is one, else the biggest code file read. */
function mainFile(c: Context): string | undefined {
  const code = c.snap.files.filter((f) => /\.(js|jsx|ts|tsx|py|java|kt|go|rb|php|cs|vue|svelte)$/i.test(f.path));
  const entry = code.find((f) =>
    /(^|\/)(App|app|main|index|server|views|routes)\.(jsx?|tsx?|py|java|go)$/.test(f.path) && !/(^|\/)(tests?|examples?)\//.test(f.path),
  );
  if (entry) return entry.path;
  return [...code].sort((a, b) => b.content.length - a.content.length)[0]?.path;
}

const TARGET = 8;
const DIFFICULTY_GOAL: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 2 };

export function pickQuestions(snap: RepoSnapshot, findings: Finding[], tech: string[]): Question[] {
  const c: Context = {
    snap,
    tech: new Set(tech),
    rules: new Set(findings.map((f) => f.rule)),
    findings,
    file: (re) => snap.files.find((f) => re.test(f.path))?.path,
  };

  const candidates = TEMPLATES.filter((t) => t.when(c))
    .sort((a, b) => b.weight - a.weight)
    .map((t) => t.build(c));

  // First pass: most specific questions while keeping a mix of difficulties.
  const picked: Question[] = [];
  const used: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of candidates) {
    if (picked.length >= TARGET) break;
    if (used[q.difficulty] >= DIFFICULTY_GOAL[q.difficulty]) continue;
    picked.push(q);
    used[q.difficulty]++;
  }
  // Second pass: fill any remaining slots regardless of difficulty.
  for (const q of candidates) {
    if (picked.length >= TARGET) break;
    if (!picked.includes(q)) picked.push(q);
  }

  const order: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
  return picked.sort((a, b) => order[a.difficulty] - order[b.difficulty]);
}
