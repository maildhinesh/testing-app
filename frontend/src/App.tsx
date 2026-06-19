import { Navigate, Route, Routes } from "react-router-dom";
import { adminToken } from "./api/client";

import HomePage from "./pages/public/HomePage";
import RegisterPage from "./pages/public/RegisterPage";
import VerifyEmailPage from "./pages/public/VerifyEmailPage";
import TakeTestPage from "./pages/test/TakeTestPage";

import AdminLogin from "./pages/admin/AdminLogin";
import Dashboard from "./pages/admin/Dashboard";
import TestDetail from "./pages/admin/TestDetail";

function RequireAdmin({ children }: { children: JSX.Element }) {
  return adminToken.get() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/:testId" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Student test taking (magic link) */}
      <Route path="/take-test" element={<TakeTestPage />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Dashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/tests/:testId"
        element={
          <RequireAdmin>
            <TestDetail />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
