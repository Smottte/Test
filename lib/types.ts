export type TableColumn = {
  column: string;
  type: string;
  description: string;
};

export type MockTable = {
  name: string;
  description: string;
  schema: TableColumn[];
  rows: Record<string, unknown>[];
};

export type HuntStep = {
  order: number;
  question: string;
  expectedKql: string;
  acceptedTerms: string[];
  hint: string;
  explanation: string;
};

export type Hunt = {
  slug: string;
  title: string;
  difficulty: string;
  durationSeconds: number;
  xpReward: number;
  dayOffset: number;
  summary: string;
  story: string;
  objective: string;
  objectives: string[];
  finalAnswer: string;
  acceptedAnswers: string[];
  affected: {
    user: string;
    device: string;
    ip: string;
    file: string;
    app: string;
  };
  explanation: string;
  investigationPath: string;
  exampleKql: string[];
  tables: MockTable[];
  steps: HuntStep[];
};

export type StepResult = {
  order: number;
  answer: string;
  score: number;
  maxScore: number;
  matchedTerms: string[];
};

export type HuntAttemptResult = {
  huntSlug: string;
  score: number;
  maxScore: number;
  timeSpentSeconds: number;
  completedAt: string;
  query: string;
  finalAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  stepResults?: StepResult[];
};
