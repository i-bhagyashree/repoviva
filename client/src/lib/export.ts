import type { SavedReport } from "./types";

/** Turns a report into a Markdown file (handy for a README, Notion or notes). */
export function reportToMarkdown(saved: SavedReport): string {
  const { report: r, repo } = saved;
  const lines: string[] = [
    `# RepoViva report: ${repo.owner}/${repo.name}`,
    "",
    `${repo.url} · ${new Date(saved.createdAt).toLocaleDateString()} · ${
      saved.engine === "builtin" ? "Quick check (built-in rules)" : "AI review"
    }`,
    "",
    `## Overall score: ${Math.round(r.overallScore)}/100`,
    "",
    "| Area | Score |",
    "|---|---|",
    `| Code quality | ${Math.round(r.scores.codeQuality)} |`,
    `| Structure | ${Math.round(r.scores.structure)} |`,
    `| Documentation | ${Math.round(r.scores.documentation)} |`,
    `| Best practices | ${Math.round(r.scores.bestPractices)} |`,
    "",
    r.summary,
    "",
    `**Tech stack:** ${r.techStack.join(", ")}`,
    "",
    "## What you did well",
    ...r.strengths.map((s) => `- ${s}`),
    "",
    "## Code review",
  ];
  for (const f of r.fileReviews) {
    lines.push(`- **[${f.severity}]** \`${f.path}\`: ${f.issue}`, `  - Fix: ${f.suggestion}`);
  }
  lines.push("", "## Interview questions");
  r.questions.forEach((q, i) => {
    lines.push(`${i + 1}. **${q.question}** _(${q.difficulty}, ${q.topic})_`);
    for (const p of q.goodAnswerCovers) lines.push(`   - ${p}`);
  });
  return lines.join("\n") + "\n";
}

export function downloadFile(filename: string, content: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
