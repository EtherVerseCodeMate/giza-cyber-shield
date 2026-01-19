import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, Mail, Lock, ArrowLeft, CheckCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PasswordResetOTPProps {
  onBack: () => void;
  onSuccess: () => void;
}

const PasswordResetOTP = ({ onBack, onSuccess }: PasswordResetOTPProps) => {
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset-otp', {
        body: { email }
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error(error.message || 'Network error occurred');
      }

      if (data?.success) {
        toast({
          title: "Verification Code Sent",
          description: "Check your email for the 6-digit verification code",
          variant: "default"
        });
        setStep('verify');
        setTimeLeft(data.expires_in || 600); // Use server-provided expiry or default to 10 minutes
      } else {
        throw new Error(data?.error || 'Failed to send verification code');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Unable to send verification code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the complete 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-password-reset-otp', {
        body: { 
          email,
          otp,
          newPassword
        }
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error(error.message || 'Network error occurred');
      }

      if (data?.error) {
        toast({
          title: "Password Reset Failed",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in with your new password.",
          variant: "default"
        });
        onSuccess();
      } else {
        throw new Error(data?.error || 'Failed to reset password');
      }
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message || "Unable to reset password",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <Card className="w-full max-w-md card-cyber backdrop-blur-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Secure Password Reset
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a verification code
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Email Address</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input/50 border-border text-foreground placeholder:text-muted-foreground"
                placeholder="Enter your email address"
              />
            </div>

            <Button
              type="submit"
              variant="cyber"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending Code...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Send Verification Code</span>
                </div>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onBack}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md card-cyber backdrop-blur-lg">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <CardTitle className="text-xl text-foreground">
          Verify & Reset Password
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to {email}
        </p>
        {timeLeft > 0 && (
          <div className="flex items-center justify-center space-x-2 text-sm text-primary">
            <Clock className="h-4 w-4" />
            <span>Code expires in {formatTime(timeLeft)}</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleVerifyAndReset} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground text-center block">
              Verification Code
            </Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-foreground flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <span>New Password</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="bg-input/50 border-border text-foreground placeholder:text-muted-foreground pr-10"
                placeholder="Enter new password (min 8 characters)"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <span>Confirm Password</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-input/50 border-border text-foreground placeholder:text-muted-foreground pr-10"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="cyber"
            className="w-full"
            disabled={loading || timeLeft === 0}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Resetting Password...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Lock className="h-4 w-4" />
                <span>Reset Password</span>
              </div>
            )}
          </Button>

          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep('email')}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Email
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onBack}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PasswordResetOTP;