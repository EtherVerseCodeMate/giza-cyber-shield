import { useEffect, useRef, useState, useCallback } from 'react';
import { DAGGraphService, DAGGraphPayload } from '@/services/core/DAGGraphService';

interface UseDAGGraphResult {
  data: DAGGraphPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  daemonOnline: boolean;
}

/**
 * useDAGGraph — polls the Khepra daemon for merged DAG + CMMC compliance data.
 *
 * @param pollIntervalMs  Milliseconds between automatic refreshes. Default 30s.
 *                        Set to 0 to disable polling (manual refresh only).
 */
export function useDAGGraph(pollIntervalMs = 30_000): UseDAGGraphResult {
  const [data, setData] = useState<DAGGraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daemonOnline, setDaemonOnline] = useState(false);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (cancelRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await DAGGraphService.buildLivePayload();
      if (!cancelRef.current) {
        setData(payload);
        setDaemonOnline(true);
      }
    } catch (err) {
      if (!cancelRef.current) {
        setError(err instanceof Error ? err.message : 'Daemon unreachable');
        setDaemonOnline(false);
      }
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    refresh();

    if (pollIntervalMs > 0) {
      timerRef.current = setInterval(refresh, pollIntervalMs);
    }

    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, pollIntervalMs]);

  return { data, loading, error, refresh, daemonOnline };
}
