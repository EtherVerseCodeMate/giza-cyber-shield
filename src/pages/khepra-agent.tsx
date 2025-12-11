import Navbar from '@/components/layout/Navbar';
import KhepraAgentDashboard from '@/components/dashboard/KhepraAgentDashboard';

const KhepraAgent = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold gradient-text-cyan text-glow-cyan">
            GIZA OVERWATCH
          </h1>
          <p className="text-muted-foreground mt-2 font-rajdhani text-lg">
            Post-Quantum Cryptographic Agent Command Interface
          </p>
        </div>
        
        <KhepraAgentDashboard />
      </main>
    </div>
  );
};

export default KhepraAgent;
