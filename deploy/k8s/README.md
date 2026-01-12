# AdinKhepra Iron Bank - Kubernetes Deployment

This directory contains Kubernetes manifests for deploying AdinKhepra in DoD Platform One environments.

## Deployment Models

AdinKhepra supports three deployment patterns documented in **TC 25-ADINKHEPRA-001 Section 2-1**:

- **KHEPRA-EDGE**: On-premise binary (not Kubernetes-based)
- **KHEPRA-HYBRID**: Local execution with PQC-encrypted remote advisory (not Kubernetes-based)
- **KHEPRA-SOVEREIGN**: Dedicated cloud deployment (THIS MANIFEST)

## Prerequisites

### Platform One Access
- GitLab account on `repo1.dso.mil`
- Harbor registry access to `registry1.dso.mil`
- Kubernetes cluster with Platform One baseline

### Required Tools
```bash
kubectl version --client  # v1.25+
helm version              # v3.10+ (optional, for Helm chart)
```

### Storage Class Configuration

The StatefulSet requires a StorageClass supporting `ReadWriteOnce` access:

| Cloud Provider | Recommended StorageClass |
|----------------|-------------------------|
| AWS GovCloud | `gp3` or `io2` |
| Azure Gov | `managed-premium` |
| VMware vSphere | `thin` or `thick` |
| On-Premise | `local-storage` or `nfs` |

Verify available storage classes:
```bash
kubectl get storageclass
```

Update `statefulset.yaml` line 218 with your environment's storage class:
```yaml
storageClassName: gp3  # Change to match your environment
```

## Deployment Instructions

### Step 1: Create Namespace

```bash
kubectl apply -f namespace.yaml
```

Verify namespace creation:
```bash
kubectl get namespace adinkhepra-system
```

### Step 2: Create License Secret

**Option A: From license file**
```bash
kubectl create secret generic adinkhepra-license \
  --from-file=license.jwt=/path/to/your/license.jwt \
  -n adinkhepra-system
```

**Option B: From base64-encoded string**
```bash
LICENSE_JWT=$(cat /path/to/license.jwt | base64 -w0)
kubectl create secret generic adinkhepra-license \
  --from-literal=license.jwt="$LICENSE_JWT" \
  -n adinkhepra-system
```

**Option C: Community/Development Mode (No License)**

If using Community Edition or development mode, create empty secret:
```bash
kubectl create secret generic adinkhepra-license \
  --from-literal=license.jwt="" \
  -n adinkhepra-system

# Set development mode environment variable in StatefulSet
# Add to spec.template.spec.containers[0].env:
- name: ADINKHEPRA_DEV
  value: "1"
```

### Step 3: (Optional) Create Registry Pull Secret

If deploying outside Platform One network:

```bash
kubectl create secret docker-registry ironbank-pull-secret \
  --docker-server=registry1.dso.mil \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_CLI_SECRET \
  --docker-email=YOUR_EMAIL \
  -n adinkhepra-system
```

Then uncomment `imagePullSecrets` in `statefulset.yaml`:
```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: ironbank-pull-secret
```

### Step 4: Deploy StatefulSet

```bash
kubectl apply -f statefulset.yaml
```

Monitor deployment:
```bash
# Watch pod creation
kubectl get pods -n adinkhepra-system -w

# Check StatefulSet status
kubectl get statefulset adinkhepra-node -n adinkhepra-system

# View PersistentVolumeClaim
kubectl get pvc -n adinkhepra-system
```

### Step 5: Verify Storage Persistence

Validate ECR-01 compliance:

```bash
# Get pod name
POD=$(kubectl get pod -n adinkhepra-system -l app=adinkhepra -o jsonpath='{.items[0].metadata.name}')

# Check storage path
kubectl exec -n adinkhepra-system $POD -- ls -la /var/lib/adinkhepra/data

# Verify writable
kubectl exec -n adinkhepra-system $POD -- touch /var/lib/adinkhepra/data/.write-test
kubectl exec -n adinkhepra-system $POD -- rm /var/lib/adinkhepra/data/.write-test
```

### Step 6: Test Pod Restart (Ephemeral Safety)

Verify data persists across pod restarts (ECR-01 requirement):

```bash
# Create test data
kubectl exec -n adinkhepra-system $POD -- /usr/local/bin/adinkhepra stig scan -root /etc -out /var/lib/adinkhepra/data/test-report.json

# Delete pod (StatefulSet will recreate)
kubectl delete pod $POD -n adinkhepra-system

# Wait for new pod
kubectl wait --for=condition=ready pod -l app=adinkhepra -n adinkhepra-system --timeout=120s

# Verify data survived
NEW_POD=$(kubectl get pod -n adinkhepra-system -l app=adinkhepra -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n adinkhepra-system $NEW_POD -- ls -la /var/lib/adinkhepra/data/test-report.json
```

## Accessing the Application

### Port Forwarding (Development)

```bash
# Forward agent port
kubectl port-forward -n adinkhepra-system svc/adinkhepra 45444:45444

# In another terminal, use CLI
adinkhepra health --remote localhost:45444
```

### Service Exposure (Production)

For production access, create a LoadBalancer or Ingress:

**LoadBalancer Example:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: adinkhepra-lb
  namespace: adinkhepra-system
spec:
  type: LoadBalancer
  selector:
    app: adinkhepra
  ports:
  - port: 45444
    targetPort: 45444
```

**Ingress Example (with mTLS):**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: adinkhepra-ingress
  namespace: adinkhepra-system
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    nginx.ingress.kubernetes.io/auth-tls-verify-client: "on"
spec:
  ingressClassName: nginx
  rules:
  - host: adinkhepra.apps.mil
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: adinkhepra
            port:
              number: 45444
```

## Monitoring & Observability

### View Logs (ECR-03 Compliance)

All logs stream to stdout for EFK stack ingestion:

```bash
# Follow logs
kubectl logs -n adinkhepra-system -l app=adinkhepra -f

# View last 100 lines
kubectl logs -n adinkhepra-system $POD --tail=100

# Export logs to file
kubectl logs -n adinkhepra-system $POD > adinkhepra.log
```

### Health Checks

```bash
# Liveness probe (app running)
kubectl exec -n adinkhepra-system $POD -- /usr/local/bin/adinkhepra health

# Readiness probe (storage accessible)
kubectl exec -n adinkhepra-system $POD -- /usr/local/bin/adinkhepra validate
```

### Resource Usage

```bash
# CPU and memory usage
kubectl top pod -n adinkhepra-system $POD

# Storage usage
kubectl exec -n adinkhepra-system $POD -- df -h /var/lib/adinkhepra/data
```

## Scaling Considerations

### Vertical Scaling (Increase Resources)

Edit `statefulset.yaml` resources section:
```yaml
resources:
  requests:
    cpu: "1000m"      # Increase from 500m
    memory: "1Gi"     # Increase from 512Mi
  limits:
    cpu: "4000m"      # Increase from 2000m
    memory: "4Gi"     # Increase from 2Gi
```

Apply changes:
```bash
kubectl apply -f statefulset.yaml
kubectl rollout status statefulset adinkhepra-node -n adinkhepra-system
```

### Horizontal Scaling (Multiple Replicas)

**WARNING**: AdinKhepra StatefulSet uses `ReadWriteOnce` PVC. Each replica requires a separate PVC.

For multi-replica deployment:
1. Change `spec.replicas` in statefulset.yaml
2. Ensure license supports multi-node deployment (HSM Edition)
3. Configure federated coordinator (TC 25-ADINKHEPRA-001 Section 2-1)

```yaml
spec:
  replicas: 3  # Creates adinkhepra-node-0, adinkhepra-node-1, adinkhepra-node-2
```

Each pod gets its own PVC: `dag-store-adinkhepra-node-0`, `dag-store-adinkhepra-node-1`, etc.

### Storage Expansion

Expand PVC without downtime (if StorageClass supports `allowVolumeExpansion: true`):

```bash
# Check if expansion is supported
kubectl get storageclass gp3 -o jsonpath='{.allowVolumeExpansion}'

# Edit PVC
kubectl edit pvc dag-store-adinkhepra-node-0 -n adinkhepra-system

# Change storage request (e.g., 10Gi -> 20Gi)
spec:
  resources:
    requests:
      storage: 20Gi

# Verify expansion
kubectl get pvc -n adinkhepra-system
```

## Troubleshooting

### Pod Not Starting

**Check events:**
```bash
kubectl describe pod $POD -n adinkhepra-system
```

**Common issues:**
- **ImagePullBackOff**: Missing `ironbank-pull-secret` or incorrect credentials
- **CrashLoopBackOff**: Storage path not writable (ECR-01 failure)
- **Pending**: PVC not bound (check StorageClass availability)

### Storage Not Persisting

**Verify PVC binding:**
```bash
kubectl get pvc -n adinkhepra-system
# STATUS should be "Bound"
```

**Check PersistentVolume:**
```bash
PV=$(kubectl get pvc dag-store-adinkhepra-node-0 -n adinkhepra-system -o jsonpath='{.spec.volumeName}')
kubectl describe pv $PV
```

**Test write permissions:**
```bash
kubectl exec -n adinkhepra-system $POD -- id
# Should show uid=1001(adinkhepra)

kubectl exec -n adinkhepra-system $POD -- ls -ld /var/lib/adinkhepra/data
# Should show drwxr-x--- 1001 1001
```

### FIPS Mode Not Enabled

**Verify BoringCrypto build (ECR-02):**
```bash
kubectl exec -n adinkhepra-system $POD -- /usr/local/bin/adinkhepra version
# Should show "FIPS: Enabled"
```

If FIPS is disabled, rebuild binary with:
```bash
GOEXPERIMENT=boringcrypto CGO_ENABLED=1 go build -tags=fips ./cmd/adinkhepra
```

### License Issues

**Check license secret:**
```bash
kubectl get secret adinkhepra-license -n adinkhepra-system -o jsonpath='{.data.license\.jwt}' | base64 -d
```

**View license validation errors:**
```bash
kubectl logs -n adinkhepra-system $POD | grep -i license
```

**Community Edition fallback:**
```bash
kubectl set env statefulset/adinkhepra-node ADINKHEPRA_DEV=1 -n adinkhepra-system
```

## Security Hardening

### Network Policies

The included `NetworkPolicy` restricts traffic to:
- DNS (kube-system namespace)
- HTTPS egress (license server)
- Agent port ingress (within namespace)

Customize `statefulset.yaml` lines 290-320 for your environment.

### Pod Security Standards

Namespace enforces `restricted` PSS profile (most secure):
- No privileged containers
- No host network/PID/IPC
- Must run as non-root (UID 1001)
- ReadOnlyRootFilesystem enforced

### RBAC Least Privilege

The `adinkhepra-scanner` ClusterRole grants **read-only** access to:
- Pods, Services, ConfigMaps (not Secrets' data)
- Deployments, StatefulSets, DaemonSets
- NetworkPolicies, PodSecurityPolicies

**To restrict further**, change ClusterRoleBinding to RoleBinding:
```bash
kubectl delete clusterrolebinding adinkhepra-scanner
kubectl create rolebinding adinkhepra-scanner \
  --clusterrole=adinkhepra-scanner \
  --serviceaccount=adinkhepra-system:adinkhepra \
  -n adinkhepra-system
```

## Uninstallation

### Delete Application (Preserve Data)

```bash
kubectl delete statefulset adinkhepra-node -n adinkhepra-system
kubectl delete service adinkhepra -n adinkhepra-system
```

PVC remains intact. Redeploy to recover data.

### Full Deletion (INCLUDING DATA)

**WARNING**: This deletes all compliance reports and DAG history.

```bash
kubectl delete namespace adinkhepra-system
```

PVCs are deleted automatically with namespace (unless `persistentVolumeReclaimPolicy: Retain`).

## References

- **TC 25-ADINKHEPRA-001**: Operator manual (request from account manager)
- **DoD DevSecOps Reference Design**: https://dodcio.defense.gov/Portals/0/Documents/Library/DevSecOpsRefDesign.pdf
- **Platform One Documentation**: https://p1.dso.mil
- **Iron Bank Hardening Guide**: https://repo1.dso.mil/dsop/dccscr

## Support

- **Technical Issues**: cyber@nouchix.com
- **Iron Bank Pipeline**: ironbank@dso.mil
- **Platform One Support**: https://chat.il2.dso.mil (Mattermost)
