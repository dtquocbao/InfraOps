import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { getDefaultRoute } from './lib/navigation';
import { DashboardLayout } from './components/DashboardLayout';
import { RoleGuard, IndexPage } from './components/RoleGuard';
import { LoginPage } from './pages/LoginPage';
import { AssistantPage } from './pages/AssistantPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ReviewPage } from './pages/ReviewPage';
import { IotMonitorPage } from './pages/IotMonitorPage';
import { AdminPage } from './pages/AdminPage';
import { ProjectsPage } from './pages/ProjectsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRedirect() {
  const { user } = useAuth();
  if (user) return <Navigate to={getDefaultRoute(user.role)} replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route element={<RoleGuard />}>
          <Route index element={<IndexPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="reviews" element={<ReviewPage />} />
          <Route path="iot" element={<IotMonitorPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
