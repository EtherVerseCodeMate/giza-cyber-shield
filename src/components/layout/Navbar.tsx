
import React from 'react';
import { Shield, Bell, Settings, User, ChevronDown, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Navbar: React.FC = () => {
  return (
    <nav className="bg-giza-navy border-b border-border h-16 flex items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Shield className="h-8 w-8 text-giza-teal" />
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-giza-teal">Giza</span>
          <span className="text-giza-light ml-1">Shield</span>
        </h1>
      </div>
      
      <div className="flex-1 px-8">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search alerts, systems, integrations..." 
            className="pl-8 bg-giza-navy border-border focus:border-giza-teal" 
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
        </Button>
        
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2 ml-4">
          <div className="h-8 w-8 rounded-full bg-giza-teal flex items-center justify-center">
            <User className="h-5 w-5 text-giza-navy" />
          </div>
          <span className="text-sm font-medium">Admin</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
