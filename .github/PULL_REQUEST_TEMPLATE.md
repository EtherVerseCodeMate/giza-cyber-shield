## Summary
<!-- What does this PR do and why? -->

## Change Type
- [ ] Bug fix
- [ ] New feature
- [ ] Configuration change
- [ ] Security control / compliance
- [ ] Documentation
- [ ] Dependency update

## Security Impact Assessment
<!-- SOC 2 CC8.1 — all PRs must include this section -->

**Does this PR affect any of the following?**
- [ ] Authentication or access control (`pkg/auth/`, `pkg/rbac/`, `pkg/apiserver/`)
- [ ] Cryptographic keys or certificates (`pkg/crypto/`, `pkg/kms/`, key files)
- [ ] Encryption or data handling (`pkg/crypto/`, data storage, APIs)
- [ ] Third-party integrations or vendor dependencies (`go.mod`, `vendor/`)
- [ ] CI/CD pipeline or build process (`.github/workflows/`, `Makefile`, `Dockerfile*`)
- [ ] Network configuration (`cloudflared_config.yml`, `fly.toml`, `wrangler*.toml`)
- [ ] None of the above — low security impact

**If any box is checked, describe the security impact:**
<!--
What is the risk? How is it mitigated?
Does this require a risk re-assessment? (CC3.4 trigger)
-->

## SOC 2 Evidence
<!-- Does this PR close or advance any remediation item? -->
- Closes RM-___ (if applicable)
- SOC 2 criterion: ___

## Testing
- [ ] Unit tests pass (`go test ./...`)
- [ ] Security CI checks pass (`pre-commit-security`, `validate-build-artifacts`)
- [ ] Tested in staging environment
- [ ] No secrets or credentials committed

## Reviewers
<!-- Minimum 2 approvals required (CC8.1 branch protection) -->
