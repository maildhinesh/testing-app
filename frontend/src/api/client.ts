import axios from "axios";
import type {
  BulkUploadResult,
  ComprehensionOut,
  QuestionIn,
  QuestionOut,
  RegistrationOut,
  ScoreBreakdown,
  SessionInfo,
  SessionProgress,
  SessionResponses,
  SessionState,
  StoryPromptOut,
  TestOut,
  TestStats,
} from "../types";

const ADMIN_TOKEN_KEY = "tamil_admin_token";
const ADMIN_NAME_KEY = "tamil_admin_name";

export const adminToken = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  name: () => localStorage.getItem(ADMIN_NAME_KEY),
  set: (token: string, name: string) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_NAME_KEY, name);
  },
  clear: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_NAME_KEY);
  },
};

// In dev (and on hosts that rewrite /api -> backend) the relative "/api" works.
// For static hosts that talk to the backend cross-origin, set VITE_API_BASE_URL
// at build time, e.g. https://<your-backend>.onrender.com/api
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api" });

api.interceptors.request.use((config) => {
  const token = adminToken.get();
  if (token && config.url?.startsWith("/admin")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && error.config?.url?.startsWith("/admin")) {
      adminToken.clear();
      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Pull a human-readable message out of a FastAPI error response. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ");
    }
    return err.message;
  }
  return fallback;
}

// --------------------------- Public ---------------------------
export const publicApi = {
  openTests: () => api.get<TestOut[]>("/tests/open").then((r) => r.data),
  register: (payload: {
    test_id: number;
    first_name: string;
    last_name: string;
    nilai: string;
    email: string;
    confirm_email: string;
  }) => api.post("/register", payload).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.get<{ message: string; first_name: string }>("/verify-email", { params: { token } }).then((r) => r.data),
};

// --------------------------- Admin auth ---------------------------
export const adminAuth = {
  login: (email: string, password: string) =>
    api
      .post<{ access_token: string; token_type: string; name: string }>("/admin/login", { email, password })
      .then((r) => r.data),
  me: () => api.get<{ id: number; email: string; name: string }>("/admin/me").then((r) => r.data),
};

// --------------------------- Admin tests ---------------------------
export const adminTests = {
  list: () => api.get<TestStats[]>("/admin/tests").then((r) => r.data),
  get: (id: number) => api.get<TestStats>(`/admin/tests/${id}`).then((r) => r.data),
  create: (payload: { name: string; description?: string | null; scheduled_date?: string | null }) =>
    api.post<TestOut>("/admin/tests", payload).then((r) => r.data),
  update: (id: number, payload: Partial<{ name: string; description: string | null; scheduled_date: string | null; status: string }>) =>
    api.patch<TestOut>(`/admin/tests/${id}`, payload).then((r) => r.data),
  release: (id: number) => api.post<TestStats>(`/admin/tests/${id}/release`).then((r) => r.data),
  releaseScores: (id: number) => api.post<TestStats>(`/admin/tests/${id}/release-scores`).then((r) => r.data),
};

// --------------------------- Admin registrations ---------------------------
export const adminRegistrations = {
  list: (testId: number, regStatus?: string) =>
    api
      .get<RegistrationOut[]>(`/admin/tests/${testId}/registrations`, {
        params: regStatus ? { reg_status: regStatus } : {},
      })
      .then((r) => r.data),
  manualRegister: (testId: number, payload: { first_name: string; last_name: string; nilai: string; email: string }) =>
    api.post<RegistrationOut>(`/admin/tests/${testId}/registrations`, payload).then((r) => r.data),
  approve: (regId: number) => api.post<RegistrationOut>(`/admin/registrations/${regId}/approve`).then((r) => r.data),
  reject: (regId: number) => api.post<RegistrationOut>(`/admin/registrations/${regId}/reject`).then((r) => r.data),
};

// --------------------------- Admin questions ---------------------------
export const adminQuestions = {
  list: (testId: number, category?: number) =>
    api
      .get<QuestionOut[]>(`/admin/tests/${testId}/questions`, {
        params: category ? { category } : {},
      })
      .then((r) => r.data),
  create: (testId: number, payload: QuestionIn) =>
    api.post<QuestionOut>(`/admin/tests/${testId}/questions`, payload).then((r) => r.data),
  update: (testId: number, questionId: number, payload: QuestionIn) =>
    api.put<QuestionOut>(`/admin/tests/${testId}/questions/${questionId}`, payload).then((r) => r.data),
  remove: (testId: number, questionId: number) =>
    api.delete(`/admin/tests/${testId}/questions/${questionId}`).then((r) => r.data),
  bulkUpload: (testId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<BulkUploadResult>(`/admin/tests/${testId}/questions/bulk`, form)
      .then((r) => r.data);
  },
  // Comprehension (Category 4)
  listComprehensions: (testId: number) =>
    api.get<ComprehensionOut[]>(`/admin/tests/${testId}/comprehensions`).then((r) => r.data),
  createComprehension: (testId: number, payload: unknown) =>
    api.post<ComprehensionOut>(`/admin/tests/${testId}/comprehensions`, payload).then((r) => r.data),
  updateComprehension: (testId: number, compId: number, payload: unknown) =>
    api.put<ComprehensionOut>(`/admin/tests/${testId}/comprehensions/${compId}`, payload).then((r) => r.data),
  removeComprehension: (testId: number, compId: number) =>
    api.delete(`/admin/tests/${testId}/comprehensions/${compId}`).then((r) => r.data),
  // Story prompt (Category 5)
  getStoryPrompt: (testId: number) =>
    api.get<StoryPromptOut | null>(`/admin/tests/${testId}/story-prompt`).then((r) => r.data),
  setStoryPrompt: (testId: number, prompt_text: string) =>
    api.put<StoryPromptOut>(`/admin/tests/${testId}/story-prompt`, { prompt_text }).then((r) => r.data),
};

// --------------------------- Admin progress ---------------------------
export const adminProgress = {
  list: (testId: number) => api.get<SessionProgress[]>(`/admin/tests/${testId}/progress`).then((r) => r.data),
  responses: (sessionId: number) =>
    api.get<SessionResponses>(`/admin/sessions/${sessionId}/responses`).then((r) => r.data),
  manualScore: (sessionId: number, category: number, score: number) =>
    api.post<SessionProgress>(`/admin/sessions/${sessionId}/manual-score`, { category, score }).then((r) => r.data),
};

// --------------------------- Student session ---------------------------
export const session = {
  info: (token: string) => api.get<SessionInfo>("/session/info", { params: { token } }).then((r) => r.data),
  start: (token: string) => api.post<SessionState>("/session/start", null, { params: { token } }).then((r) => r.data),
  state: (token: string) => api.get<SessionState>("/session/state", { params: { token } }).then((r) => r.data),
  answer: (token: string, assignment_id: number, selected_option: string | null) =>
    api.post<SessionState>("/session/answer", { assignment_id, selected_option }, { params: { token } }).then((r) => r.data),
  finishComprehension: (token: string) =>
    api.post<SessionState>("/session/finish-comprehension", null, { params: { token } }).then((r) => r.data),
  flag: (token: string) =>
    api.post<{ focus_loss_count: number }>("/session/flag", null, { params: { token } }).then((r) => r.data),
  story: (token: string, prompt_id: number, answer_text: string, final: boolean) =>
    api.post<SessionState>("/session/story", { prompt_id, answer_text, final }, { params: { token } }).then((r) => r.data),
  score: (token: string) => api.get<ScoreBreakdown>("/session/score", { params: { token } }).then((r) => r.data),
};

export default api;
