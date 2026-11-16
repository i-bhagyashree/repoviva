// RepoViva's built-in review engine. No AI and no API key: it reads the
// code with pattern rules (like a small linter), scores the project, and
// picks interview questions that match the tech stack and the problems found.

import type { RepoSnapshot } from "./github.js";
import { pickQuestions } from "./questions.js";
import type { Report } from "./types.js";

type Severity = "high" | "medium" | "low";
type Category = "codeQuality" | "structure" | "documentation" | "bestPractices";

export interface Finding {
  rule: string;
  path: string;
  severity: Severity;
  category: Category;
  issue: string;
  suggestion: string;
}

interface LineRule {
  id: string;
  exts: RegExp; // which files the rule applies to
  pattern: RegExp; // must have the "g" flag
  severity: Severity;
  category: Category;
  minCount?: number; // only report when found at least this many times
  skipLine?: RegExp; // ignore matches on lines like this
  skipPath?: RegExp;
  issue: (count: number) => string;
  suggestion: string;
}

const JS = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte)$/i;
const JSX = /\.(jsx|tsx)$/i;
const TS = /\.(ts|tsx)$/i;
const PY = /\.py$/i;
const JAVA = /\.(java|kt)$/i;
const ANY_CODE = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|py|java|kt|go|rb|php|cs)$/i;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|#)/;

const LINE_RULES: LineRule[] = [
  {
    id: "secret",
    exts: ANY_CODE,
    pattern:
      /((api[_-]?key|secret|passw(or)?d|token)\w*\s*[:=]\s*["'`][A-Za-z0-9_\-+/=.]{12,}["'`])|\b(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})\b/gi,
    severity: "high",
    category: "bestPractices",
    skipLine: /process\.env|import\.meta\.env|os\.environ|getenv/,
    issue: () => "A secret (API key, password or token) looks hardcoded in the source code.",
    suggestion: "Move it to an environment variable (.env file that is NOT committed) and rotate the leaked value.",
  },
  {
    id: "unsafeHtml",
    exts: JS,
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(/g,
    severity: "high",
    category: "bestPractices",
    issue: () => "Uses innerHTML, dangerouslySetInnerHTML or eval, which can let attackers run scripts (XSS).",
    suggestion: "Render text with normal JSX/textContent, or sanitize the HTML with a library such as DOMPurify.",
  },
  {
    id: "sqlConcat",
    exts: ANY_CODE,
    pattern: /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^\n]*(\$\{|["']\s*\+|%s["']\s*%|\.format\()/g,
    severity: "high",
    category: "bestPractices",
    issue: () => "SQL query is built by joining strings with variables, which allows SQL injection.",
    suggestion: "Use parameterized queries (placeholders like ? or $1) or an ORM.",
  },
  {
    id: "emptyCatch",
    exts: ANY_CODE,
    pattern: /catch\s*(\([^)]*\))?\s*\{\s*\}/g,
    severity: "medium",
    category: "codeQuality",
    issue: (n) => `${n} empty catch block${n > 1 ? "s" : ""}: errors are silently ignored.`,
    suggestion: "Log the error or show a message to the user, so failures are visible.",
  },
  {
    id: "keyIndex",
    exts: JSX,
    pattern: /key=\{\s*(index|idx|i)\s*\}/g,
    severity: "medium",
    category: "codeQuality",
    issue: () => "List items use the array index as the React key.",
    suggestion: "Use a stable unique id from the data, so React does not mix up items when the list changes.",
  },
  {
    id: "domInReact",
    exts: JSX,
    pattern: /document\.(getElementById|querySelector(All)?)\(/g,
    severity: "medium",
    category: "codeQuality",
    issue: () => "Reads the DOM directly (document.getElementById / querySelector) inside a React component.",
    suggestion: "Use state or a ref (useRef) instead; direct DOM access fights with React's rendering.",
  },
  {
    id: "anyType",
    exts: TS,
    pattern: /:\s*any\b|\bas\s+any\b|<any>/g,
    severity: "medium",
    category: "codeQuality",
    minCount: 2,
    issue: (n) => `The "any" type is used ${n} times, which switches off TypeScript's checking.`,
    suggestion: "Write a real type or interface; use 'unknown' when the type truly is not known.",
  },
  {
    id: "localhost",
    exts: JS,
    pattern: /["'`]https?:\/\/(localhost|127\.0\.0\.1)[:/]/g,
    severity: "medium",
    category: "bestPractices",
    skipLine: /\?\?|\|\||console\./,
    skipPath: /\.config\.|(^|\/)(test|tests|__tests__)\//,
    issue: () => "A localhost URL is hardcoded, so the app will break when deployed.",
    suggestion: "Read the base URL from an environment variable (for example VITE_API_URL).",
  },
  {
    id: "var",
    exts: JS,
    pattern: /^\s*var\s+\w/gm,
    severity: "low",
    category: "codeQuality",
    issue: (n) => `Uses "var" ${n} time${n > 1 ? "s" : ""}.`,
    suggestion: "Use const (or let when the value changes); var has confusing scoping rules.",
  },
  {
    id: "looseEq",
    exts: JS,
    pattern: /[^=!<>]==[^=]/g,
    severity: "low",
    category: "codeQuality",
    minCount: 2,
    issue: (n) => `Uses loose equality (==) ${n} times.`,
    suggestion: "Use === so values are not silently converted before comparing.",
  },
  {
    id: "consoleLog",
    exts: JS,
    pattern: /\bconsole\.(log|debug)\(/g,
    severity: "low",
    category: "codeQuality",
    minCount: 3,
    issue: (n) => `${n} console.log statements left in the code.`,
    suggestion: "Remove debug logs before committing, or use a logger with levels.",
  },
  {
    id: "alert",
    exts: JS,
    pattern: /\b(alert|confirm)\s*\(/g,
    severity: "low",
    category: "codeQuality",
    issue: () => "Uses browser alert()/confirm() for messages.",
    suggestion: "Show messages inside the page (toast or inline text); alerts block the page and look unpolished.",
  },
  {
    id: "inlineStyle",
    exts: JSX,
    pattern: /style=\{\{/g,
    severity: "low",
    category: "codeQuality",
    minCount: 5,
    issue: (n) => `${n} inline style objects in one component.`,
    suggestion: "Move styles to CSS classes so they can be reused and the JSX stays readable.",
  },
  {
    id: "todo",
    exts: ANY_CODE,
    pattern: /\b(TODO|FIXME|HACK)\b/g,
    severity: "low",
    category: "codeQuality",
    skipLine: /^$/, // comments are exactly where these live, so do not skip them
    issue: (n) => `${n} TODO/FIXME note${n > 1 ? "s" : ""} left in the code.`,
    suggestion: "Finish them or move them to GitHub Issues, so the code looks complete.",
  },
  {
    id: "bareExcept",
    exts: PY,
    pattern: /^\s*except\s*:/gm,
    severity: "medium",
    category: "codeQuality",
    issue: () => "Bare 'except:' catches every error, including typos and Ctrl+C.",
    suggestion: "Catch the specific exception you expect, e.g. 'except ValueError:'.",
  },
  {
    id: "print",
    exts: PY,
    pattern: /^\s*print\(/gm,
    severity: "low",
    category: "codeQuality",
    minCount: 4,
    issue: (n) => `${n} print() statements used for output/debugging.`,
    suggestion: "Use the logging module so messages have levels and can be turned off.",
  },
  {
    id: "sysout",
    exts: JAVA,
    pattern: /System\.out\.println|\.printStackTrace\(\)/g,
    severity: "low",
    category: "codeQuality",
    minCount: 3,
    issue: (n) => `${n} System.out.println / printStackTrace calls.`,
    suggestion: "Use a logger (SLF4J/Logback) instead of printing to the console.",
  },
];

const PENALTY: Record<Severity, number> = { high: 15, medium: 8, low: 3 };
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

function checkFile(path: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (const rule of LINE_RULES) {
    if (!rule.exts.test(path) || rule.skipPath?.test(path)) continue;
    const skip = rule.skipLine ?? COMMENT_LINE;
    const hitLines: number[] = [];
    for (const match of content.matchAll(rule.pattern)) {
      const line = lineOf(content, match.index);
      const text = lines[line - 1] ?? "";
      if (skip.test(text)) continue;
      if (rule.skipLine && COMMENT_LINE.test(text) && rule.id !== "todo") continue;
      hitLines.push(line);
    }
    if (hitLines.length < (rule.minCount ?? 1)) continue;
    const shown = [...new Set(hitLines)].slice(0, 4).join(", ");
    const more = hitLines.length > 4 ? ", ..." : "";
    findings.push({
      rule: rule.id,
      path,
      severity: rule.severity,
      category: rule.category,
      issue: `${rule.issue(hitLines.length)} (line ${shown}${more})`,
      suggestion: rule.suggestion,
    });
  }

  if (ANY_CODE.test(path) && lines.length > 300) {
    findings.push({
      rule: "largeFile",
      path,
      severity: lines.length > 600 ? "high" : "medium",
      category: "structure",
      issue: `This file is ${lines.length} lines long and probably does too many jobs.`,
      suggestion: "Split it into smaller files, each with one clear responsibility.",
    });
  }
  return findings;
}

const has = (paths: string[], re: RegExp) => paths.some((p) => re.test(p));

function checkRepo(snap: RepoSnapshot): Finding[] {
  const paths = snap.allPaths;
  const findings: Finding[] = [];
  const add = (
    rule: string,
    path: string,
    severity: Severity,
    category: Category,
    issue: string,
    suggestion: string,
  ) => findings.push({ rule, path, severity, category, issue, suggestion });

  // --- Documentation
  const readme = snap.files.find((f) => /(^|\/)readme(\.md|\.txt)?$/i.test(f.path) && !f.path.includes("/"));
  if (!readme) {
    add("noReadme", "README.md", "high", "documentation",
      "There is no README at the top of the repository.",
      "Add a README with: what the project does, a screenshot, how to install and run it, and the tech stack.");
  } else {
    const text = readme.content;
    if (text.length < 400) {
      add("shortReadme", readme.path, "medium", "documentation",
        "The README is very short, so a recruiter cannot tell what the project does.",
        "Explain the problem it solves, the main features and the tech stack in a few short sections.");
    }
    if (!/\b(install|setup|set up|getting started|run|usage|npm (i|install|run)|pip install|yarn)\b/i.test(text)) {
      add("noSetup", readme.path, "medium", "documentation",
        "The README does not say how to install or run the project.",
        "Add a 'Getting started' section with the exact commands.");
    }
    if (!/!\[[^\]]*\]\(|<img\s|https?:\/\/[^\s)]+\.(vercel\.app|netlify\.app|onrender\.com|github\.io|web\.app|pages\.dev)/i.test(text)) {
      add("noDemo", readme.path, "low", "documentation",
        "The README has no screenshot and no live demo link.",
        "Add at least one screenshot or GIF and a deployed link; most recruiters will not run your code.");
    }
  }
  if (!snap.repo.description) {
    add("noDescription", "(repository settings)", "low", "documentation",
      "The GitHub repository has no description.",
      "Add a one-line description and topics in the repo's 'About' box.");
  }

  // --- Best practices
  const envFile = paths.find((p) => /(^|\/)\.env(\.(local|development|production))?$/.test(p));
  if (envFile) {
    add("envCommitted", envFile, "high", "bestPractices",
      "A .env file is committed, so any secrets inside it are public.",
      "Remove it from git, add .env to .gitignore, commit a .env.example instead, and change the exposed secrets.");
  }
  if (has(paths, /(^|\/)node_modules\//)) {
    add("nodeModules", "node_modules/", "high", "bestPractices",
      "The node_modules folder is committed to git.",
      "Delete it from the repo and add node_modules to .gitignore; it is recreated by npm install.");
  }
  if (!has(paths, /(^|\/)\.gitignore$/)) {
    add("noGitignore", ".gitignore", "medium", "bestPractices",
      "There is no .gitignore file.",
      "Add one for your language (github.com/github/gitignore) so build output and secrets are not committed.");
  }
  if (!has(paths, /(\.(test|spec)\.[a-z]+$)|(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]+\.py$/i)) {
    add("noTests", "(whole project)", "high", "bestPractices",
      "The project has no automated tests.",
      "Add a few tests for the most important logic (Vitest/Jest for JS, pytest for Python). Even 3 tests set you apart.");
  }
  if (
    has(paths, /(^|\/)package\.json$/) &&
    !has(paths, /(^|\/)(\.eslintrc[^/]*|eslint\.config\.[a-z]+|\.oxlintrc[^/]*|biome\.jsonc?|\.prettierrc[^/]*)$/)
  ) {
    add("noLint", "package.json", "medium", "bestPractices",
      "No linter or formatter is configured.",
      "Add ESLint and Prettier so the code style stays consistent.");
  }

  // --- Structure
  const codeFiles = paths.filter((p) => ANY_CODE.test(p) && !/(^|\/)node_modules\//.test(p));
  const rootCode = codeFiles.filter((p) => !p.includes("/"));
  if (codeFiles.length > 5 && rootCode.length / codeFiles.length > 0.7) {
    add("flatStructure", "(root folder)", "medium", "structure",
      `${rootCode.length} of ${codeFiles.length} code files sit directly in the root folder.`,
      "Group files into folders by purpose, e.g. src/components, src/pages, src/utils.");
  }
  if (snap.skipped > 0 && snap.tooLarge > 0) {
    add("hugeFiles", "(whole project)", "low", "structure",
      `${snap.tooLarge} source file${snap.tooLarge > 1 ? "s are" : " is"} larger than 20 KB.`,
      "Very large files are hard to read and review; split them up.");
  }
  return findings;
}

// ---------------------------------------------------------------- tech stack

const NPM_TECH: [RegExp, string][] = [
  [/^next$/, "Next.js"], [/^react$/, "React"], [/^vue$/, "Vue"], [/^@angular\/core$/, "Angular"],
  [/^svelte$/, "Svelte"], [/^express$/, "Express"], [/^(fastify|koa|@nestjs\/core)$/, "Node.js framework"],
  [/^typescript$/, "TypeScript"], [/^tailwindcss$/, "Tailwind CSS"], [/^(redux|@reduxjs\/toolkit|zustand)$/, "State library"],
  [/^(mongoose|mongodb)$/, "MongoDB"], [/^(pg|mysql2?|sqlite3|better-sqlite3|sequelize|@prisma\/client|prisma|drizzle-orm)$/, "SQL database"],
  [/^(jsonwebtoken|passport|next-auth|bcrypt(js)?)$/, "Authentication"], [/^socket\.io(-client)?$/, "Socket.io"],
  [/^(jest|vitest|mocha|@playwright\/test|cypress)$/, "Testing"], [/^vite$/, "Vite"], [/^axios$/, "Axios"],
  [/^react-router(-dom)?$/, "React Router"],
];
const PY_TECH: [RegExp, string][] = [
  [/\bdjango\b/i, "Django"], [/\bflask\b/i, "Flask"], [/\bfastapi\b/i, "FastAPI"],
  [/\b(pandas|numpy)\b/i, "Data (pandas/numpy)"], [/\b(scikit-learn|tensorflow|torch)\b/i, "Machine learning"],
  [/\bpytest\b/i, "Testing"],
];
const LANG_BY_EXT: [RegExp, string][] = [
  [/\.(ts|tsx)$/i, "TypeScript"], [/\.(js|jsx|mjs|cjs)$/i, "JavaScript"], [/\.py$/i, "Python"],
  [/\.java$/i, "Java"], [/\.kt$/i, "Kotlin"], [/\.go$/i, "Go"], [/\.php$/i, "PHP"], [/\.cs$/i, "C#"],
  [/\.(cpp|c|h)$/i, "C/C++"], [/\.rb$/i, "Ruby"], [/\.dart$/i, "Dart"],
];

export function detectTech(snap: RepoSnapshot): string[] {
  const tech = new Set<string>();

  const counts = new Map<string, number>();
  for (const p of snap.allPaths) {
    if (/(^|\/)node_modules\//.test(p)) continue;
    for (const [re, lang] of LANG_BY_EXT) {
      if (re.test(p)) counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([lang]) => tech.add(lang));

  for (const f of snap.files) {
    if (/(^|\/)package\.json$/.test(f.path)) {
      try {
        const pkg = JSON.parse(f.content) as Record<string, Record<string, string> | undefined>;
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        for (const dep of deps) for (const [re, name] of NPM_TECH) if (re.test(dep)) tech.add(name);
        if (deps.length > 0 || pkg.scripts) tech.add("Node.js");
      } catch {
        // broken package.json: ignore
      }
    }
    if (/(^|\/)(requirements\.txt|pyproject\.toml)$/.test(f.path)) {
      for (const [re, name] of PY_TECH) if (re.test(f.content)) tech.add(name);
    }
    if (/(^|\/)(pom\.xml|build\.gradle)$/.test(f.path) && /spring/i.test(f.content)) tech.add("Spring Boot");
  }
  if (snap.allPaths.some((p) => /(^|\/)Dockerfile$/.test(p))) tech.add("Docker");
  return [...tech];
}

// ------------------------------------------------------------------- scoring

function strengthsOf(snap: RepoSnapshot, findings: Finding[], tech: string[]): string[] {
  const rules = new Set(findings.map((f) => f.rule));
  const paths = snap.allPaths;
  const out: string[] = [];
  if (!rules.has("noReadme") && !rules.has("shortReadme") && !rules.has("noSetup")) {
    out.push("The README explains the project and how to run it.");
  }
  if (!rules.has("noTests")) out.push("The project includes automated tests.");
  if (tech.includes("TypeScript")) out.push("Uses TypeScript, which catches many bugs before the code runs.");
  if (has(paths, /^\.github\/workflows\//)) out.push("Has a CI workflow (GitHub Actions) that checks the code automatically.");
  if (!rules.has("secret") && !rules.has("envCommitted")) out.push("No secrets or .env files were found in the repository.");
  if (!rules.has("largeFile") && !rules.has("flatStructure")) out.push("Files are small and organised into folders.");
  if (!rules.has("noLint") && has(paths, /(^|\/)package\.json$/)) out.push("A linter/formatter is configured.");
  if (has(paths, /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/)) out.push("Includes Docker setup, which makes the project easy to run anywhere.");
  if (out.length === 0) out.push("The project is public and has real code a reviewer can read, which is the first step.");
  return out.slice(0, 5);
}

const CATEGORY_LABEL: Record<Category, string> = {
  codeQuality: "code quality",
  structure: "project structure",
  documentation: "documentation",
  bestPractices: "best practices",
};

export function analyzeRepo(snap: RepoSnapshot): Report {
  const findings = [
    ...checkRepo(snap),
    ...snap.files.flatMap((f) => checkFile(f.path, f.content)),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Start at 90, not 100: rules cannot see design quality, so a clean result
  // from them alone should not look like a perfect project.
  const scores: Record<Category, number> = {
    codeQuality: 90,
    structure: 90,
    documentation: 90,
    bestPractices: 90,
  };
  // Penalise each rule once, growing a little with how many files have it,
  // so one habit repeated in 30 files does not sink the whole score.
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  for (const group of byRule.values()) {
    const worst = group[0]; // findings are sorted most severe first
    const spread = Math.min(2, 1 + 0.25 * (group.length - 1));
    scores[worst.category] -= Math.round(PENALTY[worst.severity] * spread);
  }
  for (const key of Object.keys(scores) as Category[]) scores[key] = Math.max(20, scores[key]);

  const overallScore = Math.round(
    scores.codeQuality * 0.35 +
      scores.bestPractices * 0.25 +
      scores.structure * 0.2 +
      scores.documentation * 0.2,
  );

  const tech = detectTech(snap);
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const weakest = (Object.keys(scores) as Category[]).sort((a, b) => scores[a] - scores[b])[0];
  const summary =
    `${snap.repo.name} is a ${tech.slice(0, 3).join(", ") || "software"} project` +
    `${snap.repo.description ? `: ${snap.repo.description.replace(/\.$/, "")}` : ""}. ` +
    `RepoViva checked ${snap.files.length} files and found ${count("high")} high, ${count("medium")} medium ` +
    `and ${count("low")} low priority issues.` +
    (findings.length > 0 ? ` The area to improve first is ${CATEGORY_LABEL[weakest]}.` : "");

  return {
    summary,
    techStack: tech,
    overallScore,
    scores,
    strengths: strengthsOf(snap, findings, tech),
    fileReviews: [...byRule.values()]
      .map((group) => {
        const first = group[0];
        if (group.length <= 2) return group;
        // Same problem in many files: show it once, naming where it happens.
        return [{
          ...first,
          path: `${first.path} + ${group.length - 1} more files`,
          issue: `${first.issue} The same issue appears in ${group.length - 1} other files: ${group
            .slice(1, 4)
            .map((g) => g.path)
            .join(", ")}${group.length > 4 ? ", ..." : ""}.`,
        }];
      })
      .flat()
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, 12)
      .map(({ path, severity, issue, suggestion }) => ({ path, severity, issue, suggestion })),
    questions: pickQuestions(snap, findings, tech),
  };
}
