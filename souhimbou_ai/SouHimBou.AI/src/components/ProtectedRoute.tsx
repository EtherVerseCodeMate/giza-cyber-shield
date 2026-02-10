import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import TermsAcceptance from './legal/TermsAcceptance';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasAcceptedAll, loading: agreementsLoading, refreshAgreements } = useUserAgreements();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!agreementsLoading) {
      setShowTerms(!hasAcceptedAll);
    }
  }, [hasAcceptedAll, agreementsLoading]);

  if (loading || agreementsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      {children}
      <TermsAcceptance
        open={showTerms}
        onOpenChange={setShowTerms}
        onAccepted={() => {
          refreshAgreements();
          setShowTerms(false);
        }}
      />
    </>
  );
};

export default ProtectedRoute;
