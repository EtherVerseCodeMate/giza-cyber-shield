import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Sets document.title dynamically based on the current route.
 * Add new routes here as pages are created.
 */
const ROUTE_TITLES: Record<string, string> = {
    '/': 'AdinKhepra ASAF | CMMC 2.0 Compliance Autopilot',
    '/auth': 'Sign In | AdinKhepra ASAF',
    '/blog': 'Security Blog | AdinKhepra ASAF',
    '/dod': 'DoD Solutions | AdinKhepra ASAF',
    '/onboarding': 'Get Started | AdinKhepra ASAF',
    '/privacy': 'Privacy Policy | AdinKhepra ASAF',
    '/terms': 'Terms of Service | AdinKhepra ASAF',
    '/security': 'Security | AdinKhepra ASAF',
    '/compliance': 'Compliance | AdinKhepra ASAF',
    '/dashboard': 'Dashboard | AdinKhepra ASAF',
    '/stig-dashboard': 'STIG Dashboard | AdinKhepra ASAF',
    '/asset-scanning': 'Asset Scanning | AdinKhepra ASAF',
    '/compliance-reports': 'Reports | AdinKhepra ASAF',
    '/evidence-collection': 'Evidence | AdinKhepra ASAF',
    '/billing': 'Billing | AdinKhepra ASAF',
    '/master-admin': 'Admin Console | AdinKhepra ASAF',
    '/vdp': 'Vulnerability Disclosure | AdinKhepra ASAF',
};

const DEFAULT_TITLE = 'AdinKhepra ASAF | CMMC 2.0 Compliance Autopilot';

export function useDocumentTitle() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Try exact match first, then prefix match for blog posts
        let title = ROUTE_TITLES[pathname];

        if (!title && pathname.startsWith('/blog/')) {
            title = 'Blog | AdinKhepra ASAF';
        }

        document.title = title || DEFAULT_TITLE;
    }, [pathname]);
}
