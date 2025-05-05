
import React from 'react';
import Navbar from '@/components/layout/Navbar';
import { Database, Lock, Server, Cloud, Layers, Workflow } from 'lucide-react';

const Architecture = () => {
  return (
    <div className="min-h-screen bg-giza-dark text-white">
      <Navbar />
      
      <main className="container mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Giza MVP Architecture</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive cyber immunity platform for critical infrastructure
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Frontend Section */}
          <div className="dashboard-card">
            <div className="flex items-center gap-2 mb-6">
              <Layers className="h-6 w-6 text-giza-teal" />
              <h2 className="text-xl font-semibold">Frontend</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <img 
                    src="/lovable-uploads/973c0af0-e1e8-44a4-a186-238531f7d547.png" 
                    alt="React Logo" 
                    className="h-8 w-8 object-contain opacity-0"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 841.9 595.3" className="h-8 w-8 absolute">
                    <g fill="#61DAFB">
                      <path d="M666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9V78c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6V78.5c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zM421.2 430c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24 4.7 8 9.5 15.8 14.4 23.4zM420.7 163c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16.1-13 24.1-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6 0-15.7 22.9-35.6 58.3-50.6 8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zM310 490c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6zM320.8 78.4z"/>
                      <circle cx="420.9" cy="296.5" r="45.7"/>
                      <path d="M520.5 78.1z"/>
                    </g>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">React.js + TypeScript</h3>
                  <p className="text-sm text-muted-foreground">Dynamic and responsive user interface</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#64FFDA" d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16 1V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Visualization Tools</h3>
                  <p className="text-sm text-muted-foreground">Grafana & Kibana integrations</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Backend Section */}
          <div className="dashboard-card">
            <div className="flex items-center gap-2 mb-6">
              <Server className="h-6 w-6 text-giza-blue" />
              <h2 className="text-xl font-semibold">Backend</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#009688" d="M16 17v-1h-3v-3h3v-1h-3v-3h3V8h-4V7H9v1H8v4h1v5h1v2h1v1h5v-1h-3v-1h3v-1h-3zm-5-1v-2h-1v-5h1V8h2v1h-1v1h2v1h-2v5h2v1h-3z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">FastAPI (Python)</h3>
                  <p className="text-sm text-muted-foreground">Primary API gateway</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EE4C2C" d="M12.005 0L4.952 7.053l9.732 5.682-2.846-5.682L12.005 0zm7.053 7.053L12.005 0l.168 7.053 2.846 5.682 4.039-5.682zM4.952 7.053L0 12l7.053 5.682L4.952 7.053zm14.106 0l2.101 10.629L24 12l-4.942-4.947z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">TorchServe</h3>
                  <p className="text-sm text-muted-foreground">ML model serving for anomaly detection</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <Workflow className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <h3 className="font-medium">Ansible Automation</h3>
                  <p className="text-sm text-muted-foreground">Automated response playbooks</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Infrastructure Section */}
          <div className="dashboard-card">
            <div className="flex items-center gap-2 mb-6">
              <Cloud className="h-6 w-6 text-giza-teal" />
              <h2 className="text-xl font-semibold">Infrastructure & Security</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#2496ED" d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.6.332-1.75.5-1.957.5H.09l-.087.536c-.214 1.492-.212 3.604.2 5.365.458 1.97 1.51 3.536 2.97 4.648 1.647 1.142 4.316 1.74 7.334 1.74 1.35.001 2.698-.128 4.024-.38 1.84-.355 3.604-1.03 5.155-2.009 1.33-.84 2.488-1.89 3.608-3.33.905-1.158 1.518-2.518 2.013-3.85.116-.297.21-.673.334-1.022.382-1.092.648-2.262.688-3.586l.003-.222z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Docker & Kubernetes</h3>
                  <p className="text-sm text-muted-foreground">Containerization and orchestration</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#00B388" d="M12 2L2 12l10 10 10-10L12 2zm0 2.828L19.172 12 12 19.172 4.828 12 12 4.828z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">HPE GreenLake</h3>
                  <p className="text-sm text-muted-foreground">Cloud infrastructure platform</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                  <Lock className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium">Keycloak & Vault</h3>
                  <p className="text-sm text-muted-foreground">Auth and secrets management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Integration Services */}
        <div className="dashboard-card mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Workflow className="h-6 w-6 text-giza-blue" />
            <h2 className="text-xl font-semibold">Integration Services</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-giza-navy rounded-lg">
              <h3 className="font-medium mb-2">Datto RMM & Autotask BMS</h3>
              <p className="text-sm text-muted-foreground">Device management and ticketing automation</p>
            </div>
            
            <div className="p-4 bg-giza-navy rounded-lg">
              <h3 className="font-medium mb-2">Microsoft Graph API</h3>
              <p className="text-sm text-muted-foreground">Access to Microsoft 365 audit logs and security scores</p>
            </div>
            
            <div className="p-4 bg-giza-navy rounded-lg">
              <h3 className="font-medium mb-2">Bitdefender GravityZone API</h3>
              <p className="text-sm text-muted-foreground">Endpoint threat telemetry and risk assessments</p>
            </div>
          </div>
        </div>
        
        {/* Databases */}
        <div className="dashboard-card">
          <div className="flex items-center gap-2 mb-6">
            <Database className="h-6 w-6 text-giza-teal" />
            <h2 className="text-xl font-semibold">Databases</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4 p-4 bg-giza-navy rounded-lg">
              <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-green-500/10 rounded-lg">
                <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4DB33D" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.14-7-7 3.14-7 7-7zm0 3c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">MongoDB</h3>
                <p className="text-sm text-muted-foreground">Stores unstructured data, logs and telemetry</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-giza-navy rounded-lg">
              <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg">
                <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#336791" d="M17.128 13.784c.07-.462.145-.913.214-1.35.596-3.85.174-5.22-1.26-6.146-.866-.52-2.514-.856-3.956-.788l-.197.01c-.72.055-1.477.256-2.082.535-.278.114-.7.36-.763.382.34.054.78.135 1.15.23 1.23.302 1.765.834 1.897 1.15.156.324.066.845-.208 1.48-.278.635-.747 1.24-1.133 1.7.32.16.69.29 1.102.382.486.107 1.205.02 1.806-.264.698-.324 1.13-.724 1.36-1.263.124-.29.16-.613.157-.93-.01-.88-.31-1.733-.62-2.503-.05-.124-.105-.256-.152-.38.015-.027.146-.162.21-.22.91-.874 2.334-1.205 3.58-.915 1.19.27 2.36 1.345 2.923 2.465.647 1.312.6 2.8.387 3.47-.226.66-.64 1.75-1.332 2.627l-.072.11c-.5.694-1.124 1.5-1.857 2.07-.732.574-1.54.93-2.24.953-1.706.053-2.74-1.624-2.84-1.776-.017-.018-.04-.038-.08-.075-.314.352-.594.598-.92.872-.15.1-.323.305-.507.478l-.053.047v.004c.79.905.77.935.963 1.144.3.327.4.458.522.607l.036.045.005.004c.86 1.046 1.925 1.273 2.395 1.32.418.04.812.014 1.17-.06 1.5-.31 2.58-1.07 3.452-1.936.806-.802 1.385-1.27 1.694-1.744.045-.068.094-.14.14-.218.053-.095.1-.19.14-.283.15-.274.198-.51.232-.73.25-1.328-.17-2.678-.9-3.418-.2-.203-.51-.452-.84-.66zm-9.91-1.203c.018-.02 0-.056 0-.075-.266.097-.553.093-.91.062-.38-.035-.735-.088-1.07-.158-.348-.073-.523-.12-.734-.194l.002.018c.027.018.058.035.084.056.45.125 1.4.45 1.985.698.44.188.853.395 1.192.593.153.09.352.208.37.208.07-.054.105-.17.146-.237.032-.053.062-.107.092-.16z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium">PostgreSQL</h3>
                <p className="text-sm text-muted-foreground">Manages structured data, user and system info</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Key Features and Benefits */}
        <div className="mt-8 p-6 bg-gradient-to-r from-giza-navy to-giza-dark border border-giza-teal/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Key Architecture Benefits</h2>
          
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>Modular design enables scalability and component independence</p>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>Containerized microservices for resilience and scalability</p>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>ML-powered anomaly detection for proactive threat intelligence</p>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>Multi-layer security approach from infrastructure to application</p>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>Integrated automation for rapid incident response</p>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-giza-teal flex-shrink-0"></div>
              <p>Comprehensive API integration with security tools ecosystem</p>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Architecture;
