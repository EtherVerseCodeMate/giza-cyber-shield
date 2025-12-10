import Navbar from '@/components/layout/Navbar';
import KhepraAgentDashboard from '@/components/dashboard/KhepraAgentDashboard';

const KhepraAgent = () => {
  return (
    <div className="min-h-screen bg-giza-dark text-white">
      <Navbar />
      
      <main className="container mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">KHEPRA Agent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Symbol-enhanced cryptographic agent management with post-quantum security
          </p>
        </div>
        
        <KhepraAgentDashboard />
      </main>
    </div>
  );
};

export default KhepraAgent;
