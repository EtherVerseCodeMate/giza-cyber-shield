/**
 * Khepra Client SDK for SouHimBou.AI (TypeScript/Node.js)
 *
 * The "Son" (SouHimBou) uses this to talk to the "Father" (Khepra Daemon).
 *
 * Usage:
 * ```typescript
 * import { KhepraClient } from './khepra-client';
 *
 * const khepra = new KhepraClient();
 * await khepra.heartbeat(); // Check if Father is watching
 * ```
 */

export interface KhepraHealth {
  status: 'alive' | 'dead';
  uptime: number;
  locked: boolean;
  message: string;
}

export interface DAGEvent {
  action: string;
  symbol: string;
  payload?: Record<string, any>;
}

export interface WeaveResponse {
  status: 'woven';
  x_khepra_weave: string;
  message: string;
}

export interface UnweaveResponse {
  status: 'unwoven';
  data: string;
}

export interface AttestResponse {
  status: 'verified' | 'compromised';
  locked: boolean;
  message: string;
}

export class KhepraClient {
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor(
    port: number = 45444,
    timeout: number = 5000
  ) {
    this.baseURL = `http://127.0.0.1:${port}`;
    this.timeout = timeout;
  }

  /**
   * Health check - SouHimBou calls this every 30 seconds
   *
   * @returns Health status or throws if Father is not watching
   */
  async heartbeat(): Promise<KhepraHealth> {
    const response = await this.fetch('/healthz', { method: 'GET' });
    return response.json();
  }

  /**
   * Log an immutable event to the DAG audit trail
   *
   * @example
   * await khepra.logEvent({
   *   action: 'user_login',
   *   symbol: 'SouHimBou-Auth',
   *   payload: { email: 'admin@example.com' }
   * });
   */
  async logEvent(event: DAGEvent): Promise<{ node_id: string }> {
    const response = await this.fetch('/dag/add', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    return response.json();
  }

  /**
   * Encrypt/obfuscate sensitive data with PQC (Nkyinkyim)
   *
   * @param data - Plaintext data to protect
   * @returns Obfuscated string (safe to store in database)
   *
   * @example
   * const { x_khepra_weave } = await khepra.weave('SECRET_API_KEY');
   * await db.insert({ api_key: x_khepra_weave }); // Store only this
   */
  async weave(data: string): Promise<WeaveResponse> {
    const response = await this.fetch('/adinkra/weave', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
    return response.json();
  }

  /**
   * Decrypt obfuscated data (requires system not locked)
   *
   * @param wovenData - The x_khepra_weave string from database
   * @returns Original plaintext data
   *
   * @throws If system is locked due to file integrity violation
   *
   * @example
   * const row = await db.query('SELECT api_key FROM secrets');
   * const { data } = await khepra.unweave(row.api_key);
   * console.log('Secret:', data); // Never log this in production
   */
  async unweave(wovenData: string): Promise<UnweaveResponse> {
    const response = await this.fetch('/adinkra/unweave', {
      method: 'POST',
      body: JSON.stringify({ x_khepra_weave: wovenData }),
    });

    if (response.status === 403) {
      throw new Error('System locked: File integrity violation detected');
    }

    return response.json();
  }

  /**
   * Verify system integrity before critical operations
   *
   * @returns Attestation result
   *
   * @example
   * const { status, locked } = await khepra.attest();
   * if (locked) {
   *   throw new Error('System compromised - aborting operation');
   * }
   */
  async attest(): Promise<AttestResponse> {
    const response = await this.fetch('/attest/verify', {
      method: 'POST',
    });
    return response.json();
  }

  /**
   * Get full daemon status (for monitoring/debugging)
   */
  async status(): Promise<any> {
    const response = await this.fetch('/status', { method: 'GET' });
    return response.json();
  }

  /**
   * Internal fetch wrapper with timeout and error handling
   */
  private async fetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseURL + endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 403) {
        throw new Error(`Khepra API error: ${response.statusText}`);
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Khepra daemon not responding - is the Father watching?');
      }

      throw error;
    }
  }
}

/**
 * Singleton instance for convenience
 */
export const khepra = new KhepraClient();

/**
 * Startup check - Call this in your Next.js app initialization
 *
 * @example
 * // In your Next.js API route or middleware
 * import { ensureKhepraRunning } from './khepra-client';
 *
 * export async function middleware() {
 *   await ensureKhepraRunning();
 *   // ... rest of your middleware
 * }
 */
export async function ensureKhepraRunning(): Promise<void> {
  try {
    const health = await khepra.heartbeat();
    console.log('[KHEPRA] Father is watching:', health.message);
  } catch (error) {
    console.error('[KHEPRA] CRITICAL: Father is not running!', error);
    console.error('Start the Khepra daemon: khepra-daemon.exe');
    throw new Error('Khepra daemon required but not running on port 45444');
  }
}

/**
 * Heartbeat monitor - Call this to start automatic health checks
 *
 * @param interval - Heartbeat interval in milliseconds (default: 30 seconds)
 *
 * @example
 * // In your Next.js app startup
 * startHeartbeatMonitor(30000); // Check every 30 seconds
 */
export function startHeartbeatMonitor(interval: number = 30000): ReturnType<typeof setInterval> {
  console.log('[KHEPRA] Starting heartbeat monitor (every 30s)');

  return setInterval(async () => {
    try {
      const health = await khepra.heartbeat();

      if (health.locked) {
        console.warn('[KHEPRA] ⚠️  WARNING: System is LOCKED (integrity violation)');
      } else {
        console.log(`[KHEPRA] ✓ Heartbeat (uptime: ${Math.floor(health.uptime)}s)`);
      }
    } catch (error) {
      console.error('[KHEPRA] ❌ Heartbeat FAILED - Father may be down!');
    }
  }, interval);
}
