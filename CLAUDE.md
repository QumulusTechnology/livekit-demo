## Kubernetes Configuration
- Use KUBECONFIG ~/livekit-demo-k8s.config when connecting to kubernetes

## ArgoCD Workflow
- You need to push commit after every chart or services state and then do a hard refresh for that argocd-application for argocd to see it
- To refresh ArgoCD applications:
  ```bash
  # For a specific app
  KUBECONFIG=~/livekit-demo-k8s.config kubectl -n argocd patch app <app-name> --type merge -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"prune": true, "revision": "main"}}}'
  
  # Check sync status
  KUBECONFIG=~/livekit-demo-k8s.config kubectl -n argocd get app <app-name>
  ```
- ArgoCD Application Structure:
  - App-of-apps pattern: `core-services` in `/chart` directory manages all services
  - Service apps defined in `/chart/templates/*.yaml`
  - Service configurations in `/services/<service-name>/values.yaml`
  - Multi-source apps use `$vals` reference for values files

## Kubernetes Troubleshooting Guidelines
- **IMPORTANT**: Always perform troubleshooting steps when deploying or modifying services
- Always perform end-to-end testing after making configuration changes
- When troubleshooting issues:
  1. Check pod status with `KUBECONFIG=~/livekit-demo-k8s.config kubectl get pods -n [namespace]`
  2. Examine pod logs with `KUBECONFIG=~/livekit-demo-k8s.config kubectl logs -f [pod-name] -n [namespace]`
  3. Describe resources to see events: `KUBECONFIG=~/livekit-demo-k8s.config kubectl describe [resource] [name] -n [namespace]`
  4. Check ingress/service connectivity
  5. Verify certificates and TLS configuration
  6. Test actual functionality through browser/curl
- Common issue patterns:
  - cert-manager + nginx ingress: admission webhook pathType conflicts
  - ArgoCD sync issues: require hard refresh after config changes (see ArgoCD Workflow section)
  - Service connectivity: check ingress controller and DNS resolution
  - Pod CrashLoopBackOff: Always check logs immediately to identify configuration issues
  - Helm chart version mismatches: Verify chart versions exist in the repository
- Always validate that services are actually accessible and working, not just that pods are running
- **After any changes**: Commit, push, then refresh ArgoCD app and check pod status/logs

## LiveKit Configuration
- LiveKit server deployed via Helm chart from https://helm.livekit.io
- LiveKit ingress (for RTMP/WHIP streaming) requires separate helm chart: `ingress` from same repository
- Current configuration:
  - LiveKit server: `livekit.livekit-demo.cloudportal.app`
  - LiveKit ingress: `ingress.livekit-demo.cloudportal.app`
  - Redis: `redis-redis-cluster.redis.svc.cluster.local:6379`
  - API Key: `test` / Secret: `ThisIsAVeryLongSecretKeyForLiveKitThatIsAtLeast32Characters`
- LiveKit ingress configuration format:
  ```yaml
  config:
    api_key: test
    api_secret: ThisIsAVeryLongSecretKeyForLiveKitThatIsAtLeast32Characters
    ws_url: wss://livekit.livekit-demo.cloudportal.app
    redis:
      address: redis-redis-cluster.redis.svc.cluster.local:6379
      db: 0
  ```

## Service Naming Conventions
- All services use subdomain pattern: `<service>.livekit-demo.cloudportal.app`
- Ingress configuration:
  - Class: `nginx`
  - TLS: cert-manager with letsencrypt cluster issuer
  - Annotations for websocket support required for real-time services

## Helm Chart Repositories
- LiveKit: https://helm.livekit.io
  - Server chart: `livekit-server`
  - Ingress chart: `ingress` (latest: 1.2.2)
- Always verify chart versions exist before using: `helm search repo <repo>/<chart> --versions`

## Helm Chart Best Practices
- **IMPORTANT**: When configuring Helm charts, only include values that differ from defaults
- Do not copy all values from the chart's default values.yaml
- This approach makes configurations easier to read and maintain
- Focus only on the specific customizations needed for the deployment