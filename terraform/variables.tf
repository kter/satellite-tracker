variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project identifier used in resource names"
  type        = string
  default     = "satellite-tracker"
}

locals {
  env_config = {
    dev = {
      domain_name      = "satellite.dev.devtools.site"
      hosted_zone_name = "dev.devtools.site"
      enable_noindex   = true
    }
    prd = {
      domain_name      = "satellite.devtools.site"
      hosted_zone_name = "devtools.site"
      enable_noindex   = false
    }
  }
  current_env = local.env_config[terraform.workspace]
}
