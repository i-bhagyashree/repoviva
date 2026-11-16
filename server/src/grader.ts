// Offline answer grader for the built-in engine. It checks which of the
// "a good answer covers" points the student's answer mentions, using simple
// keyword matching. Less smart than the AI grader, but free and instant.

import type { Feedback } from "./types.js";

const STOP = new Set(
  ("a an the and or but of to in on for with without by from as at is are was were be been it its this that these those " +
    "you your use using used what why how when where which who can could should would will do does did not no instead " +
    "into than then so such e.g eg etc vs one two each only very more most also there their them they about out up")
    .split(" "),
);

/** Rough stem: lower-case and keep the first 5 letters, so "caching" ~ "cache", "validate" ~ "validation". */
const stem = (word: string) => word.toLowerCase().slice(0, 5);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function covers(answerStems: Set<string>, point: string): boolean {
  const keys = [...new Set(words(point).map(stem))];
  if (keys.length === 0) return false;
  const hits = keys.filter((k) => answerStems.has(k)).length;
  // Short points need one hit; longer points need about a third of their keywords.
  return hits >= Math.max(1, Math.ceil(keys.length / 3));
}

export function gradeOffline(input: { question: string; goodAnswerCovers: string[]; answer: string }): Feedback {
  const answerWords = words(input.answer);
  const answerStems = new Set(answerWords.map(stem));
  const wordCount = input.answer.trim().split(/\s+/).length;

  const points = input.goodAnswerCovers;
  const hit = points.filter((p) => covers(answerStems, p));
  const missed = points.filter((p) => !hit.includes(p));
  const ratio = points.length ? hit.length / points.length : 0;

  let score = Math.round(ratio * 8);
  if (wordCount >= 40) score += 1;
  if (wordCount >= 80) score += 1;
  if (wordCount < 15) score = Math.min(score, 4);
  score = Math.max(1, Math.min(10, score));

  const verdict =
    score >= 8
      ? "Strong answer: you covered the key points with enough detail."
      : score >= 5
        ? "Decent answer, but a few important points are missing."
        : "Too thin for an interview yet: cover more of the key points and give an example.";

  const whatWasGood = hit.map((p) => `You covered: ${p}.`);
  if (wordCount >= 40) whatWasGood.push("Good length: you explained instead of giving a one-liner.");

  const whatWasMissing = missed.map((p) => `Mention: ${p}.`);
  if (wordCount < 40) whatWasMissing.push("Add more detail and one concrete example from your project.");

  const modelAnswer =
    points.length > 0
      ? `A strong answer would cover these points, ideally with an example from your code: ${points
          .map((p) => p.replace(/\.$/, ""))
          .join("; ")}.`
      : "Explain the idea, why it matters in this project, and give one concrete example from your code.";

  return { score, verdict, whatWasGood, whatWasMissing, modelAnswer };
}
