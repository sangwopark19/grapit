#!/usr/bin/env bash
set -euo pipefail

# Grapit - Google Memorystore for Valkey provisioning script
# Usage: ./scripts/provision-valkey.sh <GCP_PROJECT_ID>
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Billing enabled on the GCP project
#   - Owner or Editor role on the project
#
# What this script does:
#   1. Enables required GCP APIs (networkconnectivity, compute, memorystore, ...)
#   2. Creates a PSC (Private Service Connect) service-connection-policy
#      so that Memorystore can auto-attach a PSC endpoint in the default VPC.
#   3. Creates a Memorystore for Valkey instance (shared-core-nano, single node).
#   4. Prints the discoveryEndpoints output so you can build REDIS_URL.
#
# After running, you must MANUALLY:
#   1. Note the discoveryEndpoints address and port from the output
#   2. Create the GCP Secret Manager secret:
#      echo -n "redis://<IP>:<PORT>" | gcloud secrets create redis-url \
#        --data-file=- --project=<PROJECT_ID>
#   3. Grant Cloud Run service account access to the secret:
#      gcloud secrets add-iam-policy-binding redis-url \
#        --member="serviceAccount:grapit-cloudrun@<PROJECT_ID>.iam.gserviceaccount.com" \
#        --role="roles/secretmanager.secretAccessor" \
#        --project=<PROJECT_ID>

PROJECT_ID="${1:?Usage: $0 <GCP_PROJECT_ID>}"
REGION="asia-northeast3"
INSTANCE_NAME="grapit-valkey"
NETWORK="default"
POLICY_NAME="grapit-valkey-policy"

echo "=== Step 1: Enable required APIs ==="
gcloud services enable \
  networkconnectivity.googleapis.com \
  compute.googleapis.com \
  serviceconsumermanagement.googleapis.com \
  memorystore.googleapis.com \
  --project="$PROJECT_ID"

echo ""
echo "=== Step 2: Create PSC service connection policy (idempotent) ==="
gcloud network-connectivity service-connection-policies create "$POLICY_NAME" \
  --network="$NETWORK" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --service-class=gcp-memorystore \
  --subnets="https://www.googleapis.com/compute/v1/projects/$PROJECT_ID/regions/$REGION/subnetworks/$NETWORK" \
  2>/dev/null || echo "Policy '$POLICY_NAME' already exists, skipping."

echo ""
echo "=== Step 3: Create Memorystore for Valkey instance ==="
echo "Instance: $INSTANCE_NAME"
echo "Region:   $REGION"
echo "Node:     shared-core-nano (1 shard, 0 replicas, VALKEY_8_0)"
echo ""
gcloud memorystore instances create "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --node-type=shared-core-nano \
  --shard-count=1 \
  --replica-count=0 \
  --engine-version=VALKEY_8_0 \
  --endpoints="[{\"connections\": [{\"pscAutoConnection\": {\"network\": \"projects/$PROJECT_ID/global/networks/$NETWORK\", \"projectId\": \"$PROJECT_ID\"}}]}]"

echo ""
echo "=== Step 4: Describe instance (get discoveryEndpoints) ==="
gcloud memorystore instances describe "$INSTANCE_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --format="yaml(discoveryEndpoints,state)"

echo ""
echo "=== Done ==="
echo ""
echo "Next steps (run manually):"
echo "  1. Copy the discoveryEndpoints address:port from above."
echo "  2. Register the Secret Manager secret:"
echo "       echo -n 'redis://<IP>:<PORT>' | \\"
echo "         gcloud secrets create redis-url --data-file=- --project=$PROJECT_ID"
echo "  3. Grant Cloud Run service account access:"
echo "       gcloud secrets add-iam-policy-binding redis-url \\"
echo "         --member='serviceAccount:grapit-cloudrun@$PROJECT_ID.iam.gserviceaccount.com' \\"
echo "         --role='roles/secretmanager.secretAccessor' \\"
echo "         --project=$PROJECT_ID"
echo ""
echo "Cloud Run deploy.yml already includes --vpc-egress=private-ranges-only"
echo "and REDIS_URL=redis-url:latest, so the next deploy will wire everything up."
