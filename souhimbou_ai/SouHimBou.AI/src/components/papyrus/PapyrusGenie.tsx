import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    X,
    Send,
    Sparkles,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';

export const PapyrusGenie = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Array<{ role: 'papyrus' | 'user', content: string, id: string }>>([]);
    const [inputValue, setInputValue] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        // Auto-trigger welcome after 2 seconds if not seen
        const timer = setTimeout(() => {
            if (messages.length === 0) {
                setMessages([{
                    role: 'papyrus',
                    id: 'welcome',
                    content: `Greetings, ${user?.email?.split('@')[0]}. I am Papyrus, your AI guide through the Trust Constellation. 
          
I see you've passed the initial perimeter. Shall we begin weaving your defense lattice? I can help you connect your first data source or configure your STIG profile.`
                }]);
                setIsOpen(true);
            }
        }, 2500);
        return () => clearTimeout(timer);
    }, [user, messages.length]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        const userMsgId = `user-${Date.now()}`;
        setMessages(prev => [...prev, { role: 'user', content: inputValue, id: userMsgId }]);

        // Simple response logic for demo
        setTimeout(() => {
            const aiMsgId = `papyrus-${Date.now()}`;
            setMessages(prev => [...prev, {
                role: 'papyrus',
                id: aiMsgId,
                content: `I am processing your request for "${inputValue}". My ancient wisdom suggests we start with the Infrastructure tab to establish a baseline.`
            }]);
        }, 1000);

        setInputValue('');
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60]">
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        onClick={() => setIsOpen(true)}
                        className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-[0_0_30px_rgba(168,85,247,0.5)] flex items-center justify-center text-white border-2 border-white/20 hover:scale-110 transition-transform group"
                    >
                        <Sparkles className="h-8 w-8 group-hover:animate-spin-slow" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
                    </motion.button>
                )}

                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            height: isMinimized ? '80px' : '500px',
                            width: isMinimized ? '300px' : '400px'
                        }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between bg-gradient-to-r from-purple-900/20 to-transparent">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                                    <Brain className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center">
                                        Papyrus Engine
                                        <Badge variant="secondary" className="ml-2 scale-75 bg-purple-500/10 text-purple-400 border-none">AI</Badge>
                                    </h3>
                                    <div className="text-[10px] text-purple-300/60 uppercase tracking-widest font-bold">Lattice Guide</div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setIsMinimized(!isMinimized)} className="text-slate-400 hover:text-white transition-colors">
                                    {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                                </button>
                                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {!isMinimized && (
                            <>
                                {/* Chat Area */}
                                <ScrollArea className="flex-1 p-4">
                                    <div className="space-y-4">
                                        {messages.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                    ? 'bg-purple-600 text-white rounded-tr-none'
                                                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-purple-500/10'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                {/* Quick Actions */}
                                <div className="p-4 py-2 flex flex-wrap gap-2 border-t border-purple-500/10">
                                    <button className="text-[10px] px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-400 hover:bg-purple-500/20 transition-colors">
                                        Connect Data Source
                                    </button>
                                    <button className="text-[10px] px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-400 hover:bg-purple-500/20 transition-colors">
                                        View STIGs
                                    </button>
                                </div>

                                {/* Input */}
                                <div className="p-4 border-t border-purple-500/10 relative">
                                    <Input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        placeholder="Ask Papyrus..."
                                        className="h-10 bg-slate-950 border-purple-500/20 rounded-xl pr-10 text-xs text-white"
                                    />
                                    <button
                                        onClick={handleSend}
                                        className="absolute right-6 top-6 text-purple-500 hover:text-purple-400 transition-colors"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
