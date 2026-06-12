# Workspace-aware provider configuration: the AWS profile name matches the
# workspace name (dev/prd), same convention as the notes project.
provider "aws" {
  region  = var.aws_region
  profile = terraform.workspace

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = terraform.workspace
      ManagedBy   = "terraform"
    }
  }
}

# ACM certificates for CloudFront must live in us-east-1.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = terraform.workspace

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = terraform.workspace
      ManagedBy   = "terraform"
    }
  }
}
