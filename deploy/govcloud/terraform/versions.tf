terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   bucket         = "khepra-govcloud-tfstate"
  #   key            = "terraform.tfstate"
  #   region         = "us-gov-west-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-lock"
  # }
}
