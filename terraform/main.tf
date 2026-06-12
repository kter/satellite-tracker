terraform {
  required_version = ">= 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.50"
    }
  }

  # Backend configuration is provided via -backend-config flag:
  #   terraform init -backend-config=backends/dev.hcl
  backend "s3" {}
}

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "main" {
  name         = local.current_env.hosted_zone_name
  private_zone = false
}
