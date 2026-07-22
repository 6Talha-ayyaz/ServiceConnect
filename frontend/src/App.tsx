import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/Landing";
import { RegisterPage } from "./pages/Register";
import { VerifyOtpPage } from "./pages/VerifyOtp";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { ProviderOnboardingPage } from "./pages/ProviderOnboarding";
import { AdminVerificationsPage } from "./pages/AdminVerifications";
import { NewRequestPage } from "./pages/NewRequest";
import { MyRequestsPage } from "./pages/MyRequests";
import { RequestDetailPage } from "./pages/RequestDetail";
import { AvailableRequestsPage } from "./pages/AvailableRequests";
import { MyJobsPage } from "./pages/MyJobs";
import { ManageServicesPage } from "./pages/ManageServices";
import { AdminAnalyticsPage } from "./pages/AdminAnalytics";
import { AdminCataloguePage } from "./pages/AdminCatalogue";

function RequireAuth({ children, role }: { children: React.ReactNode; role?: "PROVIDER" | "ADMIN" | "CUSTOMER" }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provider/onboarding"
        element={
          <RequireAuth role="PROVIDER">
            <ProviderOnboardingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/verifications"
        element={
          <RequireAuth role="ADMIN">
            <AdminVerificationsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/requests/new"
        element={
          <RequireAuth role="CUSTOMER">
            <NewRequestPage />
          </RequireAuth>
        }
      />
      <Route
        path="/requests/mine"
        element={
          <RequireAuth role="CUSTOMER">
            <MyRequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/requests/:id"
        element={
          <RequireAuth>
            <RequestDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provider/available"
        element={
          <RequireAuth role="PROVIDER">
            <AvailableRequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provider/jobs"
        element={
          <RequireAuth role="PROVIDER">
            <MyJobsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provider/services"
        element={
          <RequireAuth role="PROVIDER">
            <ManageServicesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <RequireAuth role="ADMIN">
            <AdminAnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/catalogue"
        element={
          <RequireAuth role="ADMIN">
            <AdminCataloguePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SocketProvider>
          <Layout>
            <AppRoutes />
          </Layout>
        </SocketProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
