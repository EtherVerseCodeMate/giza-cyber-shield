import React from 'react';
import FleetView from '../components/soc/FleetView';
import IncidentQueue from '../components/soc/IncidentQueue';

export default function SOCDashboard() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white p-6 font-sans">
      <header className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
          SouHimBou AI <span className="text-gray-500 text-2xl font-normal">| Agentic SOC</span>
        </h1>
        <p className="text-gray-400 mt-2">Central AI Security Architect Dashboard</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <FleetView />
        <IncidentQueue />
      </div>
    </div>
  );
}
