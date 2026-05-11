import { useEffect, ReactNode } from 'react';

interface SecurityHeadersProps {
  children: ReactNode;
}

const SecurityHeaders = ({ children }: SecurityHeadersProps) => {
  useEffect(() => {
    // CSP, X-Frame-Options, X-Content-Type-Options, COEP, COOP, HSTS, and
    // Permissions-Policy are enforced via HTTP response headers configured in
    // next.config.mjs. Browsers silently ignore frame-ancestors, X-Frame-Options,
    // COEP, and COOP when set via <meta http-equiv>, so meta-tag injection for
    // those directives provides no security benefit.

    // Referrer policy: the only header that browsers honour from a meta tag
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'strict-origin-when-cross-origin';
    if (!document.querySelector('meta[name="referrer"]')) {
      document.head.appendChild(referrer);
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