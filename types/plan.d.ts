/**
 * Shared data shapes for the planning API. Server and browser code reference
 * these from JSDoc (`import('../types/plan.js').Plan`), and `npm run typecheck`
 * checks every module against them. Type-only: nothing here ships at runtime.
 */

export type Source = 'gemini' | 'fallback';
export type Priority = 'high' | 'medium' | 'low';
export type FeasibilityLevel = 'unrealistic' | 'tight' | 'comfortable' | 'generous';

/** The validated, normalised planner form. */
export interface EventInput {
  eventType: string;
  title: string;
  date: string;
  city: string;
  guests: number;
  budget: number;
  currency: string;
  style: string;
  venueType: string;
  dietary: string[];
  language: string;
  notes: string;
}

export interface BudgetLine {
  category: string;
  percent: number;
  amount: number;
}

export interface Feasibility {
  level: FeasibilityLevel;
  perPlate: number;
  ratio: number;
}

export interface Budget {
  total: number;
  currency: string;
  perGuest: number;
  lines: BudgetLine[];
  feasibility: Feasibility;
  warnings: string[];
}

/** A task template, before it is scheduled against an event date. */
export interface MilestoneTemplate {
  id: string;
  title: string;
  /** Days before the event; negative means after it. */
  lead: number;
  category: string;
  priority: Priority;
  /** Suggested by the model rather than the template library. */
  ai?: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  ai: boolean;
  due: string;
  daysBefore: number;
  phase: string;
  /** Behind a typical schedule: the task would normally have started already. */
  urgent: boolean;
}

export interface Timeline {
  daysLeft: number;
  compressed: boolean;
  milestones: Milestone[];
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  bookBy: string;
  lateBooking: boolean;
  questions: string[];
  mapsUrl: string;
}

export interface Theme {
  name: string;
  description: string;
  palette: string[];
  decorIdeas: string[];
  signatureMoment: string;
}

export interface Menu {
  concept: string;
  dishes: string[];
  dietaryNotes: string;
}

export interface BudgetTip {
  category: string;
  tip: string;
  savingPercent: number;
  /** Computed by the server from the engine's amount, never by the model. */
  estimatedSaving: number;
}

export interface Risk {
  risk: string;
  mitigation: string;
}

export interface ScheduleItem {
  time: string;
  activity: string;
}

export interface PlanIdeas {
  headline: string;
  summary: string;
  themes: Theme[];
  menu: Menu;
  guestExperience: string[];
  budgetTips: BudgetTip[];
  risks: Risk[];
  daySchedule: ScheduleItem[];
}

/** Ideas as produced by the AI layer, before extra tasks are merged into the timeline. */
export interface DraftIdeas extends PlanIdeas {
  extraTasks: MilestoneTemplate[];
}

export interface Plan {
  input: EventInput;
  generatedAt: string;
  source: Source;
  budget: Budget;
  timeline: Timeline;
  vendors: Vendor[];
  ideas: PlanIdeas;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  event: EventInput;
  question: string;
  history: ChatTurn[];
}

export interface ChatReply {
  source: Source;
  answer: string;
  followUps: string[];
}

/** What the browser keeps between visits. */
export interface SavedState {
  plan: Plan | null;
  done: Record<string, boolean>;
  actuals: Record<string, number>;
}

/** One structured-output request to the model. */
export interface GenerateRequest {
  system: string;
  prompt: string;
  schema: object;
  temperature?: number;
  history?: ChatTurn[];
}

/** What the planner service needs from a model client (Gemini, or a fake in tests). */
export interface AiClient {
  model: string;
  generateJson(request: GenerateRequest): Promise<unknown>;
}

/** The parts of a Gemini `generateContent` response this app reads. */
export interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}
