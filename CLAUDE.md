## Kubernetes Configuration
- Use KUBECONFIG ~/livekit-demo-k8s.config when connecting to kubernetes
- **NEVER use kubectl to create resources directly**
- **ALWAYS use GitOps - add resources to charts, commit, push, and sync via ArgoCD**

## ArgoCD Workflow
- After changes: commit, push, then refresh ArgoCD app
- Refresh command: `KUBECONFIG=~/livekit-demo-k8s.config kubectl -n argocd patch app <app-name> --type merge -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"prune": true, "revision": "main"}}}'`
- App-of-apps pattern: `core-services` manages all services from `/chart` directory
- Service configs in `/services/<service-name>/values.yaml`

## Troubleshooting
- Check pods: `kubectl get pods -n [namespace]`
- Check logs: `kubectl logs -f [pod-name] -n [namespace]`
- Check events: `kubectl describe [resource] [name] -n [namespace]`
- After changes: commit → push → refresh ArgoCD → verify pods

## LiveKit Configuration
- Server: `ws.livekit-demo.cloudportal.app` (HTTP/WebSocket via nginx ingress)
- TURN: `turn.livekit-demo.cloudportal.app` (UDP/TCP LoadBalancer)
- Ingress: `ingress.livekit-demo.cloudportal.app` (RTMP/WHIP/HTTP)
  - RTMP URL: `rtmp://ingress.livekit-demo.cloudportal.app:1935/live`
  - WHIP endpoint: `https://ingress.livekit-demo.cloudportal.app:7888/whip`
  - HTTP API: `https://livekit-api.livekit-demo.cloudportal.app` (nginx + cert-manager + LetsEncrypt)
- Frontend: `meet.livekit-demo.cloudportal.app`
- Redis: `redis-redis-cluster.redis.svc.cluster.local:6379`
- MinIO: `minio.minio-tenant.svc.cluster.local:80` (bucket: `livekit-recordings`)

## Performance Optimizations
- System optimized for 1000+ concurrent participants
- 10 LiveKit server pods (3-20 with HPA), 8-32 ingress pods, 6-node Redis cluster
- Connection pooling, network buffer tuning, priority scheduling

## Service Naming
- Pattern: `<service>.livekit-demo.cloudportal.app`
- TLS: cert-manager with letsencrypt cluster issuer
- Ingress class: nginx
- **DNS Requirements**: Manual DNS entries needed for:
  - `ingress.livekit-demo.cloudportal.app` → LoadBalancer IP (RTMP/WHIP)
  - `turn.livekit-demo.cloudportal.app` → LoadBalancer IP (TURN server)

## Helm Chart Best Practices
- Only include values that differ from defaults
- All resources managed via Helm charts in git
- Use ArgoCD for all deployments

## Security & Secrets
- **NEVER hardcode passwords/secrets in files**
- Use External Secrets Operator for secret management
- API credentials stored in Kubernetes secrets
- Auto-generate all passwords with proper entropy

## Load Testing
- **Prerequisites**: Install LiveKit CLI locally: `curl -sSL https://get.livekit.io/cli | bash`
- Use LiveKit CLI: `lk load-test --url wss://... --api-key ... --api-secret ...`
- Target: 1000+ participants, <100ms latency

## Critical Files
- LiveKit Server: `/services/livekit/values.yaml`
- LiveKit Ingress: `/services/livekit-ingress/values.yaml`
- Redis: `/services/redis/values.yaml`
- Performance configs in `/services/*/manifests/templates/`

## Task Completion Requirements
- Continue until all ArgoCD apps show "Synced" and "Healthy"
- Verify pods running and services accessible
- End-to-end validation required
