package scanners

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/types"
)

// DetectCloudServices enumerates cloud provider services from three sources,
// none of which require network access or cloud API credentials:
//
//  1. Agent processes already captured in the snapshot (CloudWatch Agent, SSM Agent)
//  2. AWS CLI configuration files (~/.aws/config, ~/.aws/sso/)
//  3. Terraform state files (*.tfstate) found in well-known directories
//
// This produces a zero-network, air-gap-compatible cloud service inventory
// that maps directly to Paramify's AWS-centric Solution Capabilities library.
//
// Call site (alongside DetectCommercialProducts):
//
//	snap.System.DetectedProducts = scanners.DetectCommercialProducts(snap)
//	snap.System.CloudServices    = scanners.DetectCloudServices(snap)
//	snap.SealWithPQC(priv, pub)
func DetectCloudServices(snap *types.AuditSnapshot) []types.CloudService {
	seen := make(map[string]bool) // dedup by provider+serviceID
	var results []types.CloudService

	add := func(svc types.CloudService) {
		key := svc.Provider + ":" + svc.ServiceID
		if seen[key] {
			return
		}
		seen[key] = true
		results = append(results, svc)
	}

	// 1. Agent processes — check the snapshot process/service lists
	for _, svc := range awsAgentsFromSnapshot(snap) {
		add(svc)
	}

	// 2. AWS CLI config files
	for _, svc := range awsServicesFromConfig() {
		add(svc)
	}

	// 3. Terraform state files
	for _, svc := range awsServicesFromTerraform(terraformSearchRoots()) {
		add(svc)
	}

	return results
}

// ── AWS agent-process detection ──────────────────────────────────────────────

// awsAgentSignature matches a locally installed AWS service agent.
type awsAgentSignature struct {
	processPatterns []string
	servicePatterns []string
	svc             types.CloudService
}

var awsAgentSignatures = []awsAgentSignature{
	{
		processPatterns: []string{"amazon-cloudwatch-agent"},
		servicePatterns: []string{"amazon-cloudwatch-agent"},
		svc: types.CloudService{
			Provider: "AWS", ServiceName: "Amazon CloudWatch Agent",
			ServiceID:          "cloudwatch",
			DetectionSource:    "agent-process",
			ParamifyCapability: "Monitoring: Amazon CloudWatch",
		},
	},
	{
		processPatterns: []string{"amazon-ssm-agent"},
		servicePatterns: []string{"amazon-ssm-agent"},
		svc: types.CloudService{
			Provider: "AWS", ServiceName: "AWS Systems Manager Agent",
			ServiceID:          "ssm",
			DetectionSource:    "agent-process",
			ParamifyCapability: "Configuration Management: AWS Systems Manager",
		},
	},
	{
		// Inspector v2 uses the SSM agent; v1 had its own agent binary
		processPatterns: []string{"aws-agent"},
		servicePatterns: []string{"awsagent"},
		svc: types.CloudService{
			Provider: "AWS", ServiceName: "AWS Inspector",
			ServiceID:          "inspector",
			DetectionSource:    "agent-process",
			ParamifyCapability: "Vulnerability Scanning: AWS Inspector",
		},
	},
}

func awsAgentsFromSnapshot(snap *types.AuditSnapshot) []types.CloudService {
	var results []types.CloudService
	for _, sig := range awsAgentSignatures {
		for _, proc := range snap.System.Processes {
			for _, pattern := range sig.processPatterns {
				if ciContains(proc.Name, pattern) || ciContains(proc.ExecutablePath, pattern) {
					c := sig.svc
					c.Evidence = []string{"process:" + proc.Name}
					results = append(results, c)
					goto nextSig
				}
			}
		}
		for _, svc := range snap.System.Services {
			for _, pattern := range sig.servicePatterns {
				if ciContains(svc.Name, pattern) || ciContains(svc.DisplayName, pattern) {
					c := sig.svc
					c.Evidence = []string{"service:" + svc.Name}
					results = append(results, c)
					goto nextSig
				}
			}
		}
	nextSig:
	}
	return results
}

// ── AWS config-file detection ─────────────────────────────────────────────────

func awsServicesFromConfig() []types.CloudService {
	var results []types.CloudService

	for _, configPath := range awsConfigPaths() {
		data, err := os.ReadFile(configPath)
		if err != nil {
			continue
		}
		content := string(data)

		// Any ~/.aws/config means AWS CLI is configured and IAM is in use
		results = append(results, types.CloudService{
			Provider: "AWS", ServiceName: "AWS IAM",
			ServiceID:          "iam",
			DetectionSource:    "config-file",
			Evidence:           []string{"file:" + configPath},
			ParamifyCapability: "Identity & Access Management: AWS IAM",
		})

		// GovCloud region signals GovCloud deployment
		if strings.Contains(content, "us-gov-") || strings.Contains(content, "gov-cloud") {
			results = append(results, types.CloudService{
				Provider: "AWS", ServiceName: "AWS GovCloud",
				ServiceID:          "govcloud",
				DetectionSource:    "config-file",
				Evidence:           []string{"file:" + configPath},
				ParamifyCapability: "Asset Transportation Authorization: AWS GovCloud",
			})
		}

		// Detect configured region for context
		region := extractAWSRegion(content)

		// SSO config signals IAM Identity Center
		ssoDir := filepath.Join(filepath.Dir(configPath), "sso")
		if _, err := os.Stat(ssoDir); err == nil {
			svc := types.CloudService{
				Provider: "AWS", ServiceName: "AWS IAM Identity Center",
				ServiceID:          "iam-identity-center",
				DetectionSource:    "config-file",
				Evidence:           []string{"dir:" + ssoDir},
				ParamifyCapability: "Administrative Session Termination: Amazon IAM Identity Center",
				Region:             region,
			}
			results = append(results, svc)
		}

		break // one config file is sufficient for presence detection
	}

	return results
}

// awsConfigPaths returns candidate paths for ~/.aws/config across users.
func awsConfigPaths() []string {
	var paths []string

	// root
	paths = append(paths, "/root/.aws/config")

	// home directories
	homes, _ := filepath.Glob("/home/*/.aws/config")
	paths = append(paths, homes...)

	// current user via HOME env var
	if home := os.Getenv("HOME"); home != "" {
		paths = append(paths, filepath.Join(home, ".aws", "config"))
	}

	return dedupStrings(paths)
}

func extractAWSRegion(configContent string) string {
	for _, line := range strings.Split(configContent, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "region") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

// ── Terraform state detection ─────────────────────────────────────────────────

// awsResourceMap maps Terraform resource types to AWS service descriptors.
// Sources: Paramify demo screenshots + AWS provider documentation.
var awsResourceMap = map[string]types.CloudService{
	// Visible in Paramify Solution Capabilities screenshots
	"aws_cloudtrail": {
		Provider: "AWS", ServiceName: "Amazon CloudTrail", ServiceID: "cloudtrail",
		ParamifyCapability: "Audit Log Management: Amazon CloudTrail",
	},
	"aws_eks_cluster": {
		Provider: "AWS", ServiceName: "Amazon EKS", ServiceID: "eks",
		ParamifyCapability: "Alternate Processing Sites: Amazon Elastic Kubernetes Service (EKS)",
	},
	"aws_lb": {
		Provider: "AWS", ServiceName: "AWS Application Load Balancer", ServiceID: "alb",
		ParamifyCapability: "Alternate Processing Sites: AWS ALB",
	},
	"aws_alb": {
		Provider: "AWS", ServiceName: "AWS Application Load Balancer", ServiceID: "alb",
		ParamifyCapability: "Alternate Processing Sites: AWS ALB",
	},
	"aws_secretsmanager_secret": {
		Provider: "AWS", ServiceName: "Amazon Secrets Manager", ServiceID: "secretsmanager",
		ParamifyCapability: "Secrets Management: Amazon Secrets Manager",
	},
	"aws_security_group": {
		Provider: "AWS", ServiceName: "Amazon Security Groups", ServiceID: "security-groups",
		ParamifyCapability: "Network Access Control: Amazon Security Groups",
	},
	"aws_kms_key": {
		Provider: "AWS", ServiceName: "AWS KMS", ServiceID: "kms",
		ParamifyCapability: "Data Encryption: Amazon Server-Side Encryption",
	},
	"aws_s3_bucket_server_side_encryption_configuration": {
		Provider: "AWS", ServiceName: "Amazon S3 Server-Side Encryption", ServiceID: "s3-sse",
		ParamifyCapability: "Data Encryption: Amazon Server-Side Encryption",
	},
	"aws_acm_certificate": {
		Provider: "AWS", ServiceName: "AWS Certificate Manager", ServiceID: "acm",
		ParamifyCapability: "Approved Certificate Authorities: Amazon Certificate Manager (ACM)",
	},
	"aws_vpn_connection": {
		Provider: "AWS", ServiceName: "Amazon VPN", ServiceID: "vpn",
		ParamifyCapability: "Account Lockout: Amazon VPN",
	},
	"aws_client_vpn_endpoint": {
		Provider: "AWS", ServiceName: "AWS Client VPN", ServiceID: "client-vpn",
		ParamifyCapability: "Account Lockout: Amazon VPN",
	},
	"aws_ssoadmin_instance": {
		Provider: "AWS", ServiceName: "AWS IAM Identity Center", ServiceID: "iam-identity-center",
		ParamifyCapability: "Administrative Session Termination: Amazon IAM Identity Center",
	},
	"aws_identitystore_user": {
		Provider: "AWS", ServiceName: "AWS IAM Identity Center", ServiceID: "iam-identity-center",
		ParamifyCapability: "Administrative Session Termination: Amazon IAM Identity Center",
	},
	// Additional services by install base / common Paramify customer patterns
	"aws_cloudwatch_log_group": {
		Provider: "AWS", ServiceName: "Amazon CloudWatch", ServiceID: "cloudwatch",
		ParamifyCapability: "Monitoring: Amazon CloudWatch",
	},
	"aws_cloudwatch_metric_alarm": {
		Provider: "AWS", ServiceName: "Amazon CloudWatch", ServiceID: "cloudwatch",
		ParamifyCapability: "Monitoring: Amazon CloudWatch",
	},
	"aws_guardduty_detector": {
		Provider: "AWS", ServiceName: "Amazon GuardDuty", ServiceID: "guardduty",
		ParamifyCapability: "Intrusion Detection: Amazon GuardDuty",
	},
	"aws_inspector2_enabler": {
		Provider: "AWS", ServiceName: "AWS Inspector v2", ServiceID: "inspector",
		ParamifyCapability: "Vulnerability Scanning: AWS Inspector",
	},
	"aws_config_config_rule": {
		Provider: "AWS", ServiceName: "AWS Config", ServiceID: "config",
		ParamifyCapability: "Configuration Management: AWS Config",
	},
	"aws_wafv2_web_acl": {
		Provider: "AWS", ServiceName: "AWS WAF", ServiceID: "waf",
		ParamifyCapability: "Application Access Control: AWS WAF",
	},
	"aws_backup_vault": {
		Provider: "AWS", ServiceName: "AWS Backup", ServiceID: "backup",
		ParamifyCapability: "Backup & Recovery: AWS Backup",
	},
	"aws_s3_bucket": {
		Provider: "AWS", ServiceName: "Amazon S3", ServiceID: "s3",
		ParamifyCapability: "Data Storage: Amazon S3",
	},
	"aws_iam_role": {
		Provider: "AWS", ServiceName: "AWS IAM", ServiceID: "iam",
		ParamifyCapability: "Identity & Access Management: AWS IAM",
	},
	"aws_ecr_repository": {
		Provider: "AWS", ServiceName: "Amazon ECR", ServiceID: "ecr",
		ParamifyCapability: "Container Registry: Amazon ECR",
	},
	"aws_ecs_cluster": {
		Provider: "AWS", ServiceName: "Amazon ECS", ServiceID: "ecs",
		ParamifyCapability: "Container Orchestration: Amazon ECS",
	},
	"aws_macie2_account": {
		Provider: "AWS", ServiceName: "Amazon Macie", ServiceID: "macie",
		ParamifyCapability: "Data Loss Prevention: Amazon Macie",
	},
	"aws_securityhub_account": {
		Provider: "AWS", ServiceName: "AWS Security Hub", ServiceID: "securityhub",
		ParamifyCapability: "Security Posture Management: AWS Security Hub",
	},
}

// tfState is the minimal Terraform state structure needed to extract resource types.
type tfState struct {
	Resources []tfResource `json:"resources"`
}

type tfResource struct {
	Mode string `json:"mode"` // "managed", "data"
	Type string `json:"type"` // e.g. "aws_cloudtrail"
}

const (
	maxTFStateFiles = 50
	maxTFStateBytes = 10 * 1024 * 1024 // 10 MB per file
	maxTFWalkDepth  = 4
)

func awsServicesFromTerraform(roots []string) []types.CloudService {
	seen := make(map[string]bool)
	var results []types.CloudService
	fileCount := 0

	for _, root := range roots {
		if fileCount >= maxTFStateFiles {
			break
		}
		_ = walkLimited(root, maxTFWalkDepth, func(path string) {
			if fileCount >= maxTFStateFiles {
				return
			}
			if !strings.HasSuffix(path, ".tfstate") {
				return
			}
			info, err := os.Stat(path)
			if err != nil || info.Size() > maxTFStateBytes {
				return
			}
			fileCount++

			data, err := os.ReadFile(path)
			if err != nil {
				return
			}
			var state tfState
			if err := json.Unmarshal(data, &state); err != nil {
				return
			}
			for _, res := range state.Resources {
				if res.Mode != "managed" {
					continue
				}
				def, ok := awsResourceMap[res.Type]
				if !ok {
					continue
				}
				if seen[def.ServiceID] {
					continue
				}
				seen[def.ServiceID] = true
				svc := def
				svc.DetectionSource = "terraform-state"
				svc.Evidence = []string{"tfstate:" + path + ":" + res.Type}
				results = append(results, svc)
			}
		})
	}
	return results
}

// terraformSearchRoots returns the set of directory trees to search for .tfstate files.
// Limited to well-known paths to avoid full-filesystem traversal.
func terraformSearchRoots() []string {
	roots := []string{"/root", "/opt", "/etc/terraform"}

	homes, _ := filepath.Glob("/home/*")
	roots = append(roots, homes...)

	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots, cwd)
	}

	if home := os.Getenv("HOME"); home != "" {
		roots = append(roots, home)
	}

	return dedupStrings(roots)
}

// walkLimited calls fn for every file under root up to maxDepth directory levels.
func walkLimited(root string, maxDepth int, fn func(path string)) error {
	return walkDepth(root, 0, maxDepth, fn)
}

func walkDepth(dir string, depth, maxDepth int, fn func(string)) error {
	if depth > maxDepth {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())
		if entry.IsDir() {
			// Skip hidden dirs and common noise
			name := entry.Name()
			if strings.HasPrefix(name, ".") && name != ".terraform" {
				continue
			}
			if name == "node_modules" || name == "vendor" {
				continue
			}
			_ = walkDepth(path, depth+1, maxDepth, fn)
		} else {
			fn(path)
		}
	}
	return nil
}

func dedupStrings(in []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
