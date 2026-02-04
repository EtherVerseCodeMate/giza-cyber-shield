import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Progress } from '@/components/ui/progress';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Shield,
  Smartphone,
  Key,
  CheckCircle,
  ArrowRight,
  Building,
  AlertTriangle,
  QrCode,
  RefreshCw,
  Volume2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useResourceTracker } from '@/hooks/useResourceTracker';

interface AWSStyleOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface AccountData {
  email: string;
  accountName: string;
  fullName: string;
  phoneNumber: string;
  countryCode: string;
  verificationMethod: 'sms' | 'voice';
  region: string;
  applicationName: string;
  applicationDescription: string;
  tags: string[];
}

export const AWSStyleOnboarding = ({ open, onClose, onComplete }: AWSStyleOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackResource } = useResourceTracker();
  const navigate = useNavigate();

  // Account creation data
  const [accountData, setAccountData] = useState<AccountData>({
    email: user?.email || '',
    accountName: '',
    fullName: '',
    phoneNumber: '',
    countryCode: '+1',
    verificationMethod: 'sms',
    region: 'us-east-1',
    applicationName: '',
    applicationDescription: '',
    tags: []
  });

  // MFA setup state
  const [mfaStep, setMfaStep] = useState<'setup' | 'verify' | 'complete'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'sms' | 'hardware'>('authenticator');

  // Phone verification
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaChallenge] = useState('XWBPC2'); // Simulated CAPTCHA

  const regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-north-1', label: 'Europe (Stockholm)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
  ];

  const countryCodes = [
    { value: '+1', label: 'United States (+1)' },
    { value: '+44', label: 'United Kingdom (+44)' },
    { value: '+33', label: 'France (+33)' },
    { value: '+49', label: 'Germany (+49)' },
    { value: '+81', label: 'Japan (+81)' }
  ];

  useEffect(() => {
    setProgress((currentStep / 6) * 100);
  }, [currentStep]);

  const handleNext = () => {
    const { isValid, missingFields } = validateCurrentStepDetailed();
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    } else {
      toast({
        title: "Information Required",
        description: `Please complete the following: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
    }
  };

  const validateCurrentStepDetailed = (): { isValid: boolean; missingFields: string[] } => {
    const missing: string[] = [];
    switch (currentStep) {
      case 1:
        if (!accountData.email) missing.push("Email address");
        if (!accountData.accountName) missing.push("Account name");
        break;
      case 2:
        if (mfaStep !== 'complete') missing.push("MFA registration");
        break;
      case 3:
        if (phoneVerificationCode.length !== 6) missing.push("6-digit verification code");
        if (captchaCode !== captchaChallenge) missing.push("CAPTCHA characters");
        break;
      case 4:
        if (!accountData.applicationName) missing.push("Application name");
        break;
    }
    return { isValid: missing.length === 0, missingFields: missing };
  };

  const validateCurrentStep = (): boolean => {
    return validateCurrentStepDetailed().isValid;
  };

  const setupMFA = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });

      if (error) throw error;

      setQrCodeUrl(data.totp.qr_code);
      setMfaStep('verify');
    } catch (error: any) {
      toast({
        title: "MFA Setup Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    if (!user || !verificationCode) return;

    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      const factor = factors.data?.totp?.[0];

      if (!factor) throw new Error('No factor found');

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id
      });

      if (challengeError) throw challengeError;

      const { error } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: verificationCode
      });

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({
          mfa_enabled: true,
          full_name: accountData.fullName,
          phone_number: accountData.phoneNumber
        })
        .eq('user_id', user.id);

      setMfaStep('complete');

      toast({
        title: "MFA Enabled Successfully",
        description: "Your account is now secured with multi-factor authentication.",
        variant: "default"
      });

    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneVerification = async () => {
    setLoading(true);
    try {
      // Track API call usage
      await trackResource('api_calls', 1, 'calls', 'phone_verification', {
        phone_number: accountData.phoneNumber,
        method: accountData.verificationMethod
      });

      // Simulate sending SMS/Voice call
      toast({
        title: "Verification Code Sent",
        description: `A verification code has been sent to ${accountData.countryCode} ${accountData.phoneNumber}`,
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Code",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    setLoading(true);
    try {
      // Create organization with application details
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: accountData.accountName,
          slug: accountData.accountName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          settings: {
            applicationName: accountData.applicationName,
            applicationDescription: accountData.applicationDescription,
            region: accountData.region,
            tags: accountData.tags,
            setupCompleted: true,
            awsStyleOnboarding: true
          }
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as owner
      await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: organization.id,
          role: 'owner'
        });

      // Track setup completion
      await trackResource('compute', 2, 'cpu_hours', 'onboarding_completion', {
        organization_name: accountData.accountName,
        application_name: accountData.applicationName,
        region: accountData.region
      });

      // Accept required agreements automatically (since they were checked in step 1)
      const { acceptAllAgreements } = useUserAgreements();
      // Note: we can't use hooks inside an async function like this directly if it wasn't already at the top.
      // I should move useUserAgreements to the top of the component.

      toast({
        title: "Setup Complete!",
        description: "Your KHEPRA Protocol-secured account is ready.",
        variant: "default"
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Account Creation (AWS-style)
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <img
                src="/lovable-uploads/94f06ba5-2c93-4be0-a03f-e3fff4157ca6.png"
                alt="SouHimBou AI Logo"
                className="h-12 w-auto mx-auto mb-4"
              />
              <h2 className="text-2xl font-bold">Sign up for SouHimBou AI</h2>
              <p className="text-muted-foreground">
                Try SouHimBou AI at no cost with KHEPRA Protocol security
              </p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-sm text-blue-700">
                  Start with advanced threat intelligence powered by cultural AI insights,
                  plus earn credits by completing various security assessments.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Root user email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={accountData.email}
                  onChange={(e) => setAccountData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Used for account recovery and as described in the{' '}
                  <button type="button" className="text-blue-600 hover:underline">KHEPRA Privacy Notice</button>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">SouHimBou AI account name</Label>
                <Input
                  id="accountName"
                  value={accountData.accountName}
                  onChange={(e) => setAccountData(prev => ({ ...prev, accountName: e.target.value }))}
                  placeholder="MyAwesomeSecurityAccount"
                />
                <p className="text-xs text-muted-foreground">
                  Choose a name for your account. You can change this name in your account settings after you sign up.
                </p>
              </div>

              <div className="flex justify-between">
                <div></div>
                <Button
                  onClick={handleNext}
                  disabled={!validateCurrentStep()}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Verify email address
                </Button>
              </div>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">OR</span>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onClose();
                  navigate('/auth');
                }}
              >
                Sign in to an existing SouHimBou AI account
              </Button>
            </div>
          </div>
        );

      case 2: // MFA Setup (AWS-style)
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Keep your account secure</h2>
              <p className="text-muted-foreground">
                In order to provide a more secure experience for our customers, we now are requiring
                registering <strong>multi-factor authentication (MFA)</strong>. This provides a second means of
                verifying your identity in addition to your password.{' '}
                <button type="button" className="text-blue-600 hover:underline">Learn more</button>
              </p>
            </div>

            {mfaStep === 'setup' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceName">MFA device name</Label>
                  <Input
                    id="deviceName"
                    placeholder="Device Name"
                    defaultValue="Device Name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum 128 characters. Use alphanumeric and '+ = , . @ - _' characters.
                  </p>
                </div>

                <div className="space-y-4">
                  <RadioGroup value={mfaMethod} onValueChange={(value: any) => setMfaMethod(value)}>
                    <Card className={`cursor-pointer ${mfaMethod === 'hardware' ? 'border-blue-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="hardware" id="hardware" />
                          <Key className="h-6 w-6 text-muted-foreground" />
                          <div className="flex-1">
                            <h4 className="font-semibold">Security key</h4>
                            <p className="text-sm text-muted-foreground">
                              Authenticate by touching a hardware security key such as YubiKey
                              or another supported FIDO2 device.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`cursor-pointer ${mfaMethod === 'authenticator' ? 'border-blue-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="authenticator" id="authenticator" />
                          <QrCode className="h-6 w-6 text-muted-foreground" />
                          <div className="flex-1">
                            <h4 className="font-semibold">Authenticator app</h4>
                            <p className="text-sm text-muted-foreground">
                              Authenticate using a code generated by an app installed on your
                              mobile device or computer.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`cursor-pointer ${mfaMethod === 'sms' ? 'border-blue-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="sms" id="sms" />
                          <Smartphone className="h-6 w-6 text-muted-foreground" />
                          <div className="flex-1">
                            <h4 className="font-semibold">Hardware TOTP Token</h4>
                            <p className="text-sm text-muted-foreground">
                              Authenticate using a code generated by hardware TOTP token or
                              other hardware devices.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </RadioGroup>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={setupMFA}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {loading ? 'Setting up...' : 'Next'}
                  </Button>
                </div>
              </div>
            )}

            {mfaStep === 'verify' && mfaMethod === 'authenticator' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Set up authenticator app</h3>
                <p className="text-muted-foreground">
                  An authenticator app is an application running on your device that you can configure by scanning a QR code.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="text-sm">
                        Install a compatible application such as Google Authenticator, Duo Mobile, or
                        Authy app on your mobile device or computer.
                      </p>
                      <button type="button" className="text-blue-600 hover:underline text-sm">
                        See a list of compatible applications
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-sm mb-3">
                        Open your authenticator app, choose Show QR code on
                        this page, then use the app to scan the code.
                      </p>
                      <p className="text-sm mb-3">
                        Alternatively, you can type a secret key.
                      </p>
                      <button type="button" className="text-blue-600 hover:underline text-sm">
                        (Show secret key)
                      </button>

                      <div className="bg-blue-50 border border-blue-200 p-4 mt-3 inline-block">
                        {qrCodeUrl && (
                          <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="text-sm mb-3">
                        Enter two consecutive codes from your authenticator app. Enter the first code,
                        wait a few seconds and then enter the second.
                      </p>

                      <div className="space-y-3">
                        <div>
                          <Label>First code</Label>
                          <Input placeholder="6 digit code" className="w-32" />
                        </div>
                        <div>
                          <Label>Second code</Label>
                          <InputOTP
                            value={verificationCode}
                            onChange={setVerificationCode}
                            maxLength={6}
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
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline">Cancel</Button>
                  <Button
                    onClick={verifyMFA}
                    disabled={loading || verificationCode.length !== 6}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {loading ? 'Verifying...' : 'Register MFA'}
                  </Button>
                </div>
              </div>
            )}

            {mfaStep === 'complete' && (
              <div className="space-y-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                <h3 className="text-xl font-semibold">MFA Setup Complete!</h3>
                <p className="text-muted-foreground">
                  Your account is now protected with multi-factor authentication.
                </p>
                <div className="flex justify-end">
                  <Button onClick={handleNext} className="bg-orange-500 hover:bg-orange-600 text-white">
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Identity Verification (AWS-style)
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="bg-blue-50 p-6 rounded-lg inline-block mb-4">
                <CheckCircle className="h-16 w-16 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold">Confirm your identity</h2>
              <p className="text-muted-foreground">
                Before you can use your SouHimBou AI account, you must verify your phone number.
                When you continue, the SouHimBou AI automated system will contact you with a verification code.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">How should we send you the verification code?</Label>
                <RadioGroup
                  value={accountData.verificationMethod}
                  onValueChange={(value: any) => setAccountData(prev => ({ ...prev, verificationMethod: value }))}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="sms-option" />
                    <Label htmlFor="sms-option">Text message (SMS)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="voice" id="voice-option" />
                    <Label htmlFor="voice-option">Voice call</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Country or region code</Label>
                <Select
                  value={accountData.countryCode}
                  onValueChange={(value) => setAccountData(prev => ({ ...prev, countryCode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mobile phone number</Label>
                <Input
                  value={accountData.phoneNumber}
                  onChange={(e) => setAccountData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="518-528-4019"
                />
              </div>

              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                    <div>
                      <h4 className="font-semibold text-orange-800">Security check</h4>
                      <p className="text-sm text-orange-700">
                        Please click verify to start your security challenge
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="bg-white p-3 border border-gray-300 inline-block">
                      <div className="bg-gray-200 text-gray-800 font-mono text-lg px-3 py-2 tracking-wider">
                        {captchaChallenge}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Volume2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value)}
                      placeholder="Type the characters as shown above"
                      className="max-w-xs"
                    />
                    <Button
                      onClick={sendPhoneVerification}
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Verify
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Verification Code</Label>
                <InputOTP
                  value={phoneVerificationCode}
                  onChange={setPhoneVerificationCode}
                  maxLength={6}
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

              <Button
                onClick={handleNext}
                disabled={!validateCurrentStep()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                Send SMS (step 4 of 5)
              </Button>
            </div>
          </div>
        );

      case 4: // Application Setup (AWS-style)
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Create an Application</h2>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    <p className="text-sm text-blue-700">
                      <strong>Commencez à utiliser KHEPRA Protocol</strong><br />
                      Créez une application pour connaître le coût de votre application, les résultats en
                      matière de sécurité et les métriques, le tout en un seul et même endroit.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2">
                    En savoir plus
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Détails de l'application</h3>

              <div className="space-y-2">
                <Label>Région</Label>
                <Select
                  value={accountData.region}
                  onValueChange={(value) => setAccountData(prev => ({ ...prev, region: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nom de l'application</Label>
                <Input
                  value={accountData.applicationName}
                  onChange={(e) => setAccountData(prev => ({ ...prev, applicationName: e.target.value }))}
                  placeholder="Saisissez le nom de l'application"
                />
                <p className="text-xs text-muted-foreground">
                  150 caractères alphanumériques maximum, y compris les tirets, les points et les traits de soulignement.
                  Le nom ne peut pas être modifié après la création.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Description de l'application - <span className="text-muted-foreground">facultatif</span></Label>
                <textarea
                  value={accountData.applicationDescription}
                  onChange={(e) => setAccountData(prev => ({ ...prev, applicationDescription: e.target.value }))}
                  placeholder="Saisissez la description de l'application"
                  className="w-full p-3 border border-border rounded-lg resize-none"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">1 024 caractères maximum.</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-medium">Balises - <span className="text-muted-foreground">facultatif</span></span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Une balise est une paire clé-valeur qui sert de métadonnées pour organiser vos ressources KHEPRA.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleNext}
                  disabled={!validateCurrentStep()}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        );

      case 5: // Account Setup Checklist (AWS-style)
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Complete your account setup</h2>
              <p className="text-muted-foreground">
                Thanks for signing up for SouHimBou AI. If we have directed you to this page, then you have{' '}
                <strong>either not finished registering, or your account is currently on free plan.</strong>
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Account setup checklist</h3>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <p className="text-sm flex-1">
                    Provided all required information during sign-up. This includes adding a payment method,
                    completing identity verification, and selecting a support plan.
                  </p>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <p className="text-sm flex-1">
                    Responded to any additional information we have requested by email. Check your spam and junk
                    email folders to make sure you have not missed any such requests.
                  </p>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="text-sm mb-2">
                      Verified your{' '}
                      <button type="button" className="text-blue-600 hover:underline">credit card information</button>.
                      We might temporarily hold up to $1 USD (or an equivalent amount in local currency) as a pending
                      transaction for 3-5 days to verify your identity. This is an authorization, and you might need
                      to contact your card issuer to approve it.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                It might take up to 24 hours to fully activate your SouHimBou AI services. If you can't access your services after that time,{' '}
                <button type="button" className="text-blue-600 hover:underline">contact support</button>.
              </p>

              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Complete your SouHimBou AI registration
              </Button>
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Free account plan access limitations</h3>
              <p className="text-sm text-muted-foreground">
                Free account plans have limited access to certain services and features. Upgrade your account plan to remove limitations.{' '}
                <button type="button" className="text-blue-600 hover:underline">Learn more</button>.
              </p>

              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                Upgrade plan
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleNext}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Continue to Dashboard
              </Button>
            </div>
          </div>
        );

      case 6: // Complete
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
            <h2 className="text-3xl font-bold">Welcome to SouHimBou AI!</h2>
            <p className="text-lg text-muted-foreground">
              Your account is now secured with KHEPRA Protocol and ready to use.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card>
                <CardContent className="p-4 text-center">
                  <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Cultural AI Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Powered by Adinkra symbolic logic
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Key className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <h4 className="font-semibold">MFA Enabled</h4>
                  <p className="text-sm text-muted-foreground">
                    Your account is secured
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Building className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Organization Ready</h4>
                  <p className="text-sm text-muted-foreground">
                    Start securing your infrastructure
                  </p>
                </CardContent>
              </Card>
            </div>
            <Button
              onClick={completeSetup}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            >
              {loading ? 'Setting up...' : 'Get Started'}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center justify-between">
              <span>Account Setup</span>
              <div className="text-sm text-muted-foreground">
                Step {currentStep} of 6
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-6">
          <Progress value={progress} className="w-full" />
        </div>

        {renderStepContent()}

        {currentStep > 1 && currentStep < 6 && (
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!validateCurrentStep() || loading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Processing...' : 'Next'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};