// Shapes of the data the API returns. Keep in sync with server/src/types.ts.

export interface Report {
  summary: string;
  techStack: string[];
  overallScore: number;
  scores: {
    codeQuality: number;
    structure: number;
    documentation: number;
    bestPractices: number;
  };
  strengths: string[];
  fileReviews: {
    path: string;
    severity: "high" | "medium" | "low";
    issue: string;
    suggestion: string;
  }[];
  questions: {
    question: string;
    difficulty: "easy" | "medium" | "hard";
    topic: string;
    goodAnswerCovers: string[];
  }[];
}

export interface Feedback {
  score: number;
  verdict: string;
  whatWasGood: string[];
  whatWasMissing: string[];
  modelAnswer: string;
}

export interface SavedReport {
  id: string;
  createdAt: string;
  engine?: "ai" | "builtin"; // missing on reports saved by older versions
  demo?: boolean; // older versions: true = fake sample report
  repo: { owner: string; name: string; url: string };
  filesReviewed: string[];
  filesSkipped: number;
  report: Report;
}

export interface StoredReport extends SavedReport {
  shared: boolean;
}

export interface SharedReport extends StoredReport {
  ownerName: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PracticeAttempt {
  id: string;
  reportId: string | null;
  question: string;
  topic: string;
  score: number; // 0-10
  createdAt: string;
}
