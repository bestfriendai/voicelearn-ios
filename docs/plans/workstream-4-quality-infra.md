# Workstream 4: Quality Infrastructure & DevOps

## Context
This is one of several parallel workstreams identified from an incomplete work audit. You are completing quality infrastructure setup.

**Note:** Several tasks require GitHub admin access to install apps.

## Tasks

### 6.1 Pre-Commit Hooks (6/8 complete)
**File:** `docs/QUALITY_INFRASTRUCTURE_PLAN.md`

**Missing:**
- Test hooks with team members
- Hook bypass logging

**Requirements:**
1. Document hook testing process
2. Add logging when hooks are bypassed (e.g., `--no-verify` used)
3. Consider adding bypass reason requirement

---

### 6.2 Dependency Automation - Renovate (2/4 complete)

**Missing (requires GitHub admin):**
- Enable Renovate GitHub App on repository
- Verify first Renovate PRs

**Requirements:**
1. If you have access: Install Renovate GitHub App
2. If not: Document steps for admin to complete
3. Configuration already exists in `renovate.json`

---

### 6.3 Coverage Enforcement (3/7 complete) (P1)

**Missing:**
- Coverage badge to README
- Codecov integration
- Python server coverage
- Web client coverage

**Requirements:**
1. Add coverage badge to main README.md
2. Set up Codecov integration (may need GitHub admin)
3. Configure pytest-cov for Python server tests
4. Configure Jest coverage for web client

---

### 6.4 CodeRabbit AI Review (5/7 complete)

**Missing (requires GitHub admin):**
- Install CodeRabbit GitHub App on repository
- Install on Android client repository
- Review and tune configuration based on 10 PRs

**Requirements:**
1. Configuration exists at `.coderabbit.yaml`
2. If you have access: Install CodeRabbit app
3. If not: Document steps for admin

---

### 6.5 Feature Flag Unit Tests

**Missing:**
- iOS SDK unit tests for feature flag service
- Web SDK unit tests

**Files:**
- iOS: `UnaMentis/Services/FeatureFlags/FeatureFlagService.swift`
- Web: `server/web/src/` (find feature flag usage)

**Requirements:**
1. Create unit tests for iOS FeatureFlagService
2. Create unit tests for web feature flag hooks/services
3. Test context evaluation, caching, offline mode

---

### 7.1 Mutation Testing (0/4 complete) (P3)

**Requirements:**
1. Create `.github/workflows/mutation.yml`
2. Evaluate Muter for Swift mutation testing
3. Set up mutmut for Python
4. Set up Stryker for Web/TypeScript

---

### 7.2 Voice Pipeline Resilience Testing (0/5 complete) (P3)

**Requirements:**
1. Create network degradation test harness
2. Test scenarios: high latency, packet loss, disconnection
3. Test API timeout handling
4. Test graceful degradation paths
5. Create chaos engineering runbook

---

## Verification

After completing each task:
1. Run `/validate` to ensure lint and tests pass
2. For coverage: Check coverage reports generated
3. For GitHub apps: Verify they appear in repository settings
4. For mutation testing: Run mutation tests and review survival rates
5. For resilience testing: Run degradation scenarios and verify graceful handling
