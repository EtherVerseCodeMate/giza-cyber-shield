import React from 'react';

export default function FleetView() {
  return (
    <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all hover:bg-gray-800/70">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-emerald-400">Agent Fleet</h2>
        <span className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full text-gray-400 border border-gray-700">Living Trust Constellation</span>
      </div>
      
      <div className="flex flex-col gap-4">
        {/* Agent 1 */}
        <div className="group flex justify-between items-center bg-gray-900/50 p-4 rounded-lg border border-gray-700 hover:border-emerald-500/50 transition-all cursor-default">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <div className="font-bold text-gray-100 flex items-center gap-2">
                Nkyinkyim-core
                <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">Architect</span>
              </div>
              <div className="text-sm text-gray-400 mt-1 font-mono">Threat Score: <span className="text-emerald-400">0.05</span></div>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-900/30 text-emerald-400 text-xs rounded-full border border-emerald-800/50">Active</span>
        </div>

        {/* Agent 2 */}
        <div className="group flex justify-between items-center bg-gray-900/50 p-4 rounded-lg border border-red-900/50 hover:border-red-500/50 transition-all cursor-default">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <div>
              <div className="font-bold text-gray-100 flex items-center gap-2">
                Staging-Deployer
                <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-800">Sub-agent</span>
              </div>
              <div className="text-sm text-gray-400 mt-1 font-mono">Threat Score: <span className="text-red-400 font-bold">0.88</span></div>
            </div>
          </div>
          <span className="px-3 py-1 bg-red-900/30 text-red-400 text-xs rounded-full border border-red-800/50">Quarantined</span>
        </div>
      </div>
    </div>
  );
}
