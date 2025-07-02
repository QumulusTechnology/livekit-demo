# MinIO CA Certificate Sharing Configuration

This document explains how the MinIO tenant CA certificate is shared between namespaces.

## Overview

The MinIO tenant generates its own CA certificate that needs to be trusted by the MinIO operator running in a different namespace. This is achieved using External Secrets Operator.

## Components

### 1. CA Certificate Generation (minio-tenant namespace)
- **File**: `ca-cert.yaml`
- **Creates**: Certificate resource that generates `minio-tenant-ca-tls` secret
- **Location**: `minio-tenant` namespace

### 2. ClusterSecretStore
- **File**: `ClusterSecretStore.yaml`
- **Name**: `minio-tenant-secrets-store`
- **Purpose**: Provides read access to secrets in `minio-tenant` namespace
- **Service Account**: `external-secrets-credentials` with appropriate RBAC

### 3. ExternalSecret (minio-operator namespace)
- **File**: `services/minio-operator/manifests/templates/minio-tenant-ca.yaml`
- **Creates**: `operator-ca-tls-minio-tenant` secret in `minio-operator` namespace
- **Source**: Reads `minio-tenant-ca-tls` from `minio-tenant` namespace via ClusterSecretStore

## Data Flow

```
minio-tenant namespace:
  Certificate (ca-cert.yaml)
    ↓ generates
  Secret: minio-tenant-ca-tls
    ↓ read by
  ClusterSecretStore: minio-tenant-secrets-store
    ↓ provides to
minio-operator namespace:
  ExternalSecret: minio-tenant-ca
    ↓ creates
  Secret: operator-ca-tls-minio-tenant
```

## Key Points

1. The CA certificate is generated once in the tenant namespace
2. External Secrets handles the cross-namespace copying
3. The operator namespace gets a read-only copy
4. Updates to the source certificate are automatically synced (1h refresh interval)
5. No direct cross-namespace secret access is required

## Troubleshooting

Check ExternalSecret status:
```bash
kubectl get externalsecret minio-tenant-ca -n minio-operator -o jsonpath='{.status.conditions[0]}'
```

Verify secrets exist:
```bash
# Source secret
kubectl get secret minio-tenant-ca-tls -n minio-tenant

# Destination secret
kubectl get secret operator-ca-tls-minio-tenant -n minio-operator
```