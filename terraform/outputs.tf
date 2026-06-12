output "frontend_bucket_name" {
  description = "S3 bucket receiving the built frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.main.id
}

output "site_url" {
  description = "Public URL of the deployed site"
  value       = "https://${local.current_env.domain_name}"
}
