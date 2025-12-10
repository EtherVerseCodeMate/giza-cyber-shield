import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldCheck, Menu, X, LayoutDashboard, DatabaseZap, KeyRound } from 'lucide-react';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const isActive = (path: string) => {
    return router.pathname === path;
  };

  return (
    <nav className="bg-giza-navy border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-giza-teal" />
              <span className="text-xl font-bold">Giza</span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/')
                    ? 'bg-giza-teal text-giza-navy'
                    : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </div>
              </Link>

              <Link
                href="/khepra-agent"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/khepra-agent')
                    ? 'bg-giza-teal text-giza-navy'
                    : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  <span>KHEPRA Agent</span>
                </div>
              </Link>

              <Link
                href="/architecture"
                className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/architecture')
                    ? 'bg-giza-teal text-giza-navy'
                    : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <DatabaseZap className="h-4 w-4" />
                  <span>Architecture</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="md:hidden">
            <button
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
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
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              href="/"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${isActive('/')
                  ? 'bg-giza-teal text-giza-navy'
                  : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </div>
            </Link>

            <Link
              href="/khepra-agent"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${isActive('/khepra-agent')
                  ? 'bg-giza-teal text-giza-navy'
                  : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                <span>KHEPRA Agent</span>
              </div>
            </Link>

            <Link
              href="/architecture"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${isActive('/architecture')
                  ? 'bg-giza-teal text-giza-navy'
                  : 'text-gray-300 hover:bg-giza-dark hover:text-white'
                }`}
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <DatabaseZap className="h-4 w-4" />
                <span>Architecture</span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
