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
        console.log('Processing auth callback...');
        
        // Extract hash parameters (tokens from Supabase)
        const hashParams = new URLSearchParams(location.hash.substring(1));
        
        // Check if we have auth tokens in the hash
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && refreshToken) {
          console.log('Tokens found in URL, processing securely...');
          
          // Call our secure edge function to handle tokens
          const callbackUrl = new URL(window.location.href);
          
          // Convert hash parameters to search parameters for the edge function
          const params = new URLSearchParams();
          hashParams.forEach((value, key) => {
            params.append(key, value);
          });
          
          const { data, error: callbackError } = await supabase.functions.invoke('auth-callback', {
            body: {},
            method: 'GET'
          });
          
          if (callbackError) {
            console.error('Callback processing error:', callbackError);
            setError('Failed to process authentication securely');
            
            toast({
              title: "Authentication Error",
              description: "Failed to process authentication callback securely",
              variant: "destructive"
            });
            
            // Clear the URL immediately for security
            window.history.replaceState({}, document.title, window.location.pathname);
            navigate('/auth?error=callback_failed');
            return;
          }
          
          // Clear the URL hash immediately for security
          window.history.replaceState({}, document.title, window.location.pathname);
          
          console.log('Auth callback processed successfully');
          
          toast({
            title: "Authentication Successful",
            description: "Your authentication has been processed securely",
            variant: "default"
          });
          
          // Redirect based on the response
          const redirectUrl = data?.redirect_url || '/dashboard';
          navigate(redirectUrl);
          
        } else {
          // No tokens found, this might be a direct access or error
          const urlParams = new URLSearchParams(location.search);
          const errorParam = urlParams.get('error');
          
          if (errorParam) {
            setError(`Authentication error: ${errorParam}`);
            toast({
              title: "Authentication Error",
              description: `Authentication failed: ${errorParam}`,
              variant: "destructive"
            });
          } else {
            setError('No authentication data found');
            toast({
              title: "Invalid Access",
              description: "No authentication data found in callback",
              variant: "destructive"
            });
          }
          
          navigate('/auth');
        }
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('Authentication processing failed');
        
        toast({
          title: "Authentication Error",
          description: "Failed to process authentication callback",
          variant: "destructive"
        });
        
        // Clear URL for security
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/auth?error=callback_exception');
        
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [location, navigate, toast]);

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