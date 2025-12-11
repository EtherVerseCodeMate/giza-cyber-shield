import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface DAGNode {
    id: string;
    action: string;
    symbol: string;
    time: string;
    parents?: string[];
}

export interface HealthResponse {
    ok: boolean;
    tenant: string;
    repo: string;
    email: string;
}

export const useKhepraAgent = (initialUrl: string = '/api/agent') => {
    const [agentUrl, setAgentUrl] = useState(initialUrl);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [nodes, setNodes] = useState<DAGNode[]>([]);
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const callEndpoint = useCallback(async <T,>(endpoint: string): Promise<T | null> => {
        try {
            const response = await fetch(`${agentUrl}${endpoint}`, {
                method: endpoint === '/attest/new' ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error calling ${endpoint}:`, error);
            throw error;
        }
    }, [agentUrl]);

    const checkHealth = useCallback(async (silent = false) => {
        if (!silent) setIsLoading('health');
        try {
            const data = await callEndpoint<HealthResponse>('/healthz');
            setHealth(data);
            setIsConnected(true);
            if (!silent) toast.success('Agent Connected');
            return true;
        } catch (error) {
            setIsConnected(false);
            if (!silent) toast.error('Agent Unreachable');
            return false;
        } finally {
            if (!silent) setIsLoading(null);
        }
    }, [callEndpoint]);

    const fetchNodes = useCallback(async () => {
        setIsLoading('dag');
        try {
            const data = await callEndpoint<DAGNode[]>('/dag/state');
            setNodes(data || []);
            // toast.success('Log stream updated');
        } catch (error) {
            toast.error('Failed to fetch stream');
        } finally {
            setIsLoading(null);
        }
    }, [callEndpoint]);

    return {
        agentUrl,
        setAgentUrl,
        isLoading,
        nodes,
        health,
        isConnected,
        checkHealth,
        fetchNodes
    };
};
