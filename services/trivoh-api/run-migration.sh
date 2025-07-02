#!/bin/bash
# Manual migration script for trivoh-api

set -euo pipefail

echo "Running trivoh-api database migration..."

# Generate unique job name with timestamp
JOB_NAME="trivoh-api-manual-migrate-$(date +%s)"

# Apply migration job
cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  namespace: trivoh-api
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      imagePullSecrets:
        - name: harbor-registry
      initContainers:
        - name: wait-for-db
          image: mysql:8.0
          env:
          - name: MYSQL_PWD
            valueFrom:
              secretKeyRef:
                name: mysql-secret
                key: mysql-password
          command:
          - /bin/sh
          - -c
          - |
            echo "Waiting for MySQL..."
            for i in \$(seq 1 60); do
              if mysql -h mysql -u trivoh_user -e "SELECT 1" > /dev/null 2>&1; then
                echo "MySQL is ready!"
                exit 0
              fi
              echo "MySQL not ready, waiting... (attempt \$i/60)"
              sleep 5
            done
            echo "MySQL did not become ready in time"
            exit 1
          resources:
            requests:
              cpu: 10m
              memory: 32Mi
            limits:
              cpu: 100m
              memory: 128Mi
      containers:
      - name: migrate
        image: repo.livekit-demo.cloudportal.app/livekit-demo/trivoh-api:latest
        command: ["/bin/sh", "-c"]
        args:
          - |
            export OPENAI_API_KEY="\${OPENAI_API_KEY:-sk-dummy-key-for-migration}"
            node /app/migrate.js
        volumeMounts:
          - name: migration-script
            mountPath: /app/migrate.js
            subPath: migrate.js
          - name: db-config-override
            mountPath: /app/configs/db.js
            subPath: db.js
          - name: document-model-override
            mountPath: /app/models/Document.js
            subPath: Document.js
        env:
          - name: DB_CONNECTION
            value: "mysql"
          - name: DB_HOST
            value: "mysql"
          - name: DB_USER
            value: "trivoh_user"
          - name: DB_PASS
            valueFrom:
              secretKeyRef:
                name: mysql-secret
                key: mysql-password
          - name: DB_NAME
            value: "trivoh"
          - name: DB_SYNC
            value: "true"
          - name: DB_ALTER
            value: "true"
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
      volumes:
        - name: migration-script
          configMap:
            name: migration-script
        - name: db-config-override
          configMap:
            name: db-config-override
        - name: document-model-override
          configMap:
            name: document-model-override
EOF

echo "Migration job created: ${JOB_NAME}"
echo "Monitoring progress..."

# Wait for job completion with timeout
if kubectl wait --for=condition=complete --timeout=600s job/${JOB_NAME} -n trivoh-api; then
  echo "✅ Migration completed successfully!"
  echo "📋 Migration logs:"
  kubectl logs job/${JOB_NAME} -n trivoh-api
else
  echo "❌ Migration failed or timed out"
  echo "📋 Migration logs:"
  kubectl logs job/${JOB_NAME} -n trivoh-api
  echo "🔍 Job status:"
  kubectl describe job/${JOB_NAME} -n trivoh-api
  exit 1
fi

# Clean up the job
echo "🧹 Cleaning up migration job..."
kubectl delete job/${JOB_NAME} -n trivoh-api

echo "✅ Migration process completed!"
