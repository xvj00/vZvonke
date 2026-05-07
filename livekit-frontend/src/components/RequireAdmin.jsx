import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireAdmin = ({ children }) => {
  const { user, token, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    const checkTask = window.setTimeout(async () => {
      if (!token || user?.role === 'admin') {
        setProfileChecked(true);
        return;
      }

      try {
        await refreshProfile();
      } catch {
        // If profile refresh fails, the normal redirect rules below handle it.
      } finally {
        setProfileChecked(true);
      }
    }, 0);

    return () => window.clearTimeout(checkTask);
  }, [refreshProfile, token, user?.role]);

  if (loading || (token && !profileChecked && user?.role !== 'admin')) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <span>Проверяем доступ...</span>
      </div>
    );
  }

  if (!token && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
