import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Menu, X, LayoutDashboard, DatabaseZap, KeyRound, Bird } from 'lucide-react';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <nav className="bg-card border-b border-border backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors glow-cyan">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-orbitron font-bold gradient-text-cyan">GIZA</span>
                <span className="text-[10px] font-mono text-muted-foreground -mt-1">CYBER SHIELD</span>
              </div>
            </Link>
          </div>
          
          {/* Canary Status - Desktop */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
            <Bird className="h-4 w-4 text-secondary canary-icon" />
            <span className="text-xs font-mono text-secondary">CANARY</span>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-2">
              <Link 
                to="/" 
                className={`px-4 py-2 rounded-lg text-sm font-rajdhani font-semibold transition-all duration-300 ${
                  isActive('/') 
                    ? 'bg-primary text-primary-foreground glow-cyan' 
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>DASHBOARD</span>
                </div>
              </Link>
              
              <Link 
                to="/khepra-agent" 
                className={`px-4 py-2 rounded-lg text-sm font-rajdhani font-semibold transition-all duration-300 ${
                  isActive('/khepra-agent') 
                    ? 'bg-primary text-primary-foreground glow-cyan' 
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  <span>KHEPRA</span>
                </div>
              </Link>
              
              <Link 
                to="/architecture" 
                className={`px-4 py-2 rounded-lg text-sm font-rajdhani font-semibold transition-all duration-300 ${
                  isActive('/architecture') 
                    ? 'bg-primary text-primary-foreground glow-cyan' 
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DatabaseZap className="h-4 w-4" />
                  <span>ARCHITECTURE</span>
                </div>
              </Link>
            </div>
          </div>
          
          <div className="md:hidden">
            <button
              className="inline-flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 focus:outline-none transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/"
              className={`block px-4 py-3 rounded-lg text-sm font-rajdhani font-semibold transition-all ${
                isActive('/') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>DASHBOARD</span>
              </div>
            </Link>
            
            <Link
              to="/khepra-agent"
              className={`block px-4 py-3 rounded-lg text-sm font-rajdhani font-semibold transition-all ${
                isActive('/khepra-agent') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                <span>KHEPRA AGENT</span>
              </div>
            </Link>
            
            <Link
              to="/architecture"
              className={`block px-4 py-3 rounded-lg text-sm font-rajdhani font-semibold transition-all ${
                isActive('/architecture') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <DatabaseZap className="h-4 w-4" />
                <span>ARCHITECTURE</span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
