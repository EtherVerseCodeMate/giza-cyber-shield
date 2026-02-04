import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Fingerprint,
    Lock,
    Globe,
    Server,
    Zap,
    CheckCircle,
    ArrowRight,
    Building,
    AlertTriangle,
    FileText,
    User,
    Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import { supabase } from '@/integrations/supabase/client';
import { useResourceTracker } from '@/hooks/useResourceTracker';

interface SouHimBouOnboardingProps {
    open: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const STEPS = [
    { id: 'identity', title: 'Bio-Verification', icon: Fingerprint, description: 'Establish your secure identity' },
    { id: 'security', title: 'Compliance Threshold', icon: Shield, description: 'Legal and procedural hardening' },
    { id: 'infrastructure', title: 'Perimeter Definition', icon: Globe, description: 'Define your protected environment' },
    { id: 'baseline', title: 'STIG Synchronization', icon: Activity, description: 'Configure initial compliance baseline' },
    { id: 'deployment', title: 'System Initialization', icon: Zap, description: 'Deploying secure infrastructure' }
];

export const NativeOnboarding = ({ open, onClose, onComplete }: SouHimBouOnboardingProps) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const { acceptAllAgreements } = useUserAgreements();
    const { trackResource } = useResourceTracker();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        fullName: '',
        orgName: '',
        department: '',
        infrastructure: 'cloud-aws',
        stigProfile: 'windows-server-2022',
        mfaEnabled: true,
        agreementsAccepted: false
    });

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleFinalize();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleFinalize = async () => {
        setLoading(true);
        try {
            if (!user) throw new Error('Authentication required');

            // 1. Create Organization
            const { data: organization, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: formData.orgName,
                    slug: formData.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    settings: {
                        infrastructure: formData.infrastructure,
                        stigProfile: formData.stigProfile,
                        department: formData.department,
                        setupCompleted: true,
                        onboardingType: 'native'
                    }
                })
                .select()
                .single();

            if (orgError) throw orgError;

            // 2. Add User as Owner
            await supabase
                .from('user_organizations')
                .insert({
                    user_id: user.id,
                    organization_id: organization.id,
                    role: 'owner'
                });

            // 3. Accept Agreements
            await acceptAllAgreements({
                tosAgree: true,
                privacyAgree: true,
                saasAgree: true,
                betaAgree: true,
                dodCompliance: true,
                liabilityWaiver: true,
                exportControl: true
            });

            // 4. Track Resource Usage
            await trackResource('compute', 1, 'cpu_hours', 'onboarding_initialization', {
                org: formData.orgName,
                infra: formData.infrastructure
            });

            toast({
                title: "Platform Initialized",
                description: "Your secure environment is ready for operations.",
            });

            onComplete();
        } catch (error: any) {
            toast({
                title: "Initialization Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-5xl bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-full max-h-[800px]"
            >
                {/* Left Sidebar - Progress */}
                <div className="w-full md:w-80 bg-muted/30 p-8 border-r border-border/50 flex flex-col">
                    <div className="flex items-center space-x-3 mb-12">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <span className="font-bold text-xl tracking-tight">SouHimBou AI</span>
                    </div>

                    <div className="space-y-8 flex-1">
                        {STEPS.map((step, idx) => (
                            <div key={step.id} className="flex items-center space-x-4">
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${idx < currentStep ? 'bg-primary text-white' :
                                        idx === currentStep ? 'bg-primary/20 border-2 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' :
                                            'bg-muted border border-border text-muted-foreground'}
                `}>
                                    {idx < currentStep ? <CheckCircle className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-sm font-semibold ${idx === currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {step.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground/60 hidden md:block">
                                        {step.description}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8">
                        <div className="flex justify-between text-xs text-muted-foreground mb-2">
                            <span>System Progress</span>
                            <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
                        </div>
                        <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-1" />
                    </div>
                </div>

                {/* Right Content - Interative Steps */}
                <div className="flex-1 p-8 md:p-12 relative flex flex-col">
                    <div className="flex-1">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full"
                            >
                                {currentStep === 0 && (
                                    <div className="space-y-8">
                                        <div>
                                            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Step 01: Identification</Badge>
                                            <h2 className="text-4xl font-bold tracking-tight mb-2">Establish Identity</h2>
                                            <p className="text-muted-foreground text-lg">Define your presence within the KHEPRA-secured perimeter.</p>
                                        </div>

                                        <div className="grid gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                                                <Input
                                                    id="fullName"
                                                    placeholder="Dr. Julian Vane"
                                                    className="h-12 bg-muted/20 border-border/50 focus:ring-primary"
                                                    value={formData.fullName}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="orgName" className="text-sm font-medium">Organization</Label>
                                                <Input
                                                    id="orgName"
                                                    placeholder="Cyber Defence Command"
                                                    className="h-12 bg-muted/20 border-border/50"
                                                    value={formData.orgName}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start space-x-3">
                                            <Activity className="h-5 w-5 text-primary mt-0.5" />
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Data provided here will be signed with a hardware-bound key during attestation. Ensuring non-repudiation across the latticed C2 network.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 1 && (
                                    <div className="space-y-8">
                                        <div>
                                            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Step 02: Hardening</Badge>
                                            <h2 className="text-4xl font-bold tracking-tight mb-2">Compliance Threshold</h2>
                                            <p className="text-muted-foreground text-lg">Accepting the protocols that govern our secure ecosystem.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <FileText className="h-5 w-5 text-primary" />
                                                        <span className="font-semibold">KHEPRA Master License (v3.0)</span>
                                                    </div>
                                                    <Badge>Required</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    By proceeding, you agree to the STIG-First compliance mandate, PQC Lattice usage, and automated telemetry beacons for drift detection.
                                                </p>
                                                <div className="flex items-center space-x-2">
                                                    <Switch
                                                        checked={formData.agreementsAccepted}
                                                        onCheckedChange={(val) => setFormData(prev => ({ ...prev, agreementsAccepted: val }))}
                                                    />
                                                    <Label className="text-sm">I accept the secure operating procedures</Label>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Lock className="h-5 w-5 text-primary" />
                                                    <div>
                                                        <span className="font-semibold block">Hardware-Bound MFA</span>
                                                        <span className="text-xs text-muted-foreground">Quantum-resistant second factor</span>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={formData.mfaEnabled}
                                                    onCheckedChange={(val) => setFormData(prev => ({ ...prev, mfaEnabled: val }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-8">
                                        <div>
                                            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Step 03: Perimeter</Badge>
                                            <h2 className="text-4xl font-bold tracking-tight mb-2">Define Perimeter</h2>
                                            <p className="text-muted-foreground text-lg">Where should SouHimBou AI deploy its defensive agents?</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { id: 'cloud-aws', title: 'AWS Cloud', desc: 'Secure GovCloud/Standard pods', icon: Globe },
                                                { id: 'cloud-azure', title: 'Azure', desc: 'Enterprise Sentinel nodes', icon: Shield },
                                                { id: 'on-prem', title: 'On-Premises', desc: 'Local air-gapped protection', icon: Server },
                                                { id: 'hybrid', title: 'Hybrid Mesh', desc: 'Cross-perimeter lattice', icon: Activity }
                                            ].map((infra) => (
                                                <div
                                                    key={infra.id}
                                                    onClick={() => setFormData(prev => ({ ...prev, infrastructure: infra.id }))}
                                                    className={`
                            p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                            ${formData.infrastructure === infra.id ?
                                                            'border-primary bg-primary/5 shadow-lg' :
                                                            'border-border/50 bg-muted/10 hover:border-primary/20'}
                          `}
                                                >
                                                    <infra.icon className={`h-8 w-8 mb-4 ${formData.infrastructure === infra.id ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                                    <h4 className="font-bold">{infra.title}</h4>
                                                    <p className="text-xs text-muted-foreground mt-1">{infra.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {currentStep === 3 && (
                                    <div className="space-y-8">
                                        <div>
                                            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">Step 04: Baseline</Badge>
                                            <h2 className="text-4xl font-bold tracking-tight mb-2">STIG Profile</h2>
                                            <p className="text-muted-foreground text-lg">Select your primary DISA STIG compliance target.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {[
                                                { id: 'windows-server-2022', title: 'Windows Server 2022 v3R1', level: 'CAT I, II, III' },
                                                { id: 'rhel-9', title: 'Red Hat Enterprise Linux 9 v1R2', level: 'CAT I, II' },
                                                { id: 'kubernetes', title: 'Kubernetes Cluster v1.28 v1R4', level: 'CAT I' },
                                                { id: 'cisco-ios', title: 'Cisco IOS-XE v2R1', level: 'CAT I, II' }
                                            ].map((stig) => (
                                                <div
                                                    key={stig.id}
                                                    onClick={() => setFormData(prev => ({ ...prev, stigProfile: stig.id }))}
                                                    className={`
                            p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-between
                            ${formData.stigProfile === stig.id ?
                                                            'border-primary bg-primary/5' :
                                                            'border-border/50 bg-muted/10 hover:border-primary/20'}
                          `}
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div className={`p-2 rounded-lg ${formData.stigProfile === stig.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                            <Shield className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold block">{stig.title}</span>
                                                            <span className="text-xs text-muted-foreground">Complexity: High Requirement</span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px]">{stig.level}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {currentStep === 4 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                                            <div className="relative p-12 bg-card border-2 border-primary/50 rounded-full shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)]">
                                                <Activity className="h-20 w-20 text-primary animate-pulse" />
                                            </div>
                                        </div>

                                        <div>
                                            <h2 className="text-4xl font-bold tracking-tight mb-2">Protocol Initialization</h2>
                                            <p className="text-muted-foreground max-w-md mx-auto">
                                                We are preparing your KHEPRA-hardened workspace. This involves generating unique lattice seeds and establishing the Symbolic Attestation mesh.
                                            </p>
                                        </div>

                                        <div className="w-full max-w-sm space-y-4">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Allocating Lattice Shards...</span>
                                                <span className="font-mono">OK</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Generating Drift Anchor...</span>
                                                <span className="font-mono">PENDING</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex justify-between items-center mt-12 pt-8 border-t border-border/50">
                        <Button
                            variant="ghost"
                            onClick={prevStep}
                            disabled={currentStep === 0 || loading}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Back
                        </Button>

                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="lg"
                                onClick={nextStep}
                                disabled={
                                    loading ||
                                    (currentStep === 0 && (!formData.fullName || !formData.orgName)) ||
                                    (currentStep === 1 && !formData.agreementsAccepted)
                                }
                                className="bg-primary hover:bg-primary-glow px-8 rounded-full shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]"
                            >
                                {loading ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Deploying...</span>
                                    </div>
                                ) : (
                                    <>
                                        <span>{currentStep === STEPS.length - 1 ? 'Activate Platform' : 'Continue'}</span>
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
