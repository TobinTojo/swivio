import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isSignedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__spinner" aria-hidden />
        <p>Checking sign-in…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  return children;
}
