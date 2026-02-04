import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Send,
    Shield,
    Brain,
    ChevronRight,
    CheckCircle2,
    Zap,
    Building,
    Activity,
    User,
    History,
    Info
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import { useResourceTracker } from '@/hooks/useResourceTracker';
import { supabase } from '@/integrations/supabase/client';
import { AdinkraSymbolDisplay } from '../khepra/AdinkraSymbolDisplay';

interface Message {
    id: string;
    role: 'papyrus' | 'user' | 'system';
    content: string;
    timestamp: Date;
    suggestions?: string[];
    field?: string;
    culturalContext?: string;
}

interface PapyrusOnboardingProps {
    open: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export const PapyrusOnboarding = ({ open, onClose, onComplete }: PapyrusOnboardingProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentField, setCurrentField] = useState<string | null>('fullName');
    const [formData, setFormData] = useState<any>({
        fullName: '',
        orgName: '',
        department: '',
        infrastructure: '',
        complianceTarget: '',
    });
    const [setupStep, setSetupStep] = useState(0);
    const [isFinalizing, setIsFinalizing] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const { acceptAllAgreements } = useUserAgreements();
    const { trackResource } = useResourceTracker();

    useEffect(() => {
        if (open && messages.length === 0) {
            startOnboarding();
        }
    }, [open]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
        const newMsg = {
            ...msg,
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMsg as Message]);
    };

    const startOnboarding = async () => {
        setIsTyping(true);
        await new Promise(r => setTimeout(r, 1000));
        addMessage({
            role: 'papyrus',
            content: `Greetings. I am Papyrus, your AI guide. I embody the ancient wisdom of African mathematical traditions to help you navigate the Trust Constellation. 

Before we initialize your KHEPRA perimeter, I must establish your digital presence. May I start by asking for your full name?`,
            culturalContext: 'Sankofa - We must look to our identity before moving forward.'
        });
        setIsTyping(false);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userVal = inputValue.trim();
        addMessage({ role: 'user', content: userVal });
        setInputValue('');

        processResponse(userVal);
    };

    const processResponse = async (val: string) => {
        setIsTyping(true);
        await new Promise(r => setTimeout(r, 800));

        if (currentField === 'fullName') {
            setFormData(prev => ({ ...prev, fullName: val }));
            setCurrentField('orgName');
            addMessage({
                role: 'papyrus',
                content: `It is an honor to assist you, ${val.split(' ')[0]}. Now, which organization or tribe do you represent in this cyber realm?`,
                field: 'orgName'
            });
        } else if (currentField === 'orgName') {
            setFormData(prev => ({ ...prev, orgName: val }));
            setCurrentField('infrastructure');
            addMessage({
                role: 'papyrus',
                content: `Acknowledged. The ${val} perimeter requires a foundation. Where shall we anchor your defense lattice?`,
                suggestions: ['AWS Cloud', 'On-Premises', 'Hybrid Mesh', 'Azure Gov'],
                field: 'infrastructure'
            });
        } else if (currentField === 'infrastructure') {
            setFormData(prev => ({ ...prev, infrastructure: val }));
            setCurrentField('complianceTarget');
            addMessage({
                role: 'papyrus',
                content: `A wise choice. The ${val} terrain is complex but resilient. What is your primary compliance mandate? This defines the "Eban" (fortress) we will build.`,
                suggestions: ['NIST 800-53', 'CMMC Level 2', 'SOC 2 Type II', 'DOD IL5'],
                field: 'complianceTarget'
            });
        } else if (currentField === 'complianceTarget') {
            setFormData(prev => ({ ...prev, complianceTarget: val }));
            setCurrentField(null);
            addMessage({
                role: 'papyrus',
                content: `Everything is in order. You are aligning with ${val} standards. I am now ready to weave these threads into your secure environment. 

Shall we commence initialization?`,
                suggestions: ['Deactivate perimeter and initialize', 'Let me review first'],
                culturalContext: 'Gye Nyame - Unified intelligence leads to supreme security.'
            });
        } else if (!currentField && (val.toLowerCase().includes('initialize') || val.toLowerCase().includes('activate'))) {
            finalizeOnboarding();
        } else {
            addMessage({
                role: 'papyrus',
                content: "I am ready when you are. Just say 'initialize' to start the process.",
            });
        }

        setIsTyping(false);
    };

    const finalizeOnboarding = async () => {
        setIsFinalizing(true);
        addMessage({
            role: 'system',
            content: 'System Initialization sequence started...',
        });

        try {
            if (!user) throw new Error('Identity not verified');

            // 1. Setup Organization
            const { data: organization, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: formData.orgName,
                    slug: formData.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    settings: {
                        ...formData,
                        onboardingType: 'papyrus_guided',
                        completedAt: new Date().toISOString()
                    }
                })
                .select()
                .single();

            if (orgError) throw orgError;

            // 2. Link User
            await supabase.from('user_organizations').insert({
                user_id: user.id,
                organization_id: organization.id,
                role: 'owner'
            });

            // 3. Accept Terms
            await acceptAllAgreements({
                tosAgree: true,
                privacyAgree: true,
                saasAgree: true,
                betaAgree: true,
                dodCompliance: true,
                liabilityWaiver: true,
                exportControl: true
            });

            await new Promise(r => setTimeout(r, 1500));
            addMessage({
                role: 'papyrus',
                content: `Initialization complete. Your ${formData.orgName} perimeter is now shielded by the KHEPRA Protocol. 

"Dua kontonkyikye na ema yenhu odwumfo" — The twisted tree reveals the carpenter's skill. We have navigated the complexities together.`,
            });

            await new Promise(r => setTimeout(r, 1000));
            toast({
                title: "Platform Ready",
                description: "Welcome to the future of sovereign defense.",
            });
            onComplete();

        } catch (error: any) {
            addMessage({
                role: 'papyrus',
                content: `I encountered a disruption: ${error.message}. Please, let us try once more.`,
            });
        } finally {
            setIsFinalizing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-4xl h-[80vh] bg-slate-900/90 border border-purple-500/30 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col md:flex-row"
            >
                {/* Sidebar - Visual Elements */}
                <div className="w-full md:w-1/3 bg-gradient-to-b from-purple-900/20 to-slate-900 p-8 border-r border-purple-500/10 flex flex-col items-center justify-between">
                    <div className="text-center space-y-4">
                        <div className="w-24 h-24 mx-auto relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-2xl animate-pulse rounded-full" />
                            <AdinkraSymbolDisplay
                                symbolName="Sankofa"
                                size="large"
                                showMatrix={true}
                                className="relative z-10"
                            />
                        </div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Papyrus Engine
                        </h2>
                        <p className="text-sm text-slate-400">
                            AI-Powered Sovereign Onboarding
                        </p>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="p-4 bg-purple-950/30 border border-purple-500/20 rounded-2xl flex items-center space-x-3">
                            <Shield className="h-5 w-5 text-purple-400" />
                            <div className="text-xs">
                                <div className="text-purple-300 font-semibold uppercase tracking-wider">Security Posture</div>
                                <div className="text-slate-400">Initializing Lattice {currentField ? '...' : 'READY'}</div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-center space-x-3 opacity-50">
                            <Brain className="h-5 w-5 text-slate-400" />
                            <div className="text-xs text-slate-400 italic">
                                "Knowledge is like a garden. If it is not cultivated, it cannot be harvested."
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col p-6 bg-slate-950/50 relative">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto mb-4 space-y-6 pr-2 scrollbar-hide" ref={scrollRef}>
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] space-y-2`}>
                                        <div className={`
                       p-4 rounded-2xl shadow-lg border
                       ${msg.role === 'user'
                                                ? 'bg-purple-600 border-purple-400 text-white rounded-tr-none'
                                                : msg.role === 'system'
                                                    ? 'bg-slate-800/80 border-slate-700 text-purple-300 font-mono text-xs'
                                                    : 'bg-slate-900 border-purple-500/20 text-slate-200 rounded-tl-none'}
                     `}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                                            {msg.culturalContext && (
                                                <div className="mt-3 pt-3 border-t border-purple-500/10 flex items-start space-x-2">
                                                    <History className="h-3 w-3 text-purple-400 mt-0.5 flex-shrink-0" />
                                                    <span className="text-[10px] text-purple-400 italic font-medium">
                                                        {msg.culturalContext}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Suggestion Chips */}
                                        {msg.role === 'papyrus' && msg.suggestions && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {msg.suggestions.map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => {
                                                            setInputValue(s);
                                                            // Small delay for feel
                                                            setTimeout(handleSend, 100);
                                                        }}
                                                        className="px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/5 text-xs text-purple-300 hover:bg-purple-500/10 hover:border-purple-400 transition-all font-medium"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-slate-900 border border-purple-500/20 p-4 rounded-2xl rounded-tl-none flex space-x-2">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.1s]" />
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Input Box */}
                    <div className="relative">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Speak with Papyrus..."
                            disabled={isFinalizing}
                            className="h-14 bg-slate-900 border-purple-500/30 rounded-2xl pr-16 focus-visible:ring-purple-500/50 placeholder:text-slate-600"
                        />
                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isFinalizing}
                            className="absolute right-2 top-2 h-10 w-10 bg-purple-600 hover:bg-purple-500 p-0 rounded-xl"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="text-[10px] text-slate-500 mt-4 text-center">
                        Powered by KHEPRA AI Engine • Version 3.4.0 (Sovereign)
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
