import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Home,
  Shield,
  FileText,
  Bot,
  Crown,
  Zap,
  BarChart3,
  Plug,
  Briefcase,
  Phone,
  Brain,
  Target,
  GitBranch,
  Database,
  Search,
  BookOpen,
  Rocket,
  ClipboardCheck,
  Activity,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  group?: string;
}

const navigationItems: NavigationItem[] = [
  // Core
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: Home, requiresAuth: true, group: 'core' },
  { id: 'asset-scanning', label: 'Asset Scanning', path: '/asset-scanning', icon: Search, requiresAuth: true, group: 'core' },
  { id: 'compliance-reports', label: 'Compliance Reports', path: '/compliance-reports', icon: FileText, requiresAuth: true, group: 'core' },
  { id: 'evidence-collection', label: 'Evidence Collection', path: '/evidence-collection', icon: ClipboardCheck, requiresAuth: true, group: 'core' },
  { id: 'compliance-graph', label: 'Compliance Graph', path: '/compliance-graph', icon: Network, requiresAuth: true, group: 'core' },

  // CMMC / STIG
  { id: 'compliance-autopilot', label: 'CMMC Autopilot', path: '/compliance-autopilot', icon: Zap, requiresAuth: true, group: 'cmmc' },
  { id: 'cmmc-integration', label: 'CMMC Integration', path: '/cmmc-integration', icon: GitBranch, requiresAuth: true, group: 'cmmc' },
  { id: 'enterprise-stig', label: 'Enterprise STIG', path: '/enterprise-stig', icon: Shield, requiresAuth: true, group: 'cmmc' },
  { id: 'stig-codex', label: 'STIG Codex', path: '/stig-codex', icon: BookOpen, requiresAuth: true, group: 'cmmc' },
  { id: 'compliance-automation', label: 'Compliance Automation', path: '/compliance-automation', icon: Bot, requiresAuth: true, group: 'cmmc' },

  // SOC / Agentic
  { id: 'souhimbou', label: 'SouHimBou AI', path: '/souhimbou', icon: Brain, requiresAuth: true, group: 'soc' },
  { id: 'enterprise-agents', label: 'Enterprise Agents', path: '/enterprise-agents', icon: Bot, requiresAuth: true, group: 'soc' },
  { id: 'remediation-engine', label: 'Remediation Engine', path: '/remediation-engine', icon: Target, requiresAuth: true, group: 'soc' },
  { id: 'threat-hunting', label: 'Threat Hunting', path: '/threat-hunting', icon: Activity, requiresAuth: true, group: 'soc' },
  { id: 'intelligence', label: 'Global Intelligence', path: '/intelligence', icon: Database, requiresAuth: true, group: 'soc' },

  // Security & Evidence
  { id: 'security-dashboard', label: 'Security Dashboard', path: '/security-dashboard', icon: Shield, requiresAuth: true, group: 'security' },
  { id: 'enterprise-evidence', label: 'Enterprise Evidence', path: '/enterprise-evidence', icon: ClipboardCheck, requiresAuth: true, group: 'security' },
  { id: 'command-center', label: 'Command Center', path: '/command-center', icon: Crown, requiresAuth: true, group: 'security' },

  // Platform
  { id: 'khepra-protocol', label: 'KHEPRA Protocol', path: '/khepra-protocol', icon: Zap, requiresAuth: true, group: 'platform' },
  { id: 'integrations', label: 'Integrations', path: '/integrations', icon: Plug, requiresAuth: true, group: 'platform' },
  { id: 'deployment', label: 'Deployment', path: '/deployment', icon: Rocket, requiresAuth: true, group: 'platform' },
  { id: 'billing', label: 'Billing', path: '/billing', icon: BarChart3, requiresAuth: true, group: 'platform' },

  // Business & Admin
  { id: 'business-dev', label: 'Business Development', path: '/business-development', icon: Briefcase, requiresAuth: true, group: 'admin' },
  { id: 'admin', label: 'Admin', path: '/admin', icon: Crown, requiresAuth: true, requiresAdmin: true, group: 'admin' },
  { id: 'contact-sales', label: 'Book Advisory Call', path: '/advisory', icon: Phone, requiresAuth: false, group: 'admin' },
];

interface BackButtonProps {
  className?: string;
  customPath?: string;
  customLabel?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  className,
  customPath,
  customLabel = "Back"
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (customPath) {
      navigate(customPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("mb-4 text-muted-foreground hover:text-foreground", className)}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      {customLabel}
    </Button>
  );
};

interface SideNavigationProps {
  className?: string;
  userRole?: string;
  isAdmin?: boolean;
}

export const SideNavigation: React.FC<SideNavigationProps> = ({
  className,
  isAdmin = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const filteredItems = navigationItems.filter(item => {
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  });

  const isActive = (path: string) => {
    return location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  return (
    <nav className={cn("space-y-2", className)}>
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);

        return (
          <Button
            key={item.id}
            variant={active ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate(item.path)}
            className={cn(
              "w-full justify-start",
              active && "bg-primary/10 text-primary border-primary/20"
            )}
          >
            <Icon className="h-4 w-4 mr-3" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
};

interface BreadcrumbProps {
  items: Array<{
    label: string;
    path?: string;
  }>;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  const navigate = useNavigate();

  return (
    <nav className={cn("flex items-center space-x-2 text-sm text-muted-foreground mb-4", className)}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <span>/</span>}
          {item.path ? (
            <button
              onClick={() => item.path && navigate(item.path)}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
};