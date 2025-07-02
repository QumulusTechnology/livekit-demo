# Configuration Guide for LiveKit Demo

This document explains how to configure the LiveKit demo deployment for different domains and environments.

## Current Architecture

The deployment uses hardcoded values in individual service `values.yaml` files. While we've prepared a global configuration structure, the proper implementation requires passing values through ArgoCD applications.

## Global Configuration Structure

The `chart/values.yaml` contains a global configuration structure:

```yaml
global:
  domain: "livekit-demo.cloudportal.app"
  registry:
    domain: "repo.livekit-demo.cloudportal.app"
  services:
    livekit:
      wsUrl: "wss://livekit.livekit-demo.cloudportal.app"
    redis:
      namespace: redis
      serviceName: redis-redis-cluster
    minio:
      namespace: minio-tenant
      serviceName: minio
```

## Why Values Are Hardcoded

1. **Helm Values Limitation**: The `values.yaml` files cannot use Helm template syntax (e.g., `{{ .Values.global.domain }}`)
2. **ArgoCD Multi-Source**: Many apps use multi-source configurations where value passing is complex
3. **Service Independence**: Each service can be deployed independently

## How to Change Domain

To deploy to a different domain, you need to update these files:

### 1. Core Services Chart
- `/chart/values.yaml` - Update domain and letsencrypt_email

### 2. Service Values Files
Update domain references in:
- `/services/livekit/values.yaml`
- `/services/livekit-egress/values.yaml`
- `/services/livekit-ingress/values.yaml`
- `/services/meet-client/values.yaml`
- `/services/trivoh-api/values.yaml`
- `/services/trivoh/values.yaml`
- `/services/minio-operator/values.yaml`

### 3. Manifest Values Files
- `/services/cert-manager/manifests/values.yaml`
- `/services/minio-tenant/manifests/values.yaml`
- `/services/meet-client/manifests/values.yaml`
- `/services/trivoh/manifests/values.yaml`

### 4. Ingress Templates
- `/services/livekit/manifests/templates/ingress.yaml`
- `/services/minio-operator/manifests/templates/ingress.yaml`

## Future Improvements

### Option 1: ArgoCD Application Sets
Use ApplicationSets to template values across all applications:

```yaml
spec:
  generators:
  - git:
      repoURL: https://github.com/QumulusTechnology/livekit-demo.git
      revision: main
      files:
      - path: "environments/*/config.yaml"
  template:
    spec:
      source:
        helm:
          values: |
            domain: {{ .domain }}
            registry: {{ .registry }}
```

### Option 2: Helm Umbrella Chart
Create a single Helm chart that deploys all services with shared values:

```yaml
# values.yaml
global:
  domain: livekit-demo.cloudportal.app

livekit:
  enabled: true
  wsUrl: "wss://livekit.{{ .Values.global.domain }}"

meet-client:
  enabled: true
  ingress:
    host: "meet.{{ .Values.global.domain }}"
```

### Option 3: Kustomize Overlays
Use Kustomize to patch values for different environments:

```yaml
# overlays/production/kustomization.yaml
patches:
- patch: |-
    - op: replace
      path: /data/domain
      value: production.example.com
  target:
    kind: ConfigMap
    name: global-config
```

## Current Workaround

For now, use a script to update all hardcoded values:

```bash
#!/bin/bash
OLD_DOMAIN="livekit-demo.cloudportal.app"
NEW_DOMAIN="your-domain.com"

# Update all occurrences
find services/ -name "*.yaml" -type f -exec sed -i "s/$OLD_DOMAIN/$NEW_DOMAIN/g" {} +
find chart/ -name "*.yaml" -type f -exec sed -i "s/$OLD_DOMAIN/$NEW_DOMAIN/g" {} +

# Commit and push
git add -A
git commit -m "Update domain to $NEW_DOMAIN"
git push
```

## Best Practices

1. **Test in Staging**: Always test domain changes in a staging environment first
2. **Update Certificates**: Ensure cert-manager can issue certificates for the new domain
3. **DNS Configuration**: Set up proper DNS records before deployment
4. **Monitor Logs**: Check ingress-nginx and cert-manager logs during domain changes