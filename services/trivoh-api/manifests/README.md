# Trivoh API Helm Chart

This Helm chart deploys the Trivoh API backend application with MySQL database and all necessary supporting resources.

## Chart Features

- **Production-ready deployment** with proper health checks and resource limits
- **MySQL database** with persistent storage and automatic password generation
- **Database migrations** using ArgoCD hooks for safe schema updates
- **Horizontal Pod Autoscaling** based on CPU and memory utilization
- **Prometheus monitoring** with ServiceMonitor integration
- **Ingress configuration** with TLS termination
- **External Secrets Operator** integration for secure credential management

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- ArgoCD (for GitOps deployment)
- External Secrets Operator
- cert-manager (for TLS certificates)
- Prometheus Operator (for monitoring)

## Installation

```bash
# Add the repository
helm repo add trivoh-api https://charts.livekit-demo.cloudportal.app

# Install the chart
helm install trivoh-api trivoh-api/trivoh-api \
  --namespace trivoh-api \
  --create-namespace \
  --values values.yaml
```

## Configuration

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.registry` | Container registry | `repo.livekit-demo.cloudportal.app` |
| `image.repository` | Container repository | `library/trivoh-api` |
| `image.tag` | Container tag | `latest` |
| `replicaCount` | Number of replicas | `1` |
| `autoscaling.enabled` | Enable HPA | `true` |
| `autoscaling.minReplicas` | Minimum replicas | `1` |
| `autoscaling.maxReplicas` | Maximum replicas | `3` |
| `resources.limits.cpu` | CPU limit | `2000m` |
| `resources.limits.memory` | Memory limit | `4Gi` |
| `monitoring.enabled` | Enable Prometheus monitoring | `true` |

### Environment Variables

The chart includes comprehensive environment variable configuration for:
- Database connection settings
- LiveKit integration
- Redis configuration
- Performance tuning
- Foreign key constraints

### Health Checks

- **Liveness Probe**: `/health` endpoint with 120s initial delay
- **Readiness Probe**: `/ready` endpoint with 90s initial delay
- **Database Health**: Init container ensures MySQL is ready before app starts

## Architecture

### Components

1. **Main Application**: Node.js API server with clustering
2. **MySQL Database**: Persistent database with automatic initialization
3. **Migration Job**: ArgoCD PreSync hook for schema updates
4. **Monitoring**: Prometheus metrics and ServiceMonitor
5. **Ingress**: Nginx ingress with TLS termination
6. **Autoscaling**: HPA based on resource utilization

### Resource Dependencies

```
trivoh-api
├── mysql (database)
├── migration-job (schema updates)
├── service (load balancer)
├── ingress (external access)
├── hpa (autoscaling)
└── servicemonitor (monitoring)
```

## Database Management

### Migration Strategy

- Uses ArgoCD PreSync hooks for safe deployments
- Automatic schema updates with `alter: true`
- Foreign key checks disabled during migration
- Rollback-safe with proper error handling

### Backup Considerations

- MySQL data is stored in persistent volumes
- Consider implementing regular backups
- Monitor storage usage and plan for growth

## Monitoring

### Metrics

- Application metrics on port 9092
- Prometheus scraping enabled
- ServiceMonitor for Prometheus Operator integration

### Alerts

Configure alerts for:
- High CPU/memory utilization
- Database connection failures
- Migration job failures
- Pod restart frequency

## Security

### Secrets Management

- Uses External Secrets Operator
- Automatic password generation
- No hardcoded credentials
- TLS termination at ingress

### Network Security

- Internal service communication
- Ingress with proper annotations
- Pod security policies (if enabled)

## Troubleshooting

### Common Issues

1. **Migration Failures**: Check logs with `kubectl logs job/trivoh-api-migration-<revision>`
2. **Database Connection**: Verify MySQL is running and accessible
3. **Health Check Failures**: Check application logs and health endpoints
4. **Resource Issues**: Monitor CPU/memory usage and adjust limits

### Logs

```bash
# Application logs
kubectl logs -f deployment/trivoh-api -n trivoh-api

# Migration logs
kubectl logs -f job/trivoh-api-migration-<revision> -n trivoh-api

# MySQL logs
kubectl logs -f deployment/mysql -n trivoh-api
```

## Upgrades

### Version Compatibility

- Chart version 0.2.0 introduces breaking changes
- Review migration notes before upgrading
- Test in staging environment first

### Upgrade Process

1. Update values.yaml with new configuration
2. Run `helm upgrade` or let ArgoCD handle it
3. Monitor migration job completion
4. Verify application health

## Contributing

1. Follow Helm chart best practices
2. Update documentation for new features
3. Test changes in staging environment
4. Update version numbers appropriately

## License

This chart is licensed under the MIT License.
