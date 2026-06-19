// Types mirroring the FastAPI Pydantic schemas (backend/app/schemas.py).

export interface TestOut {
  id: number;
  name: string;
  description: string | null;
  scheduled_date: string | null;
  status: string;
  scores_released: boolean;
  created_at: string;
}

export interface TestStats {
  test: TestOut;
  total_registrations: number;
  pending_email: number;
  awaiting_approval: number;
  approved: number;
  rejected: number;
  sessions_started: number;
  sessions_completed: number;
}

export interface RegistrationOut {
  id: number;
  test_id: number;
  first_name: string;
  last_name: string;
  nilai: string;
  email: string;
  status: string;
  created_at: string;
}

export interface QuestionOut {
  id: number;
  test_id: number;
  q_code: string;
  q_category: number;
  q_difficulty: string;
  question_text: string;
  opt_a: string;
  opt_b: string;
  opt_c: string;
  opt_d: string;
  answer: string;
}

export type QuestionIn = Omit<QuestionOut, "id" | "test_id">;

export interface BulkUploadResult {
  inserted: number;
  updated: number;
  errors: string[];
}

export interface ComprehensionQuestionOut {
  id: number;
  q_code: string;
  question_text: string;
  opt_a: string;
  opt_b: string;
  opt_c: string;
  opt_d: string;
  answer: string;
}

export interface ComprehensionOut {
  id: number;
  test_id: number;
  title: string;
  paragraph_text: string;
  difficulty: string;
  questions: ComprehensionQuestionOut[];
}

export interface StoryPromptOut {
  id: number;
  test_id: number;
  prompt_text: string;
}

export interface SessionProgress {
  registration_id: number;
  session_id: number | null;
  first_name: string;
  last_name: string;
  nilai: string;
  email: string;
  status: string;
  current_category: number | null;
  current_difficulty: string | null;
  final_difficulty: string | null;
  auto_score: number;
  cat5_score: number | null;
  cat6_score: number | null;
  total_score: number | null;
  focus_loss_count: number;
  started_at: string | null;
  completed_at: string | null;
}

// --- Student test taking ---
export interface OptionView {
  a: string;
  b: string;
  c: string;
  d: string;
}

export interface QuestionView {
  assignment_id: number;
  category: number;
  position: number;
  total_in_category: number;
  index_in_category: number;
  question_text: string;
  options: OptionView;
  selected_option: string | null;
}

export interface ComprehensionView {
  title: string;
  paragraph_text: string;
  questions: QuestionView[];
}

export interface StoryView {
  prompt_id: number;
  prompt_text: string;
  answer_text: string;
}

export interface SessionState {
  status: string;
  current_category: number;
  seconds_left_total: number | null;
  seconds_left_category: number | null;
  question: QuestionView | null;
  comprehension: ComprehensionView | null;
  story: StoryView | null;
  message: string | null;
}

export interface SessionInfo {
  first_name: string;
  last_name: string;
  test_name: string;
  test_released: boolean;
  session_status: string;
  scores_released: boolean;
}

export interface ScoreBreakdown {
  released: boolean;
  first_name: string;
  category_scores: Record<string, number>;
  cat5_score: number | null;
  cat6_score: number | null;
  auto_total: number;
  grand_total: number | null;
  final_difficulty: string | null;
}
