# =============================================================================
# KHEPRA PROTOCOL - AWS Secrets Manager Configuration
# =============================================================================
# Compliance: NIST 800-171 3.13.x, CMMC SC.L2-3.13.x, SOC-2 CC6.7
# =============================================================================

# KMS Key for Secrets Encryption
resource "aws_kms_key" "secrets" {
  description             = "KMS key for Khepra Protocol secrets encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:${local.aws_partition}:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Task Execution Role"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task_execution.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name       = "${var.project_name}-secrets-key"
    Compliance = "NIST-800-171-3.13.11"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# =============================================================================
# APPLICATION SECRETS
# =============================================================================

# Supabase Configuration
resource "aws_secretsmanager_secret" "supabase" {
  name        = "${var.project_name}/api/supabase"
  description = "Supabase connection configuration"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Application = "khepra-api"
    Compliance  = "NIST-800-171-3.13.10"
  }
}

resource "aws_secretsmanager_secret_version" "supabase" {
  secret_id = aws_secretsmanager_secret.supabase.id
  secret_string = jsonencode({
    SUPABASE_URL      = "REPLACE_ME_SUPABASE_URL"
    SUPABASE_ANON_KEY = "REPLACE_ME_SUPABASE_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# AI API Keys
resource "aws_secretsmanager_secret" "ai_keys" {
  name        = "${var.project_name}/api/ai-keys"
  description = "AI service API keys (OpenAI, xAI)"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Application = "khepra-api"
    Compliance  = "NIST-800-171-3.13.10"
  }
}

resource "aws_secretsmanager_secret_version" "ai_keys" {
  secret_id = aws_secretsmanager_secret.ai_keys.id
  secret_string = jsonencode({
    OPENAI_API_KEY = "REPLACE_ME_OPENAI_KEY"
    XAI_API_KEY    = "REPLACE_ME_XAI_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Payment Processing
resource "aws_secretsmanager_secret" "stripe" {
  name        = "${var.project_name}/api/stripe"
  description = "Stripe payment processing keys"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Application = "khepra-api"
    Compliance  = "PCI-DSS"
  }
}

resource "aws_secretsmanager_secret_version" "stripe" {
  secret_id = aws_secretsmanager_secret.stripe.id
  secret_string = jsonencode({
    STRIPE_SECRET_KEY      = "REPLACE_ME_STRIPE_SECRET"
    STRIPE_WEBHOOK_SECRET  = "REPLACE_ME_STRIPE_WEBHOOK"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# POST-QUANTUM CRYPTOGRAPHY KEYS
# =============================================================================

# ML-DSA-65 Master Signing Key (CRITICAL - License Authority)
resource "aws_secretsmanager_secret" "pqc_master" {
  name        = "${var.project_name}/pqc/master-key"
  description = "ML-DSA-65 Master Private Key for license signing"
  kms_key_id  = aws_kms_key.secrets.arn

  # Extended recovery window for critical keys
  recovery_window_in_days = 30

  tags = {
    Application = "khepra-license"
    Compliance  = "NIST-FIPS-204"
    Critical    = "true"
  }
}

# Note: Master key should be imported manually, never stored in Terraform state
# aws secretsmanager put-secret-value --secret-id khepra/pqc/master-key --secret-string "$(cat keys/offline/OFFLINE_ROOT_KEY)"

# Telemetry Signing Key
resource "aws_secretsmanager_secret" "pqc_telemetry" {
  name        = "${var.project_name}/pqc/telemetry-key"
  description = "Dilithium3 key for telemetry signature verification"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Application = "khepra-telemetry"
    Compliance  = "NIST-FIPS-204"
  }
}

# =============================================================================
# DATABASE CREDENTIALS (if using RDS)
# =============================================================================

resource "aws_secretsmanager_secret" "database" {
  count       = var.enable_rds ? 1 : 0
  name        = "${var.project_name}/db/credentials"
  description = "PostgreSQL database credentials"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Application = "khepra-database"
    Compliance  = "NIST-800-171-3.13.10"
  }
}

# =============================================================================
# SECRET ROTATION CONFIGURATION
# =============================================================================

# Lambda for rotating API keys
resource "aws_secretsmanager_secret_rotation" "ai_keys" {
  count               = var.enable_secret_rotation ? 1 : 0
  secret_id           = aws_secretsmanager_secret.ai_keys.id
  rotation_lambda_arn = aws_lambda_function.secret_rotator[0].arn

  rotation_rules {
    automatically_after_days = 90
  }
}

# =============================================================================
# IAM POLICY FOR SECRET ACCESS
# =============================================================================

resource "aws_iam_policy" "secrets_read" {
  name        = "${var.project_name}-secrets-read"
  description = "Allow reading Khepra Protocol secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.supabase.arn,
          aws_secretsmanager_secret.ai_keys.arn,
          aws_secretsmanager_secret.stripe.arn
        ]
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = [aws_kms_key.secrets.arn]
      }
    ]
  })
}

# Separate policy for PQC keys (more restricted)
resource "aws_iam_policy" "pqc_secrets_read" {
  name        = "${var.project_name}-pqc-secrets-read"
  description = "Allow reading PQC cryptographic keys (restricted)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadPQCSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.pqc_master.arn,
          aws_secretsmanager_secret.pqc_telemetry.arn
        ]
        Condition = {
          StringEquals = {
            "secretsmanager:ResourceTag/Application" = ["khepra-license", "khepra-telemetry"]
          }
        }
      }
    ]
  })
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "secrets_kms_key_arn" {
  description = "ARN of the KMS key used for secrets encryption"
  value       = aws_kms_key.secrets.arn
}

output "supabase_secret_arn" {
  description = "ARN of the Supabase configuration secret"
  value       = aws_secretsmanager_secret.supabase.arn
}

output "ai_keys_secret_arn" {
  description = "ARN of the AI API keys secret"
  value       = aws_secretsmanager_secret.ai_keys.arn
}

output "pqc_master_secret_arn" {
  description = "ARN of the PQC master key secret"
  value       = aws_secretsmanager_secret.pqc_master.arn
  sensitive   = true
}
