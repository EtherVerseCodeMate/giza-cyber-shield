import React from 'react';

export default function IncidentQueue() {
  return (
    <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all hover:bg-gray-800/70">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-red-400">Incident Queue</h2>
        <span className="flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="border-l-4 border-red-500 bg-gray-900/80 p-5 rounded-r-lg shadow-inner">
          <div className="flex justify-between items-start mb-2">
            <div className="font-bold text-lg text-white">Quarantine Compromised Agent</div>
            <span className="text-xs font-mono bg-red-900/50 text-red-300 px-2 py-1 rounded border border-red-800">P1 - CRITICAL</span>
          </div>
          
          <div className="text-sm text-gray-300 mb-4 bg-black/30 p-3 rounded font-mono border border-gray-800">
            <div><span className="text-gray-500">Target:</span> Staging-Deployer</div>
            <div><span className="text-gray-500">Trigger:</span> secrets.read &gt; 10/min</div>
            <div><span className="text-gray-500">Symbol:</span> Eban (Fortress)</div>
          </div>
          
          <div className="flex gap-3 mt-2">
            <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium text-sm transition-colors shadow-lg shadow-red-900/20 border border-red-500">
              Approve to Production
            </button>
            <button className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium text-sm transition-colors border border-gray-600">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
