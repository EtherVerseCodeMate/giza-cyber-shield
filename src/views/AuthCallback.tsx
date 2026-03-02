import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // ── 1. PKCE flow (Supabase v2 default) ─────────────────────────────
        // Supabase sends: /auth/callback?code=<code>&type=signup|recovery
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        const type = searchParams.get('type');       // 'signup' | 'recovery' | 'magiclink'
        const errorParam = searchParams.get('error');

        // ── 2. Legacy implicit flow ─────────────────────────────────────────
        // Supabase sends: /auth/callback#access_token=...&refresh_token=...
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');

        // Clear tokens from the URL immediately (security)
        window.history.replaceState({}, document.title, window.location.pathname);

        if (errorParam) {
          throw new Error(`Authentication error: ${errorParam}`);
        }

        if (code) {
          // PKCE — exchange the one-time code for a session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          toast({
            title: type === 'recovery' ? 'Ready to reset your password' : 'Email verified',
            description: type === 'recovery'
              ? 'Enter your new password below.'
              : 'Welcome! Your account is confirmed.',
          });

          navigate(type === 'recovery' ? '/auth/reset-password' : '/dashboard');

        } else if (accessToken && refreshToken) {
          // Implicit flow — set the session from URL tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;

          toast({
            title: hashType === 'recovery' ? 'Ready to reset your password' : 'Authentication successful',
            description: hashType === 'recovery'
              ? 'Enter your new password below.'
              : 'Welcome back!',
          });

          navigate(hashType === 'recovery' ? '/auth/reset-password' : '/dashboard');

        } else {
          // No tokens and no code — direct hit or already-consumed link
          throw new Error('No authentication data found. The link may have already been used.');
        }

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        const message = err?.message || 'Authentication processing failed';
        setError(message);

        toast({
          title: 'Authentication Error',
          description: message,
          variant: 'destructive',
        });

        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/auth?error=callback_failed');

      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
        <Card className="w-full max-w-md card-cyber backdrop-blur-lg">
          <CardContent className="flex flex-col items-center space-y-4 p-8">
            <Shield className="h-12 w-12 text-primary animate-pulse" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Securing Authentication
              </h2>
              <p className="text-muted-foreground">
                Processing your authentication securely...
              </p>
            </div>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
        <Card className="w-full max-w-md card-cyber backdrop-blur-lg">
          <CardContent className="flex flex-col items-center space-y-4 p-8">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Authentication Error
              </h2>
              <p className="text-muted-foreground mb-4">
                {error}
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="text-primary hover:text-primary-glow transition-colors"
              >
                Return to Authentication
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
      <Card className="w-full max-w-md card-cyber backdrop-blur-lg">
        <CardContent className="flex flex-col items-center space-y-4 p-8">
          <CheckCircle className="h-12 w-12 text-success" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Authentication Complete
            </h2>
            <p className="text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;