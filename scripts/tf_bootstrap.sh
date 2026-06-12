#!/usr/bin/env bash
# One-time bootstrap of the Terraform state backend for an environment.
# Creates the state S3 bucket and the DynamoDB lock table if they don't exist.
# Usage: scripts/tf_bootstrap.sh <dev|prd>

set -euo pipefail

ENV="${1:?usage: tf_bootstrap.sh <dev|prd>}"
REGION="ap-northeast-1"
TABLE="satellite-tracker-terraform-locks"

account_id="$(aws sts get-caller-identity --profile "$ENV" --query Account --output text)"
bucket="satellite-tracker-terraform-state-${account_id}"

echo "Bootstrapping Terraform state for env=$ENV (account $account_id)"

if aws s3api head-bucket --bucket "$bucket" --profile "$ENV" 2>/dev/null; then
  echo "state bucket $bucket already exists"
else
  echo "creating state bucket $bucket"
  aws s3api create-bucket \
    --bucket "$bucket" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" \
    --profile "$ENV"
  aws s3api put-bucket-versioning \
    --bucket "$bucket" \
    --versioning-configuration Status=Enabled \
    --profile "$ENV"
  aws s3api put-bucket-encryption \
    --bucket "$bucket" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}' \
    --profile "$ENV"
  aws s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
    --profile "$ENV"
fi

if aws dynamodb describe-table --table-name "$TABLE" --profile "$ENV" --region "$REGION" >/dev/null 2>&1; then
  echo "lock table $TABLE already exists"
else
  echo "creating lock table $TABLE"
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --profile "$ENV" \
    --region "$REGION" >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --profile "$ENV" --region "$REGION"
fi

echo "bootstrap complete for $ENV"
