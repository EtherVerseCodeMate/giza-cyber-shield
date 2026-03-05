import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import TermsAcceptance from '@/components/legal/TermsAcceptance';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasAcceptedAll, loading: agreementsLoading, fetchError, refreshAgreements } = useUserAgreements();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!agreementsLoading) {
      // Only show the terms modal when we successfully fetched AND confirmed the user
      // hasn't accepted yet. If there was a fetch error (network blip, RLS issue, etc.)
      // we fail open — don't block the user with a modal they can't resolve.
      setShowTerms(!fetchError && !hasAcceptedAll);
    }
  }, [hasAcceptedAll, agreementsLoading, fetchError]);

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
