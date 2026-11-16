import { z } from "zod";

// Shape of the AI code review. Claude is forced to return exactly this.
export const ReportSchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentences: what the project does and its overall quality"),
  techStack: z.array(z.string()).describe("Main languages, frameworks, tools"),
  overallScore: z.number().describe("Integer 0-100"),
  scores: z.object({
    codeQuality: z.number().describe("Integer 0-100"),
    structure: z.number().describe("Integer 0-100"),
    documentation: z.number().describe("Integer 0-100"),
    bestPractices: z.number().describe("Integer 0-100"),
  }),
  strengths: z.array(z.string()).describe("3-5 specific things done well"),
  fileReviews: z
    .array(
      z.object({
        path: z.string().describe("File path exactly as given"),
        severity: z.enum(["high", "medium", "low"]),
        issue: z.string().describe("What is wrong, specific to this file"),
        suggestion: z.string().describe("Concrete fix"),
      }),
    )
    .describe("5-10 most important findings, most severe first"),
  questions: z
    .array(
      z.object({
        question: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        topic: z.string().describe("Short tag, e.g. 'State management'"),
        goodAnswerCovers: z
          .array(z.string())
          .describe("2-4 points a strong answer should mention"),
      }),
    )
    .describe("8 interview questions about THIS project's actual code"),
});
export type Report = z.infer<typeof ReportSchema>;

export const FeedbackSchema = z.object({
  score: z.number().describe("Integer 0-10"),
  verdict: z.string().describe("One sentence overall judgement"),
  whatWasGood: z.array(z.string()),
  whatWasMissing: z.array(z.string()),
  modelAnswer: z
    .string()
    .describe("A strong 3-5 sentence answer the candidate could give"),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

// What the app stores and shows for one analysis.
export interface SavedReport {
  id: string;
  createdAt: string;
  engine: "ai" | "builtin"; // who wrote the review: Claude, or the built-in rule engine
  repo: { owner: string; name: string; url: string };
  filesReviewed: string[];
  filesSkipped: number;
  report: Report;
}
