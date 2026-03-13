# SpiderFoot Module Manifest

SpiderFoot v4.0 is vendored in `tools/spiderfoot/` (MIT license, © Steve Micallef).
The crawler wrapper in `pkg/scanner/crawler.go` executes `sf.py` against a target.

## Module Selection Policy

The default `RunCrawler()` invocation restricts scanning to the **ADINKHEPRA approved
module set** below. This serves three purposes:

1. **IronBank / IL6:** Every module that makes outbound API calls must be declared in
   the component manifest. Unapproved modules will cause the IronBank submission to fail.
2. **Scan scope control:** Modules outside the approved set (dark web, social media,
   cryptocurrency) are not relevant to enterprise asset scanning and add noise.
3. **API key hygiene:** Modules requiring commercial API keys are opt-in only.

The `-m` flag in `crawler.go` restricts execution to the approved set. To use the
full SpiderFoot module suite, run `sf.py` directly (see SpiderFoot docs).

---

## Approved Modules (ADINKHEPRA Default Set)

These are the modules enabled by default in `RunCrawler()`. All are either internal
(no external API calls) or use free public APIs.

### DNS & Host Enumeration
| Module | Description | API required |
|---|---|---|
| `sfp_dns` | DNS resolution | None (internal) |
| `sfp_dnsbrute` | DNS brute-force subdomain enumeration | None (internal) |
| `sfp_dnsraw` | Raw DNS records (MX, TXT, SOA, etc.) | None (internal) |
| `sfp_dnsdumpster` | Passive subdomain enumeration via HackerTarget | Free API |
| `sfp_crt` | Certificate Transparency (crt.sh) | Free API |
| `sfp_sublist3r` | Passive DNS via Sublist3r | Free API |

### Network & Infrastructure
| Module | Description | API required |
|---|---|---|
| `sfp_ripe` | WHOIS / netblock lookup via RIPE/ARIN | Free API |
| `sfp_arin` | ARIN registry contact info | Free API |
| `sfp_bgpview` | ASN and routing info via BGPView | Free API |
| `sfp_portscan_tcp` | TCP port scan (common ports) | None (internal) |
| `sfp_networksdb` | IP/domain info via NetworksDB | Free API |

### SSL / TLS
| Module | Description | API required |
|---|---|---|
| `sfp_ssl` | SSL certificate analysis | None (internal) |
| `sfp_certspotter` | SSL cert monitoring via CertSpotter | Free API |

### Web & HTTP
| Module | Description | API required |
|---|---|---|
| `sfp_spider` | Web spider / content extraction | None (internal) |
| `sfp_webserver` | Web server banner identification | None (internal) |
| `sfp_pageinfo` | Page info (forms, password fields) | None (internal) |
| `sfp_strangeheader` | Non-standard HTTP header identification | None (internal) |
| `sfp_webframework` | Web framework identification | None (internal) |
| `sfp_filemeta` | File metadata extraction (EXIF, doc properties) | None (internal) |
| `sfp_interessingfiles` | Identify interesting/sensitive files | None (internal) |

### Threat Intelligence
| Module | Description | API required |
|---|---|---|
| `sfp_alienvault` | AlienVault OTX threat intel | Free API |
| `sfp_threatcrowd` | ThreatCrowd passive DNS & threat data | Free API |
| `sfp_threatfox` | ThreatFox IP/domain malicious indicator | Free API |
| `sfp_greynoise` | GreyNoise Community IP enrichment | Free API |
| `sfp_virustotal` | VirusTotal IP/domain reputation | **Tiered API** |
| `sfp_phishtank` | PhishTank domain malicious check | Free API |
| `sfp_openphish` | OpenPhish URL check | Free API |

### Vulnerability Intelligence
| Module | Description | API required |
|---|---|---|
| `sfp_hackertarget` | Shared-IP lookup via HackerTarget | Free API |
| `sfp_urlscan` | URLScan.io cached domain info | Free API |
| `sfp_leakix` | LeakIX open ports and data leaks | Free API |

### WHOIS / Registrar
| Module | Description | API required |
|---|---|---|
| `sfp_whois` | WHOIS domain lookup | None (internal) |
| `sfp_viewdns` | Reverse WHOIS via ViewDNS.info | Free API |

---

## Opt-In Modules (Require API Keys or Elevated Scope)

These modules are available but not enabled by default. Configure API keys in
`tools/spiderfoot/` and invoke `sf.py` directly or use the `SF_EXTRA_MODULES` env var
(see `pkg/scanner/crawler.go`).

| Module | Requires | Use case |
|---|---|---|
| `sfp_shodan` | Shodan API key (Tiered) | Deep port/banner scan, CVE enrichment |
| `sfp_censys` | Censys API key (Tiered) | Host certificate and service enumeration |
| `sfp_securitytrails` | SecurityTrails API key (Tiered) | Deep passive DNS history |
| `sfp_binaryedge` | BinaryEdge API key (Tiered) | Breach/vuln/torrent/passive DNS |
| `sfp_hunter` | Hunter.io API key (Tiered) | Email address enumeration |
| `sfp_haveibeenpwned` | HIBP API key (Commercial) | Breach email check |
| `sfp_intelx` | IntelligenceX API key (Tiered) | Deep OSINT (IP, domain, email, phone) |

---

## Excluded Modules (Out of Scope for ADINKHEPRA)

These modules are in the SpiderFoot distribution but explicitly excluded from any
ADINKHEPRA scan profile. They are not relevant to enterprise asset compliance scanning
and would require separate legal review before use.

**Social media / personal data:** `sfp_twitter`, `sfp_instagram`, `sfp_linkedin`,
`sfp_myspace`, `sfp_gravatar`, `sfp_flickr`, `sfp_slideshare`, `sfp_venmo`,
`sfp_keybase`, `sfp_stackoverflow`

**Cryptocurrency:** `sfp_bitcoin`, `sfp_bitcoinwhoswho`, `sfp_bitcoinabuse`,
`sfp_blockchain`, `sfp_etherscan`, `sfp_ethereum`

**Dark web / Tor:** `sfp_ahmia`, `sfp_torch`, `sfp_onion_link`,
`sfp_onionsearchengine`, `sfp_tor_exit_nodes`

**Torrents / P2P:** `sfp_iknowwhatyoudownload`

**Paste sites (personal data risk):** `sfp_pastebin`, `sfp_psbdmp`, `sfp_trashpanda`

---

## IronBank Component Declaration

For IL6 submissions, declare the following in your component manifest:

```
Component: SpiderFoot v4.0
License: MIT
Source: https://github.com/smicallef/spiderfoot
Vendor: Steve Micallef
Usage: OSINT scanning of customer-declared target assets
Outbound network: Yes (to public DNS, WHOIS, and approved free-tier APIs listed above)
Data handling: Scan results stored locally, signed via ML-DSA-65, no PII retained
```

Each module that makes outbound API calls must be listed individually in the
IL6 connection authorization table. Use the "Approved Modules" table above as
the source of truth.
