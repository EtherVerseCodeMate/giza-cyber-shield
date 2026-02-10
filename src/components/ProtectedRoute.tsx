import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import TermsAcceptance from '@/components/legal/TermsAcceptance';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const [showTerms, setShowTerms] = useState(!hasAcceptedAll);

useEffect(() => {
  setShowTerms(!hasAcceptedAll);
}, [hasAcceptedAll]);

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
