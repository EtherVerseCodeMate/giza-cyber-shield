import { Card } from '@/components/ui/card';
import { useKhepraAgent } from '@/hooks/useKhepraAgent';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export const AGIStatusCard = () => {
    const [status, setStatus] = useState({ status: 'Connecting...', objective: '...' });

    // Simple polling for AGI state
    useEffect(() => {
        const fetchState = async () => {
            try {
                const res = await fetch('/api/agent/agi/state');
                const data = await res.json();
                setStatus(data);
            } catch (e) {
                // ignore
            }
        };
        fetchState();
        const interval = setInterval(fetchState, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="bg-giza-void border-giza-cyan/30 overflow-hidden relative group h-48">
            {/* Background Image */}
            <div className="absolute inset-0">
                <img
                    src="/assets/souhimbou_poster.png"
                    alt="SouHimBou"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-105 transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-giza-void via-giza-void/50 to-transparent" />
            </div>

            <div className="relative z-10 p-4 h-full flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-orbitron font-bold text-lg text-giza-cyan text-glow-cyan">SOUHIMBOU AGI</h3>
                </div>
                <div className="font-mono text-xs text-giza-cyan/80 mb-2">
                    STATUS: <span className="text-white animate-pulse">{status.status.toUpperCase()}</span>
                </div>
                <p className="font-rajdhani text-sm text-gray-300 leading-tight border-l-2 border-giza-cyan pl-2">
                    "{status.objective}"
                </p>

                {/* Visualizer Effect */}
                <div className="absolute top-4 right-4 flex gap-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-3 bg-giza-cyan rounded-full animate-bounce`} style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                </div>
            </div>
        </Card>
    );
};
