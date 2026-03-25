# GovCloud Deployment Parameter Packs

This folder contains **safe-by-default templates** for deployment parameters and environment settings used by `aws-govcloud` CloudFormation deployments.

Goals:
- Keep secrets out of source control.
- Enforce CMMC L2 / FedRAMP-aligned defaults where practical.
- Standardize reproducible deploy inputs for `us-gov-west-1`.

## Files

- `infrastructure.production.parameters.json`
- `infrastructure.production.parameters.yml`
- `services.production.parameters.json`
- `services.production.parameters.yml`
- `deploy-env.example.json`
- `deploy-env.example.yml`
- `.gitignore`

## Usage

### 1) Infrastructure stack (JSON parameter file)

```bash
aws cloudformation deploy \
  --stack-name khepra-protocol-infrastructure \
  --template-file aws-govcloud/cloudformation/khepra-govcloud-infrastructure.yaml \
  --parameter-overrides file://aws-govcloud/parameters/infrastructure.production.parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-gov-west-1
```

### 2) Services stack (JSON parameter file)

```bash
aws cloudformation deploy \
  --stack-name khepra-protocol-services \
  --template-file aws-govcloud/cloudformation/khepra-ecs-services.yaml \
  --parameter-overrides file://aws-govcloud/parameters/services.production.parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-gov-west-1
```

## Security Notes

- `AllowedCIDR` is intentionally set to a **placeholder** (`203.0.113.10/32`). Replace with your trusted admin egress CIDR(s).
- Do not place API keys, passwords, MFA seeds, tokens, or private cert material in any file here.
- Application secrets belong in AWS Secrets Manager and should be rotated per policy.
- Keep local non-template variants in `*.local.*` files; those are ignored by git.

