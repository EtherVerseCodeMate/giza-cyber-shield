import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logAnalyticsAction } from '@/lib/telemetry';

export interface BusinessMetrics {
  totalCustomers: number;
  monthlyRecurringRevenue: number;
  customerAcquisitionCost: number;
  lifetimeValue: number;
  churnRate: number;
  growthRate: number;
  pipelineValue: number;
  conversionRate: number;
}

export interface CustomerSegmentMetrics {
  segment: string;
  customers: number;
  revenue: number;
  growth: number;
  satisfaction: number;
}

export const useBusinessMetrics = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    totalCustomers: 0,
    monthlyRecurringRevenue: 0,
    customerAcquisitionCost: 0,
    lifetimeValue: 0,
    churnRate: 0,
    growthRate: 0,
    pipelineValue: 0,
    conversionRate: 0
  });

  const [segmentMetrics] = useState<CustomerSegmentMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinessMetrics();
  }, []);

  const fetchBusinessMetrics = async () => {
    try {
      setLoading(true);

      await logAnalyticsAction(
        'business_metrics_viewed',
        'business_analytics',
        'dashboard',
        { metrics_type: 'overview', timestamp: new Date().toISOString() },
      );

    } catch (error) {
      console.error('Error fetching business metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch business metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateGrowthRate = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const calculateLifetimeValue = (avgRevenue: number, churnRate: number): number => {
    if (churnRate === 0) return 0;
    return avgRevenue / (churnRate / 100);
  };

  const trackBusinessEvent = async (eventType: string, data: unknown) => {
    try {
      await logAnalyticsAction(
        'business_event_tracked',
        'business_analytics',
        eventType,
        { event_type: eventType, event_data: data, timestamp: new Date().toISOString() },
      );
    } catch (error) {
      console.error('Error tracking business event:', error);
    }
  };

  const updateMetrics = (newMetrics: Partial<BusinessMetrics>) => {
    setMetrics(prev => ({ ...prev, ...newMetrics }));
    trackBusinessEvent('metrics_updated', newMetrics);
  };

  return {
    metrics,
    segmentMetrics,
    loading,
    updateMetrics,
    trackBusinessEvent,
    calculateGrowthRate,
    calculateLifetimeValue,
    refetch: fetchBusinessMetrics
  };
};