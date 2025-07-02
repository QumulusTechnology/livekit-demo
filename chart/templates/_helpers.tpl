{{/*
Expand the name of the chart.
*/}}
{{- define "core-services.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create global values to pass to all services
*/}}
{{- define "core-services.globalValues" -}}
global:
  domain: {{ .Values.global.domain | quote }}
  registry:
    domain: {{ .Values.global.registry.domain | quote }}
  masterRegistry:
    domain: {{ .Values.global.masterRegistry.domain | quote }}
  services:
    livekit:
      namespace: {{ .Values.global.services.livekit.namespace | quote }}
      serviceName: {{ .Values.global.services.livekit.serviceName | quote }}
      wsUrl: {{ printf "wss://livekit.%s" .Values.global.domain | quote }}
      apiUrl: {{ printf "https://livekit.%s" .Values.global.domain | quote }}
    redis:
      namespace: {{ .Values.global.services.redis.namespace | quote }}
      serviceName: {{ .Values.global.services.redis.serviceName | quote }}
      clusterService: {{ .Values.global.services.redis.clusterService | quote }}
      port: {{ .Values.global.services.redis.port }}
    minio:
      namespace: {{ .Values.global.services.minio.namespace | quote }}
      serviceName: {{ .Values.global.services.minio.serviceName | quote }}
      port: {{ .Values.global.services.minio.port }}
    trivoh:
      apiUrl: {{ printf "https://api.%s" .Values.global.domain | quote }}
{{- end }}