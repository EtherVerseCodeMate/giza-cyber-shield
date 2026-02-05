import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to auth page with reset mode
    navigate('/auth?mode=reset');
  }, [navigate]);

  return null;
};

export default ResetPassword;
