
import { type ChartData } from "recharts";

export type AlertPriority = "low" | "medium" | "high" | "critical";
export type SystemStatus = "operational" | "degraded" | "outage";
export type IntegrationStatus = "active" | "warning" | "critical" | "inactive";

export interface Alert {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  priority: AlertPriority;
  source: string;
}

export interface Integration {
  id: string;
  name: string;
  status: IntegrationStatus;
  lastSync: string;
  type: string;
}

export interface SystemOverview {
  activeAlerts: number;
  resolvedAlerts: number;
  detectionsToday: number;
  averageResponseTime: string;
  complianceScore: number;
  systemStatus: SystemStatus;
}

// Mock data for alerts
export const alerts: Alert[] = [
  {
    id: "a1",
    title: "Unusual login patterns detected",
    description: "Multiple failed login attempts from IP 192.168.1.45",
    timestamp: "2025-05-05T08:23:15Z",
    priority: "high",
    source: "Microsoft 365"
  },
  {
    id: "a2",
    title: "Configuration drift detected",
    description: "Kubernetes manifests no longer match approved templates",
    timestamp: "2025-05-05T07:15:22Z",
    priority: "medium",
    source: "Wiz.io"
  },
  {
    id: "a3",
    title: "Modbus protocol anomaly",
    description: "Unusual command sequence on OT network segment",
    timestamp: "2025-05-05T06:43:11Z",
    priority: "critical",
    source: "PyModbus Monitor"
  },
  {
    id: "a4",
    title: "Endpoint missing critical patch",
    description: "CVE-2025-1234 patch not applied to 3 systems",
    timestamp: "2025-05-04T22:12:45Z",
    priority: "high",
    source: "Bitdefender"
  },
  {
    id: "a5",
    title: "New service account created",
    description: "Service account 'backup-sync' created with admin privileges",
    timestamp: "2025-05-04T15:32:18Z",
    priority: "medium",
    source: "Microsoft 365"
  }
];

// Mock data for integrations
export const integrations: Integration[] = [
  {
    id: "i1",
    name: "Microsoft 365",
    status: "active",
    lastSync: "2025-05-05T08:30:00Z",
    type: "Direct API"
  },
  {
    id: "i2",
    name: "Bitdefender GravityZone",
    status: "active",
    lastSync: "2025-05-05T08:15:00Z",
    type: "Direct API"
  },
  {
    id: "i3",
    name: "Wiz.io CNAPP",
    status: "warning",
    lastSync: "2025-05-05T07:45:00Z",
    type: "Direct API"
  },
  {
    id: "i4",
    name: "Autotask BMS",
    status: "active",
    lastSync: "2025-05-05T08:25:00Z",
    type: "Datto RMM"
  },
  {
    id: "i5",
    name: "OpsGenie",
    status: "inactive",
    lastSync: "2025-05-04T22:30:00Z",
    type: "Datto RMM"
  }
];

// Mock data for system overview
export const systemOverview: SystemOverview = {
  activeAlerts: 12,
  resolvedAlerts: 28,
  detectionsToday: 47,
  averageResponseTime: "1m 23s",
  complianceScore: 87,
  systemStatus: "operational"
};

// Mock data for anomaly detection chart
export const anomalyData: ChartData[] = [
  { time: "00:00", OT: 5, IT: 12, Cloud: 8 },
  { time: "04:00", OT: 7, IT: 10, Cloud: 13 },
  { time: "08:00", OT: 10, IT: 14, Cloud: 9 },
  { time: "12:00", OT: 8, IT: 24, Cloud: 11 },
  { time: "16:00", OT: 12, IT: 18, Cloud: 14 },
  { time: "20:00", OT: 9, IT: 15, Cloud: 10 },
  { time: "24:00", OT: 6, IT: 13, Cloud: 7 },
];

// Mock data for compliance scores
export const complianceData: ChartData[] = [
  { name: "Identity", value: 85, target: 95 },
  { name: "Endpoints", value: 92, target: 95 },
  { name: "Data", value: 78, target: 95 },
  { name: "Network", value: 88, target: 95 },
  { name: "Cloud", value: 82, target: 95 },
];
