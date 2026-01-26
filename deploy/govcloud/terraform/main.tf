provider "aws" {
  region = var.aws_region
  profile = "gov-root" # Initial bootstrap profile

  default_tags {
    tags = {
      Project     = "AdinKhepra"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "NIST-800-53"
      DataClass   = "CUI"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
