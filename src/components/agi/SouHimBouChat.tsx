import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Minimize2, Maximize2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


interface Message {
    role: 'user' | 'agi';
    content: string;
    time: Date;
}

export const SouHimBouChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'agi',
            content: 'I am SouHimBou, the Guardian Architect. The Khepra Lattice is secure. How may I assist you?',
            time: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = { role: 'user', content: inputValue, time: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            // Call the local AGI Agent
            // Note: We use the proxy path /api/agent via callEndpoint logic, 
            // but callEndpoint is internal to the hook. We can just use fetch directly with the proxy.
            const res = await fetch('/api/agent/agi/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content })
            });

            const data = await res.json();

            const agiMsg: Message = {
                role: 'agi',
                content: data.response || "I am calibrating...",
                time: new Date()
            };
            setMessages(prev => [...prev, agiMsg]);
        } catch (error) {
            console.error("AGI Chat Error:", error);
            const errorMsg: Message = { role: 'agi', content: "Connection to Cortex interrupted.", time: new Date() };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-giza-cyan/20 hover:bg-giza-cyan/40 border border-giza-cyan shadow-[0_0_15px_theme(colors.giza.cyan)] transition-all duration-300 z-50 p-0 overflow-hidden"
            >
                <img
                    src="/assets/souhimbou_avatar.png"
                    alt="SouHimBou"
                    className="w-full h-full object-cover animate-pulse-slow"
                />
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-6 right-6 w-96 h-[500px] bg-giza-void/95 border-giza-cyan/30 flex flex-col shadow-[0_0_30px_theme(colors.giza.cyan)] z-50 backdrop-blur-md animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="p-4 border-b border-giza-cyan/20 bg-giza-gunmetal/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-giza-cyan shadow-[0_0_10px_theme(colors.giza.cyan)]">
                        <AvatarImage src="/assets/souhimbou_avatar.png" className="object-cover" />
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-orbitron text-giza-cyan font-bold tracking-wide">SOUHIMBOU</h3>
                        <p className="text-[10px] text-giza-cyan/70 font-mono flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            ONLINE // GUARDIAN MODE
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-giza-cyan/50 hover:text-giza-cyan" onClick={() => setIsOpen(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4 space-y-4">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {msg.role === 'agi' ? (
                            <Avatar className="h-8 w-8 mt-1 border border-giza-cyan/30">
                                <AvatarImage src="/assets/souhimbou_avatar.png" className="object-cover" />
                                <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                        ) : (
                            <Avatar className="h-8 w-8 mt-1 bg-primary/20">
                                <User className="h-4 w-4 text-primary" />
                            </Avatar>
                        )}

                        <div className={`
                p-3 rounded-lg max-w-[80%] text-sm font-rajdhani
                ${msg.role === 'user'
                                ? 'bg-primary/20 text-foreground border border-primary/20'
                                : 'bg-giza-cyan/10 text-giza-cyan border border-giza-cyan/20'}
            `}>
                            {msg.content}
                            <div className="text-[9px] opacity-50 mt-1 font-mono text-right">
                                {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex gap-3 mb-4">
                        <Avatar className="h-8 w-8 mt-1 border border-giza-cyan/30">
                            <AvatarImage src="/assets/souhimbou_avatar.png" className="object-cover" />
                        </Avatar>
                        <div className="bg-giza-cyan/5 p-3 rounded-lg border border-giza-cyan/10">
                            <Loader2 className="h-4 w-4 text-giza-cyan animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 bg-giza-gunmetal/30 border-t border-giza-cyan/20">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Interrogate the Guardian..."
                        className="bg-black/40 border-giza-cyan/30 text-giza-cyan placeholder:text-giza-cyan/30 font-mono text-xs focus-visible:ring-giza-cyan"
                    />
                    <Button type="submit" size="icon" className="bg-giza-cyan/20 hover:bg-giza-cyan/40 text-giza-cyan border border-giza-cyan/50">
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </Card>
    );
};
