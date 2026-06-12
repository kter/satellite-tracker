SHELL := /bin/bash
.DEFAULT_GOAL := help

ENV ?= dev
MISE := mise exec --

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

.PHONY: dev
dev: ## Run Vite dev server (http://localhost:5173)
	$(MISE) npm run dev

.PHONY: build
build: ## Type-check and build production bundle into dist/
	$(MISE) npm run build

.PHONY: format
format: ## Format all files with prettier
	$(MISE) npm run format

.PHONY: format-check
format-check: ## Check formatting
	$(MISE) npm run format:check

.PHONY: test-lint
test-lint: ## Run eslint
	$(MISE) npm run lint

.PHONY: test-unit
test-unit: ## Run unit tests (vitest)
	$(MISE) npm run test

# ---------------------------------------------------------------------------
# Local stack & E2E
# ---------------------------------------------------------------------------

.PHONY: local-up
local-up: ## Build and start the production-like local stack (nginx on :8080)
	docker compose up -d --build --wait

.PHONY: local-down
local-down: ## Stop the local stack
	docker compose down

.PHONY: e2e-local
e2e-local: local-up ## Run Playwright E2E against the local docker stack
	E2E_TARGET=local $(MISE) npx playwright test $(TEST_ARGS); status=$$?; \
	docker compose down; exit $$status

.PHONY: e2e
e2e: ## Run Playwright E2E against ENV (dev|prd): make e2e ENV=dev
	E2E_TARGET=$(ENV) $(MISE) npx playwright test $(TEST_ARGS)

# ---------------------------------------------------------------------------
# Terraform / deploy  (workspace name == AWS profile name: dev / prd)
# ---------------------------------------------------------------------------

.PHONY: tf-bootstrap
tf-bootstrap: ## One-time: create Terraform state bucket + lock table for ENV
	./scripts/tf_bootstrap.sh $(ENV)

.PHONY: tf-switch
tf-switch: ## Init backend for ENV and select matching workspace
	@cd terraform && \
	current=$$(terraform workspace show 2>/dev/null || echo none); \
	if [ "$$current" != "$(ENV)" ]; then \
		$(MISE) terraform init -reconfigure -backend-config=backends/$(ENV).hcl -input=false && \
		($(MISE) terraform workspace select $(ENV) 2>/dev/null || $(MISE) terraform workspace new $(ENV)); \
	fi

.PHONY: tf-plan
tf-plan: tf-switch ## Terraform plan for ENV
	cd terraform && $(MISE) terraform plan

.PHONY: tf-apply
tf-apply: tf-switch ## Terraform apply for ENV
	cd terraform && $(MISE) terraform apply -auto-approve

.PHONY: tf-output
tf-output: tf-switch ## Show Terraform outputs for ENV
	cd terraform && $(MISE) terraform output

.PHONY: deploy
deploy: tf-switch build ## Build and deploy frontend to ENV (S3 sync + CloudFront invalidation)
	@bucket=$$(cd terraform && $(MISE) terraform output -raw frontend_bucket_name); \
	dist_id=$$(cd terraform && $(MISE) terraform output -raw cloudfront_distribution_id); \
	echo "Deploying dist/ to s3://$$bucket (profile $(ENV))"; \
	$(MISE) aws s3 sync dist/ "s3://$$bucket" --delete --profile $(ENV) && \
	$(MISE) aws cloudfront create-invalidation --distribution-id "$$dist_id" --paths '/*' --profile $(ENV) --output text > /dev/null && \
	echo "Deployed + invalidated ($(ENV))"

# ---------------------------------------------------------------------------
# Claude Code hooks
# ---------------------------------------------------------------------------

.PHONY: claude-pre-tool-use
claude-pre-tool-use: ## Block destructive Claude Bash commands based on CLAUDE_HOOK_COMMAND
	@python3 scripts/claude_pre_tool_use_guard.py

.PHONY: claude-post-tool-use
claude-post-tool-use: ## Hook-safe format/lint for a single edited file (FILE_PATH=...)
	@if [ -z "$(FILE_PATH)" ]; then echo "FILE_PATH is required"; exit 1; fi
	@if [ ! -d node_modules ]; then exit 0; fi
	@file_path="$(FILE_PATH)"; \
	case "$$file_path" in \
		*.ts|*.tsx) \
			$(MISE) npx prettier --log-level silent --write "$$file_path" 2>/dev/null; \
			$(MISE) npx eslint --no-warn-ignored --fix "$$file_path" >/dev/null 2>&1 || true ;; \
		*.css|*.json|*.md|*.html|*.yml|*.yaml) \
			$(MISE) npx prettier --log-level silent --write "$$file_path" 2>/dev/null || true ;; \
		terraform/*.tf) \
			$(MISE) terraform fmt "$$file_path" >/dev/null 2>&1 || true ;; \
	esac

.PHONY: stop-hook-unit-tests
stop-hook-unit-tests: ## Run unit tests for the Stop hook (skips before scaffold is complete)
	@if [ ! -d node_modules ] || [ ! -f vitest.config.ts ]; then echo "skip: project not ready"; exit 0; fi
	@$(MISE) npm run -s test
