package scanners

import (
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/types"
)

// productCategory classifies a detected commercial product for compliance mapping.
type productCategory string

const (
	categoryEDR          productCategory = "Endpoint Detection & Response"
	categoryMDM          productCategory = "Mobile Device Management"
	categoryIAM          productCategory = "Identity & Access Management"
	categoryIGA          productCategory = "Identity Governance & Administration"
	categoryMFA          productCategory = "Multi-Factor Authentication"
	categoryPAM          productCategory = "Privileged Access Management"
	categorySecrets      productCategory = "Secrets Management"
	categorySIEM         productCategory = "Security Information & Event Management"
	categoryVulnMgmt     productCategory = "Vulnerability Management"
	categoryNetworkSec   productCategory = "Network Security"
	categoryCASB         productCategory = "Cloud Access Security Broker"
	categoryEmailSec     productCategory = "Email Security"
	categoryContainerSec productCategory = "Container Security"
	categorySSO          productCategory = "Single Sign-On / Federation"
)

// Lifecycle status constants.
const (
	lifecycleActive     = "active"
	lifecycleDeprecated = "deprecated"
	lifecycleEOL        = "eol"
)

// productSignature holds the fingerprint for one commercial product.
// Process, service, software, and executable path patterns are all
// case-insensitive substrings — keep them short and unambiguous.
type productSignature struct {
	Vendor   string
	Product  string
	Category productCategory
	// ParamifyCapability is the Paramify Solution Capability label that maps
	// to this product, enabling automated capability assignment during SSP import.
	ParamifyCapability string
	ProcessNames       []string // match against ProcessInfo.Name / CmdLine / ExecutablePath
	ServiceNames       []string // match against ServiceInfo.Name / DisplayName
	SoftwareNames      []string // match against Software.Name / Publisher
	ExePaths           []string // match against ProcessInfo.ExecutablePath
	// LifecycleStatus is "active", "deprecated", or "eol". Omit for active.
	LifecycleStatus string
	// EOLDate is the vendor-announced end-of-life date (ISO 8601).
	EOLDate string
}

// signatureDB is the master product fingerprint library, built from:
//   - Products visible in Paramify demo screenshots (ground truth)
//   - Market share data: EDR (6sense 2026), SIEM (6sense 2026), MDM (Mordor 2026),
//     IAM (MarketsandMarkets 2026), PAM (PrecedenceResearch 2026), VM (Mordor 2026)
//   - Products explicitly named in Paramify's public documentation (Duo, Okta)
//
// Coverage summary: ~52 products across 13 categories.
// Largest known gap: AWS/Azure/GCP cloud services (handled separately in cloud_inventory.go).
var signatureDB = []productSignature{

	// ── EDR / XDR ──────────────────────────────────────────────────────────
	// Market data (6sense 2026): CrowdStrike 22.4%, Defender 13.2%, SentinelOne 10.4%
	{
		Vendor: "CrowdStrike", Product: "Falcon Sensor",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: CrowdStrike Falcon",
		ProcessNames:  []string{"falconctl", "falcon-sensor", "csfalconservice", "csagent"},
		ServiceNames:  []string{"falconsensor", "csagent", "crowdstrike"},
		SoftwareNames: []string{"crowdstrike falcon", "crowdstrike sensor"},
		ExePaths:      []string{"crowdstrike", "falconctl"},
	},
	{
		Vendor: "SentinelOne", Product: "Singularity Agent",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: SentinelOne",
		ProcessNames:  []string{"sentineld", "sentinel_agent", "sentinelagent"},
		ServiceNames:  []string{"sentinelagent", "sentinelone"},
		SoftwareNames: []string{"sentinelone", "sentinel agent"},
		ExePaths:      []string{"sentinelone"},
	},
	{
		Vendor: "Microsoft", Product: "Defender for Endpoint",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Microsoft Defender",
		ProcessNames:  []string{"mssense", "sensecnfg", "mdatp", "wdavdaemon"},
		ServiceNames:  []string{"sense", "windefend", "mdatp"},
		SoftwareNames: []string{"microsoft defender", "windows defender advanced threat"},
		ExePaths:      []string{"mdatp", "mssense"},
	},
	{
		Vendor: "VMware Carbon Black", Product: "Carbon Black Cloud",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Carbon Black",
		ProcessNames:  []string{"cbagentd", "carbonblack"},
		ServiceNames:  []string{"cbdefense", "carbonblack"},
		SoftwareNames: []string{"carbon black", "cb defense", "cb cloud"},
		ExePaths:      []string{"carbonblack", "cb defense"},
	},
	{
		Vendor: "Cylance", Product: "CylancePROTECT",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Cylance",
		ProcessNames:  []string{"cylancesvc", "cylanceui"},
		ServiceNames:  []string{"cylancesvc"},
		SoftwareNames: []string{"cylanceprotect", "cylance"},
		ExePaths:      []string{"cylance"},
	},
	{
		Vendor: "Palo Alto Networks", Product: "Cortex XDR",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Cortex XDR",
		ProcessNames:  []string{"cyserver", "cortex-xdr"},
		ServiceNames:  []string{"cyserver", "cortex xdr"},
		SoftwareNames: []string{"cortex xdr", "traps"},
		ExePaths:      []string{"cortex-xdr", "traps"},
	},
	// Trellix = McAfee Enterprise + FireEye (merged 2022) — top-5 EDR by market share
	{
		Vendor: "Trellix", Product: "Trellix Agent",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Trellix",
		ProcessNames:  []string{"xagt", "masvc", "mfefire", "trellix"},
		ServiceNames:  []string{"xagt", "masvc", "mfefire"},
		SoftwareNames: []string{"trellix", "mcafee endpoint security", "fireeye endpoint"},
		ExePaths:      []string{"trellix", "xagt"},
	},
	// Trend Micro — top-5 EDR by market share
	{
		Vendor: "Trend Micro", Product: "Apex One",
		Category: categoryEDR, ParamifyCapability: "Endpoint Protection: Trend Micro Apex One",
		ProcessNames:  []string{"icoreservice", "tmlisten", "tmbmsrv", "ntrtscan"},
		ServiceNames:  []string{"tmlisten", "tmbmsrv"},
		SoftwareNames: []string{"trend micro", "apex one", "officescan"},
		ExePaths:      []string{"trendmicro", "apex one"},
	},

	// ── MDM / EMM ──────────────────────────────────────────────────────────
	// Market data (Mordor 2026): Intune 20-25%, VMware 15-20%, IBM 12-17%
	{
		Vendor: "Rippling", Product: "Rippling MDM",
		Category: categoryMDM, ParamifyCapability: "Device Management: Rippling",
		ProcessNames:  []string{"rippling"},
		ServiceNames:  []string{"rippling"},
		SoftwareNames: []string{"rippling"},
		ExePaths:      []string{"rippling"},
	},
	{
		Vendor: "Jamf", Product: "Jamf Pro",
		Category: categoryMDM, ParamifyCapability: "Device Management: Jamf",
		ProcessNames:  []string{"jamf", "jamfagenttray", "jamfd"},
		ServiceNames:  []string{"jamf", "com.jamfsoftware"},
		SoftwareNames: []string{"jamf pro", "jamf", "jamf connect"},
		ExePaths:      []string{"jamf"},
	},
	{
		Vendor: "Microsoft", Product: "Intune",
		Category: categoryMDM, ParamifyCapability: "Device Management: Microsoft Intune",
		ProcessNames:  []string{"intunemdmclient"},
		ServiceNames:  []string{"intunemdmclient", "scaleclient"},
		SoftwareNames: []string{"microsoft intune", "intune management extension"},
		ExePaths:      []string{"intune"},
	},
	{
		Vendor: "Kandji", Product: "Kandji Agent",
		Category: categoryMDM, ParamifyCapability: "Device Management: Kandji",
		ProcessNames:  []string{"kandji"},
		ServiceNames:  []string{"io.kandji.kandji-agent"},
		SoftwareNames: []string{"kandji"},
		ExePaths:      []string{"kandji"},
	},
	{
		Vendor: "VMware", Product: "Workspace ONE",
		Category: categoryMDM, ParamifyCapability: "Device Management: VMware Workspace ONE",
		ProcessNames:  []string{"awhost32", "airwatchagent"},
		ServiceNames:  []string{"airwatch", "workspaceone"},
		SoftwareNames: []string{"workspace one", "airwatch", "vmware horizon"},
		ExePaths:      []string{"airwatch", "workspaceone"},
	},
	// IBM MaaS360 — #3 MDM by market share (12-17%)
	{
		Vendor: "IBM", Product: "MaaS360",
		Category: categoryMDM, ParamifyCapability: "Device Management: IBM MaaS360",
		ProcessNames:  []string{"maas360", "ibm maas"},
		ServiceNames:  []string{"maas360agent"},
		SoftwareNames: []string{"maas360", "ibm maas360"},
		ExePaths:      []string{"maas360"},
	},

	// ── IAM / SSO ──────────────────────────────────────────────────────────
	// Market data (MarketsandMarkets 2026): top 5 = Microsoft, Ping, IBM, Okta, Oracle
	// Paramify explicitly supports Okta and Duo by name in their documentation
	{
		Vendor: "Okta", Product: "Okta Verify",
		Category: categoryIAM, ParamifyCapability: "Identity Provider: Okta",
		ProcessNames:  []string{"okta"},
		ServiceNames:  []string{"okta"},
		SoftwareNames: []string{"okta verify", "okta"},
		ExePaths:      []string{"okta"},
	},
	{
		Vendor: "Microsoft", Product: "Entra ID (Azure AD)",
		Category: categoryIAM, ParamifyCapability: "Identity Provider: Azure AD",
		ProcessNames:  []string{"dsregcmd", "aadloginforwindows"},
		ServiceNames:  []string{"aadidentityservice"},
		SoftwareNames: []string{"azure active directory", "microsoft entra", "microsoft azure ad"},
		ExePaths:      []string{"aadlogin"},
	},
	{
		Vendor: "Ping Identity", Product: "PingFederate",
		Category: categorySSO, ParamifyCapability: "Identity Federation: Ping Identity",
		ProcessNames:  []string{"pingfederate", "pingidentity"},
		ServiceNames:  []string{"pingfederate"},
		SoftwareNames: []string{"pingfederate", "ping identity", "pingaccess"},
		ExePaths:      []string{"pingfederate"},
	},
	{
		Vendor: "Google", Product: "Google Workspace Directory",
		Category: categoryIAM, ParamifyCapability: "Identity Provider: Google Workspace",
		ProcessNames:  []string{"google-credential-provider", "gcpw"},
		ServiceNames:  []string{"google-credential-provider"},
		SoftwareNames: []string{"google credential provider", "google workspace"},
		ExePaths:      []string{"google-credential-provider", "gcpw"},
	},

	// ── Identity Governance & Administration ───────────────────────────────
	// SailPoint: largest IGA vendor; detectable via local agent/connector
	{
		Vendor: "SailPoint", Product: "IdentityNow",
		Category: categoryIGA, ParamifyCapability: "Identity Governance: SailPoint",
		ProcessNames:  []string{"sailpoint", "identitynow"},
		ServiceNames:  []string{"sailpoint"},
		SoftwareNames: []string{"sailpoint", "identitynow", "identityiq"},
		ExePaths:      []string{"sailpoint"},
	},

	// ── MFA ────────────────────────────────────────────────────────────────
	// Paramify names Duo explicitly: "if you use Duo for MFA, Paramify will
	// populate multiple requirements automatically"
	{
		Vendor: "Duo Security", Product: "Duo Authentication Proxy",
		Category: categoryMFA, ParamifyCapability: "Multi-Factor Authentication: Duo",
		ProcessNames:  []string{"duoconnect", "duo-authproxy"},
		ServiceNames:  []string{"duoauthproxy", "duo"},
		SoftwareNames: []string{"duo authentication", "duo security", "duo connect"},
		ExePaths:      []string{"duo"},
	},
	{
		Vendor: "Yubico", Product: "YubiKey Manager",
		Category: categoryMFA, ParamifyCapability: "Multi-Factor Authentication: YubiKey",
		ProcessNames:  []string{"yubioath", "yubikey"},
		ServiceNames:  []string{"ykpers", "yubikey"},
		SoftwareNames: []string{"yubikey", "yubico"},
		ExePaths:      []string{"yubikey"},
	},

	// ── PAM ────────────────────────────────────────────────────────────────
	// Market data (PrecedenceResearch 2026): CyberArk leader, BeyondTrust >$400M ARR
	{
		Vendor: "CyberArk", Product: "Privileged Access Manager",
		Category: categoryPAM, ParamifyCapability: "Privileged Access Management: CyberArk",
		ProcessNames:  []string{"vaultapp", "cybrarkcpm", "cacpm"},
		ServiceNames:  []string{"cyberark", "cyberarkpsm"},
		SoftwareNames: []string{"cyberark", "privileged access manager"},
		ExePaths:      []string{"cyberark"},
	},
	{
		Vendor: "BeyondTrust", Product: "BeyondTrust PAM",
		Category: categoryPAM, ParamifyCapability: "Privileged Access Management: BeyondTrust",
		ProcessNames:  []string{"pbsmd", "pmrun", "beyondtrust"},
		ServiceNames:  []string{"beyondtrust", "pbps"},
		SoftwareNames: []string{"beyondtrust", "powerbroker"},
		ExePaths:      []string{"beyondtrust"},
	},
	// Delinea = Centrify + Thycotic (merged 2021) — strong mid-market PAM
	{
		Vendor: "Delinea", Product: "Secret Server / Privilege Manager",
		Category: categoryPAM, ParamifyCapability: "Privileged Access Management: Delinea",
		ProcessNames:  []string{"centrifydc", "adclient", "thycotic", "delinea"},
		ServiceNames:  []string{"centrifydc", "thycotic", "delinea"},
		SoftwareNames: []string{"delinea", "centrify", "thycotic", "secret server"},
		ExePaths:      []string{"centrify", "thycotic", "delinea"},
	},
	// Teleport — cloud-native / DevOps PAM; growing in DIB cloud environments
	{
		Vendor: "Teleport", Product: "Teleport Access Platform",
		Category: categoryPAM, ParamifyCapability: "Privileged Access Management: Teleport",
		ProcessNames:  []string{"teleport", "tsh"},
		ServiceNames:  []string{"teleport"},
		SoftwareNames: []string{"teleport access", "gravitational teleport"},
		ExePaths:      []string{"teleport", "tsh"},
	},
	// StrongDM — zero-trust infrastructure access; common in cloud-native DIB
	{
		Vendor: "StrongDM", Product: "StrongDM",
		Category: categoryPAM, ParamifyCapability: "Privileged Access Management: StrongDM",
		ProcessNames:  []string{"sdm"},
		ServiceNames:  []string{"sdm"},
		SoftwareNames: []string{"strongdm"},
		ExePaths:      []string{"sdm"},
	},

	// ── Secrets Management ─────────────────────────────────────────────────
	{
		Vendor: "HashiCorp", Product: "Vault",
		Category: categorySecrets, ParamifyCapability: "Secrets Management: HashiCorp Vault",
		ProcessNames:  []string{"vault"},
		ServiceNames:  []string{"vault"},
		SoftwareNames: []string{"hashicorp vault", "vault"},
		ExePaths:      []string{"/vault", "vault"},
	},

	// ── SIEM / SOAR ────────────────────────────────────────────────────────
	// Market data (6sense 2026): Splunk 46.84%, Sentinel 14.83%, QRadar 9.43%
	// NOTE: QRadar Cloud/SOAR/LogInsights EOL 2026-04-14; EDR/XDR EOL 2026-08-31
	{
		Vendor: "Splunk (Cisco)", Product: "Splunk Universal Forwarder",
		Category: categorySIEM, ParamifyCapability: "SIEM: Splunk",
		ProcessNames:  []string{"splunkd", "splunk"},
		ServiceNames:  []string{"splunkd", "splunkforwarder"},
		SoftwareNames: []string{"splunk", "splunk universal forwarder", "splunk enterprise"},
		ExePaths:      []string{"splunk"},
	},
	{
		Vendor: "Microsoft", Product: "Azure Monitor Agent",
		Category: categorySIEM, ParamifyCapability: "SIEM: Microsoft Sentinel",
		ProcessNames:  []string{"omsagent", "azuremonitoragent"},
		ServiceNames:  []string{"omsagent", "azuremonitor"},
		SoftwareNames: []string{"log analytics agent", "azure monitor agent", "microsoft monitoring agent"},
		ExePaths:      []string{"omsagent"},
	},
	// IBM QRadar — EOL: Cloud/SOAR/LogInsights 2026-04-14, EDR/XDR 2026-08-31
	// QRadar SaaS divested to Palo Alto Networks. Existing on-prem installations
	// may still be running; flag as EOL so assessors know to plan migration.
	{
		Vendor: "IBM", Product: "QRadar",
		Category: categorySIEM, ParamifyCapability: "SIEM: IBM QRadar",
		ProcessNames:    []string{"qradar", "hostcontext"},
		ServiceNames:    []string{"qradar"},
		SoftwareNames:   []string{"qradar", "ibm security qradar"},
		ExePaths:        []string{"qradar"},
		LifecycleStatus: lifecycleEOL,
		EOLDate:         "2026-08-31",
	},
	// Elastic Security — fast-growing open-source SIEM challenger
	{
		Vendor: "Elastic", Product: "Elastic Security Agent",
		Category: categorySIEM, ParamifyCapability: "SIEM: Elastic Security",
		ProcessNames:  []string{"elastic-agent", "filebeat", "winlogbeat"},
		ServiceNames:  []string{"elastic-agent", "filebeat"},
		SoftwareNames: []string{"elastic agent", "elastic security", "elastic stack"},
		ExePaths:      []string{"elastic-agent", "filebeat"},
	},

	// ── Vulnerability Management ───────────────────────────────────────────
	// Market data: Tenable, Qualys, Rapid7 are primary incumbents (Mordor 2026)
	{
		Vendor: "Tenable", Product: "Nessus Agent",
		Category: categoryVulnMgmt, ParamifyCapability: "Vulnerability Scanning: Nessus Pro",
		ProcessNames:  []string{"nessusd", "nessusagent"},
		ServiceNames:  []string{"nessusagent", "nessusd"},
		SoftwareNames: []string{"nessus", "tenable agent", "tenable.io agent"},
		ExePaths:      []string{"nessus"},
	},
	{
		Vendor: "Qualys", Product: "Qualys Cloud Agent",
		Category: categoryVulnMgmt, ParamifyCapability: "Vulnerability Scanning: Qualys",
		ProcessNames:  []string{"qualysagent", "qualys"},
		ServiceNames:  []string{"qualysagent"},
		SoftwareNames: []string{"qualys cloud agent", "qualys"},
		ExePaths:      []string{"qualys"},
	},
	{
		Vendor: "Rapid7", Product: "Insight Agent",
		Category: categoryVulnMgmt, ParamifyCapability: "Vulnerability Scanning: Rapid7 InsightVM",
		ProcessNames:  []string{"ir_agent", "insight-agent"},
		ServiceNames:  []string{"rapid7agent", "insight-agent"},
		SoftwareNames: []string{"rapid7 insight agent", "insightagent"},
		ExePaths:      []string{"rapid7", "insight-agent"},
	},

	// ── Network Security ───────────────────────────────────────────────────
	{
		Vendor: "Palo Alto Networks", Product: "GlobalProtect",
		Category: categoryNetworkSec, ParamifyCapability: "VPN: Palo Alto GlobalProtect",
		ProcessNames:  []string{"pangpagent", "globalprotect"},
		ServiceNames:  []string{"pangpagentd", "globalprotect"},
		SoftwareNames: []string{"globalprotect", "palo alto networks globalprotect"},
		ExePaths:      []string{"globalprotect", "pangpa"},
	},
	{
		Vendor: "Cisco", Product: "AnyConnect / Secure Client",
		Category: categoryNetworkSec, ParamifyCapability: "VPN: Cisco AnyConnect",
		ProcessNames:  []string{"vpnagentd", "vpnui", "anyconnect"},
		ServiceNames:  []string{"vpnagent", "ciscoanyconnect"},
		SoftwareNames: []string{"cisco anyconnect", "anyconnect secure mobility", "cisco secure client"},
		ExePaths:      []string{"anyconnect"},
	},
	// Fortinet FortiClient — significant network security install base in DIB
	{
		Vendor: "Fortinet", Product: "FortiClient",
		Category: categoryNetworkSec, ParamifyCapability: "VPN: Fortinet FortiClient",
		ProcessNames:  []string{"forticlient", "fortitray", "fcconfig"},
		ServiceNames:  []string{"forticlient", "fcwscsvc"},
		SoftwareNames: []string{"forticlient", "fortinet forticlient"},
		ExePaths:      []string{"forticlient"},
	},
	// F5 BIG-IP Edge Client — common in enterprise/federal environments
	{
		Vendor: "F5", Product: "BIG-IP Edge Client",
		Category: categoryNetworkSec, ParamifyCapability: "VPN: F5 BIG-IP",
		ProcessNames:  []string{"f5fpclientw", "bigedge", "f5vpn"},
		ServiceNames:  []string{"f5fpclientw"},
		SoftwareNames: []string{"f5 big-ip", "f5 access", "big-ip edge"},
		ExePaths:      []string{"f5fpclient"},
	},

	// ── CASB / Zero Trust ──────────────────────────────────────────────────
	{
		Vendor: "Zscaler", Product: "Zscaler Client Connector",
		Category: categoryCASB, ParamifyCapability: "CASB / Zero Trust Network: Zscaler",
		ProcessNames:  []string{"zscalertunnel", "zpa_service"},
		ServiceNames:  []string{"zscalerd", "zpa"},
		SoftwareNames: []string{"zscaler client connector", "zscaler"},
		ExePaths:      []string{"zscaler"},
	},
	// Cloudflare WARP — zero-trust network access; growing in SMB/DIB market
	{
		Vendor: "Cloudflare", Product: "WARP Client",
		Category: categoryCASB, ParamifyCapability: "CASB / Zero Trust Network: Cloudflare WARP",
		ProcessNames:  []string{"warp-svc", "cloudflare warp"},
		ServiceNames:  []string{"cloudflare warp", "warp-svc"},
		SoftwareNames: []string{"cloudflare warp", "cloudflare one"},
		ExePaths:      []string{"warp-svc"},
	},
	// Netskope — CASB/SSE leader used in regulated industries
	{
		Vendor: "Netskope", Product: "Netskope Client",
		Category: categoryCASB, ParamifyCapability: "CASB / Zero Trust Network: Netskope",
		ProcessNames:  []string{"nsservice", "nswebpro", "netskope"},
		ServiceNames:  []string{"nsservice"},
		SoftwareNames: []string{"netskope client", "netskope"},
		ExePaths:      []string{"netskope"},
	},

	// ── Email Security ─────────────────────────────────────────────────────
	{
		Vendor: "Proofpoint", Product: "Proofpoint",
		Category: categoryEmailSec, ParamifyCapability: "Email Security: Proofpoint",
		ProcessNames:  []string{"proofpoint"},
		ServiceNames:  []string{"proofpoint"},
		SoftwareNames: []string{"proofpoint"},
		ExePaths:      []string{"proofpoint"},
	},
	{
		Vendor: "Mimecast", Product: "Mimecast",
		Category: categoryEmailSec, ParamifyCapability: "Email Security: Mimecast",
		ProcessNames:  []string{"mimecast"},
		ServiceNames:  []string{"mimecast"},
		SoftwareNames: []string{"mimecast"},
		ExePaths:      []string{"mimecast"},
	},

	// ── Container Security ─────────────────────────────────────────────────
	{
		Vendor: "Aqua Security", Product: "Aqua Agent",
		Category: categoryContainerSec, ParamifyCapability: "Container Security: Aqua Security",
		ProcessNames:  []string{"aqua-agent", "slkd"},
		ServiceNames:  []string{"aqua-agent"},
		SoftwareNames: []string{"aqua security", "aqua agent"},
		ExePaths:      []string{"aqua"},
	},
	{
		Vendor: "Sysdig", Product: "Sysdig Agent",
		Category: categoryContainerSec, ParamifyCapability: "Container Security: Sysdig",
		ProcessNames:  []string{"sysdig", "sysdig-agent", "dragent"},
		ServiceNames:  []string{"sysdig", "dragent"},
		SoftwareNames: []string{"sysdig agent", "sysdig"},
		ExePaths:      []string{"sysdig"},
	},
}

// DetectCommercialProducts matches the process, service, and installed-software
// lists in snap against the product signature database and returns one
// CommercialProduct entry per detected vendor+product pair (deduplicated).
//
// Typical call site: after building the AuditSnapshot, before sealing with PQC.
//
//	snap.System.DetectedProducts = scanners.DetectCommercialProducts(snap)
//	snap.SealWithPQC(priv, pub)
func DetectCommercialProducts(snap *types.AuditSnapshot) []types.CommercialProduct {
	seen := make(map[string]bool)
	var results []types.CommercialProduct

	for i := range signatureDB {
		sig := &signatureDB[i]
		key := sig.Vendor + ":" + sig.Product
		if seen[key] {
			continue
		}
		if evidence := matchEvidence(sig, snap); evidence != nil {
			seen[key] = true
			status := sig.LifecycleStatus
			if status == "" {
				status = lifecycleActive
			}
			results = append(results, types.CommercialProduct{
				Vendor:             sig.Vendor,
				Product:            sig.Product,
				Category:           string(sig.Category),
				ParamifyCapability: sig.ParamifyCapability,
				DetectionEvidence:  evidence,
				LifecycleStatus:    status,
				EOLDate:            sig.EOLDate,
			})
		}
	}

	return results
}

// matchEvidence returns the first piece of evidence that identifies sig in snap,
// or nil if no match is found.
func matchEvidence(sig *productSignature, snap *types.AuditSnapshot) []string {
	// Processes — name, full command line, executable path
	for _, proc := range snap.System.Processes {
		for _, pattern := range sig.ProcessNames {
			if ciContains(proc.Name, pattern) || ciContains(proc.CmdLine, pattern) {
				return []string{"process:" + proc.Name}
			}
		}
		for _, pattern := range sig.ExePaths {
			if ciContains(proc.ExecutablePath, pattern) {
				return []string{"exe:" + proc.ExecutablePath}
			}
		}
	}

	// Services — service name and display name
	for _, svc := range snap.System.Services {
		for _, pattern := range sig.ServiceNames {
			if ciContains(svc.Name, pattern) || ciContains(svc.DisplayName, pattern) {
				return []string{"service:" + svc.Name}
			}
		}
	}

	// Installed software — package name and publisher
	for _, sw := range snap.System.InstalledSoftware {
		for _, pattern := range sig.SoftwareNames {
			if ciContains(sw.Name, pattern) || ciContains(sw.Publisher, pattern) {
				v := sw.Version
				if v == "" {
					v = "unknown version"
				}
				return []string{"software:" + sw.Name + " " + v}
			}
		}
	}

	return nil
}

func ciContains(s, substr string) bool {
	return s != "" && strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
