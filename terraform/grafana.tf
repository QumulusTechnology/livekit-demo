resource "kubectl_manifest" "grafana_ns" {
  yaml_body = <<YAML
apiVersion: v1
kind: Namespace
metadata:
  name: grafana
name: grafana
YAML
}

resource "random_password" "grafana_password" {
  length  = 24
  special = false
}

resource "local_sensitive_file" "grafana_password" {
  file_permission = "0600"
  content         = random_password.grafana_password.result
  filename        = "${path.module}/../passwords/grafana-password.txt"
}

resource "kubernetes_secret" "grafana_credentials" {
  metadata {
    name      = "grafana-credentials"
    namespace = "grafana"
  }
  data = {
    username = "admin"
    password = random_password.grafana_password.result
  }
  type = "Opaque"
  depends_on = [
    kubectl_manifest.grafana_ns
  ]
}


resource "kubernetes_secret" "grafana_datasource_credentials" {
  metadata {
    name      = "grafana-datasource-credentials"
    namespace = "grafana"
  }
  data = {
    "mimir_host"     = "https://mimir.${var.domain}"
    "mimir_password" = random_password.mimir_password.result
    "mimir_username" = "admin"
    "loki_host"      = "https://loki.${var.domain}"
    "loki_password"  = random_password.loki_password.result
    "loki_username"  = "admin"
  }
  type = "Opaque"
  depends_on = [
    kubectl_manifest.grafana_ns
  ]
}
