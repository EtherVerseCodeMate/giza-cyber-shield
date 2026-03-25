import { useEffect, ReactNode } from 'react';

interface SecurityHeadersProps {
  children: ReactNode;
}

const SecurityHeaders = ({ children }: SecurityHeadersProps) => {
  useEffect(() => {
    // Generate nonce for CSP
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Set Content Security Policy with enhanced security
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self' https://xjknkjbrjgljuovaazeu.supabase.co https://api.x.ai;
      script-src 'self' 'nonce-${nonce}' https://xjknkjbrjgljuovaazeu.supabase.co;
      style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
      font-src 'self' data: https://fonts.gstatic.com;
      img-src 'self' data: https: blob:;
      connect-src 'self' https://xjknkjbrjgljuovaazeu.supabase.co https://api.x.ai wss://xjknkjbrjgljuovaazeu.supabase.co;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors ${process.env.NODE_ENV === 'development' ? "'self'" : "'none'"};
      upgrade-insecure-requests;
      report-uri /csp-report;
    `.replaceAll(/\s+/g, ' ').trim();

    // Only add if not already present
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      document.head.appendChild(meta);
    }

    // Set X-Frame-Options - allow iframe in development for Lovable editor
    const frameOptions = document.createElement('meta');
    frameOptions.httpEquiv = 'X-Frame-Options';
    frameOptions.content = process.env.NODE_ENV === 'development' ? 'SAMEORIGIN' : 'DENY';
    if (!document.querySelector('meta[http-equiv="X-Frame-Options"]')) {
      document.head.appendChild(frameOptions);
    }

    // Set X-Content-Type-Options
    const contentType = document.createElement('meta');
    contentType.httpEquiv = 'X-Content-Type-Options';
    contentType.content = 'nosniff';
    if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
      document.head.appendChild(contentType);
    }

    // Set Referrer Policy
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'strict-origin-when-cross-origin';
    if (!document.querySelector('meta[name="referrer"]')) {
      document.head.appendChild(referrer);
    }

    // Set Strict-Transport-Security
    const hsts = document.createElement('meta');
    hsts.httpEquiv = 'Strict-Transport-Security';
    hsts.content = 'max-age=31536000; includeSubDomains; preload';
    if (!document.querySelector('meta[http-equiv="Strict-Transport-Security"]')) {
      document.head.appendChild(hsts);
    }

    // Set Permissions Policy
    const permissions = document.createElement('meta');
    permissions.httpEquiv = 'Permissions-Policy';
    permissions.content = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
    if (!document.querySelector('meta[http-equiv="Permissions-Policy"]')) {
      document.head.appendChild(permissions);
    }

    // Set Cross-Origin-Embedder-Policy
    const coep = document.createElement('meta');
    coep.httpEquiv = 'Cross-Origin-Embedder-Policy';
    coep.content = 'require-corp';
    if (!document.querySelector('meta[http-equiv="Cross-Origin-Embedder-Policy"]')) {
      document.head.appendChild(coep);
    }

    // Set Cross-Origin-Opener-Policy
    const coop = document.createElement('meta');
    coop.httpEquiv = 'Cross-Origin-Opener-Policy';
    coop.content = 'same-origin';
    if (!document.querySelector('meta[http-equiv="Cross-Origin-Opener-Policy"]')) {
      document.head.appendChild(coop);
    }

    // Disable autocomplete on sensitive forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (form.querySelector('input[type="password"]')) {
        form.setAttribute('autocomplete', 'off');
      }
    });

    // Remove sensitive data from console in production
    if (process.env.NODE_ENV === 'production') {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args) => {
        // Filter out sensitive data
        const filtered = args.map(arg =>
          typeof arg === 'string' && (arg.includes('password') || arg.includes('token') || arg.includes('key'))
            ? '[REDACTED]' : arg
        );
        originalLog(...filtered);
      };

      console.warn = (...args) => {
        const filtered = args.map(arg =>
          typeof arg === 'string' && (arg.includes('password') || arg.includes('token') || arg.includes('key'))
            ? '[REDACTED]' : arg
        );
        originalWarn(...filtered);
      };

      console.error = (...args) => {
        const filtered = args.map(arg =>
          typeof arg === 'string' && (arg.includes('password') || arg.includes('token') || arg.includes('key'))
            ? '[REDACTED]' : arg
        );
        originalError(...filtered);
      };
    }

    return () => {
      // Cleanup on unmount is not needed for meta tags as they persist
    };
  }, []);

  return <>{children}</>;
};

export default SecurityHeaders;