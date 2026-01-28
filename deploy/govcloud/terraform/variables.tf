# =============================================================================
# KHEPRA PROTOCOL - Terraform Variables
# =============================================================================
# AWS GovCloud Configuration for FedRAMP High / IL4-IL5 Compliance
# =============================================================================

# -----------------------------------------------------------------------------
# Core Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS GovCloud Region"
  type        = string
  default     = "us-gov-west-1"

  validation {
    condition     = can(regex("^us-gov-", var.aws_region)) || var.aws_region == "us-east-1" || var.aws_region == "us-west-2"
    error_message = "Region must be a GovCloud region (us-gov-*) or approved commercial region."
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "khepra-protocol"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs for network monitoring (FedRAMP AU-12)"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "enable_rds" {
  description = "Enable RDS PostgreSQL database"
  type        = bool
  default     = false
}

variable "enable_eks" {
  description = "Enable EKS Kubernetes cluster"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Security & Compliance Configuration
# -----------------------------------------------------------------------------

variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation (90-day cycle)"
  type        = bool
  default     = true
}

variable "enable_security_hub" {
  description = "Enable AWS Security Hub for compliance monitoring"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config for configuration compliance"
  type        = bool
  default     = true
}

variable "enable_fips" {
  description = "Enforce FIPS 140-2 compliant endpoints"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Tagging Configuration
# -----------------------------------------------------------------------------

variable "compliance_tags" {
  description = "Compliance framework tags"
  type        = map(string)
  default = {
    Compliance       = "NIST-800-171"
    DataClass        = "CUI"
    FedRAMPBaseline  = "High"
    CMMCLevel        = "3"
  }
}

# -----------------------------------------------------------------------------
# Alert Configuration
# -----------------------------------------------------------------------------

variable "security_alert_email" {
  description = "Email address for security alerts"
  type        = string
  default     = "hello@souhimbou.com"
}

variable "enable_pagerduty" {
  description = "Enable PagerDuty integration for critical alerts"
  type        = bool
  default     = false
}
