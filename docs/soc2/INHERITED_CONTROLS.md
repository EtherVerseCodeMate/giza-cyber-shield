# Inherited Controls from Cloud Providers
**Document ID**: IC-001 | **SOC 2**: CC6.4 (Physical Access)  
**Owner**: ISSO | **Review**: Annual (when vendor SOC 2 reports refresh)

NouchiX operates exclusively on cloud infrastructure. Physical access controls
are inherited from the following SOC 2 Type 2 certified providers.

| Vendor | Service | SOC 2 Type 2 | Physical Controls Inherited | Report Location |
|--------|---------|-------------|--------------------------|----------------|
| **Cloudflare** | CDN, WAF, Tunnel, Access | Yes — annual | Data centre badge access, biometric, 24/7 CCTV, mantrap entries | Download from Cloudflare Trust Hub |
| **Supabase** | Database, Auth | Yes | Hosted on AWS; inherits AWS SOC 2 physical controls | Supabase Trust Portal |
| **Fly.io** | Compute | In progress | Hosted on bare-metal in Equinix/Ntt data centres with physical access controls | Request from Fly.io security team |
| **Vercel** | Frontend hosting | Yes | AWS-backed; inherits physical controls | Vercel Trust Center |
| **Tailscale** | Network access | Yes | Coordination server on GCP; inherits GCP physical controls | Tailscale Trust Portal |

## Action Items
- [ ] Download Cloudflare SOC 2 Type 2 report → `docs/soc2/vendor-agreements/cloudflare_soc2.pdf`
- [ ] Download Supabase SOC 2 report → `docs/soc2/vendor-agreements/supabase_soc2.pdf`
- [ ] Obtain Fly.io compliance documentation → `docs/soc2/vendor-agreements/flyio_compliance.pdf`
- [ ] Download Vercel SOC 2 report → `docs/soc2/vendor-agreements/vercel_soc2.pdf`
- [ ] Download Tailscale SOC 2 report → `docs/soc2/vendor-agreements/tailscale_soc2.pdf`

The auditor will request these reports to verify inherited physical access controls satisfy CC6.4.
