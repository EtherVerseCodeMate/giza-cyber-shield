import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgreements } from '@/hooks/useUserAgreements';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasAcceptedAll, loading: agreementsLoading } = useUserAgreements();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !agreementsLoading && user && !hasAcceptedAll) {
      // User is authenticated but hasn't accepted required legal terms
      navigate('/auth');
    }
  }, [user, loading, navigate, hasAcceptedAll, agreementsLoading]);

  if (loading || agreementsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !hasAcceptedAll) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
