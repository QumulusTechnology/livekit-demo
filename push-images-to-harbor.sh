#!/bin/bash

# Script to load and push Docker images to Harbor
# Automatically fetches credentials from Kubernetes secret

HARBOR_URL="${HARBOR_URL:-repo.livekit-demo.cloudportal.app}"
HARBOR_PROJECT="livekit-demo"
KUBECONFIG="${KUBECONFIG:-~/livekit-demo-k8s.config}"

echo "Fetching Harbor credentials from Kubernetes secret..."
HARBOR_USER="admin"
HARBOR_PASS=$(kubectl --kubeconfig="$KUBECONFIG" get secret harbor-auth -n harbor -o jsonpath='{.data.password}' | base64 -d)

if [ -z "$HARBOR_PASS" ]; then
    echo "Failed to fetch Harbor password from Kubernetes secret"
    exit 1
fi

echo "Retrieved credentials for user: $HARBOR_USER"

echo "Checking if project $HARBOR_PROJECT exists..."
PROJECT_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" -u "$HARBOR_USER:$HARBOR_PASS" \
  "https://$HARBOR_URL/api/v2.0/projects?name=$HARBOR_PROJECT")

if [ "$PROJECT_EXISTS" = "404" ] || [ "$PROJECT_EXISTS" = "200" ]; then
    # Check if project list is empty
    PROJECT_COUNT=$(curl -s -u "$HARBOR_USER:$HARBOR_PASS" \
      "https://$HARBOR_URL/api/v2.0/projects?name=$HARBOR_PROJECT" | jq '. | length')
    
    if [ "$PROJECT_COUNT" = "0" ]; then
        echo "Project $HARBOR_PROJECT does not exist. Creating it..."
        curl -s -X POST -u "$HARBOR_USER:$HARBOR_PASS" \
          "https://$HARBOR_URL/api/v2.0/projects" \
          -H "Content-Type: application/json" \
          -d "{\"project_name\": \"$HARBOR_PROJECT\", \"metadata\": {\"public\": \"false\"}}" \
          -w "\nHTTP Status: %{http_code}\n"
        
        if [ $? -eq 0 ]; then
            echo "Project $HARBOR_PROJECT created successfully"
        else
            echo "Failed to create project $HARBOR_PROJECT"
            exit 1
        fi
    else
        echo "Project $HARBOR_PROJECT already exists"
    fi
fi

echo "Logging into Harbor..."
echo "$HARBOR_PASS" | docker login "$HARBOR_URL" -u "$HARBOR_USER" --password-stdin

if [ $? -ne 0 ]; then
    echo "Failed to login to Harbor"
    exit 1
fi

echo "Loading images..."
docker load -i ~/repos/livekit-demo/docker-images/meet-client.tar
docker load -i ~/repos/livekit-demo/docker-images/trivoh-api.tar
gunzip -c ~/repos/livekit-demo/docker-images/newtrivoh.tar.gz | docker load

echo "Tagging images for Harbor..."
docker tag repo.livekit-demo.cloudportal.app/livekit-demo/meet-client:latest "$HARBOR_URL/$HARBOR_PROJECT/meet-client:latest"
docker tag repo.livekit-demo.cloudportal.app/livekit-demo/trivoh-api:latest "$HARBOR_URL/$HARBOR_PROJECT/trivoh-api:latest"
docker tag repo.livekit-demo.cloudportal.app/livekit-demo/newtrivoh:latest "$HARBOR_URL/$HARBOR_PROJECT/newtrivoh:latest"

echo "Pushing images to Harbor..."
docker push "$HARBOR_URL/$HARBOR_PROJECT/meet-client:latest"
docker push "$HARBOR_URL/$HARBOR_PROJECT/trivoh-api:latest"
docker push "$HARBOR_URL/$HARBOR_PROJECT/newtrivoh:latest"

echo "Done! Images pushed to Harbor:"
echo "- $HARBOR_URL/$HARBOR_PROJECT/meet-client:latest"
echo "- $HARBOR_URL/$HARBOR_PROJECT/trivoh-api:latest"  
echo "- $HARBOR_URL/$HARBOR_PROJECT/newtrivoh:latest"