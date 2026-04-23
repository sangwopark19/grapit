#!/usr/bin/env bash
# scripts/cleanup-old-grapit-resources.sh
# Phase 13 Plan 04 (Revision 3, D-14 LB-adapted) — Delete old grapit-* resources
# after 7-day grace period.
#
# Note: Wave 3 decision — asia-northeast3 Cloud Run domain-mappings unsupported.
# All routing lives on Global External HTTPS LB. D-14 gate [2] therefore checks
# URL Map host rules rather than `gcloud beta run domain-mappings describe`.
#
# Usage:
#   ./scripts/cleanup-old-grapit-resources.sh <GCP_PROJECT_ID> --confirm-after-date YYYY-MM-DD
#
# D-14 Hard gate (3 preconditions):
#   1. --confirm-after-date required; today must be >= argument date
#   2. URL Map host rules: api.heygrabit.com → grabit-api-backend AND
#                          heygrabit.com / www.heygrabit.com → grabit-web-backend
#   3. 24h traffic log for grapit-{web,api} must be empty
set -euo pipefail

usage() {
  echo "Usage: $0 <GCP_PROJECT_ID> --confirm-after-date YYYY-MM-DD"
  echo "  D-14: date argument is MANDATORY. Today must be >= that date."
  exit 1
}

PROJECT_ID="${1:-}"
shift || true
[ -z "$PROJECT_ID" ] && usage
CONFIRM_DATE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm-after-date)
      CONFIRM_DATE="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1"; usage ;;
  esac
done
[ -z "$CONFIRM_DATE" ] && { echo "ERROR: --confirm-after-date YYYY-MM-DD required (D-14 hard gate)"; usage; }

REGION="asia-northeast3"
URL_MAP="grabit-api-urlmap"
TODAY=$(date +%Y-%m-%d)

echo "=== D-14 Hard Gate [1/3] — date precondition ==="
# Lexicographic compare works for YYYY-MM-DD format
if [[ "$TODAY" < "$CONFIRM_DATE" ]]; then
  echo "ERROR: today ($TODAY) < --confirm-after-date ($CONFIRM_DATE). Refuse to run." >&2
  exit 1
fi
echo "  OK: today=$TODAY >= confirm-after-date=$CONFIRM_DATE"

echo "=== D-14 Hard Gate [2/3] — URL Map host rules (apex + api, LB-based routing) ==="
URL_MAP_YAML=$(gcloud compute url-maps describe "$URL_MAP" --project="$PROJECT_ID" --format=yaml 2>/dev/null || echo "")
if [ -z "$URL_MAP_YAML" ]; then
  echo "ERROR: URL Map '$URL_MAP' not found. Refuse to run." >&2
  exit 1
fi

# Host rule check — apex heygrabit.com + www should route to grabit-web-backend path matcher
HAS_APEX=$(echo "$URL_MAP_YAML" | grep -c 'heygrabit.com$\|hosts:' || true)
# More resilient JSON check instead of grep:
PROBE=$(gcloud compute url-maps describe "$URL_MAP" --project="$PROJECT_ID" --format=json 2>/dev/null)

APEX_MATCHER=$(echo "$PROBE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for rule in d.get('hostRules', []):
    if 'heygrabit.com' in rule.get('hosts', []) or 'www.heygrabit.com' in rule.get('hosts', []):
        print(rule.get('pathMatcher',''))
        break
")
API_MATCHER=$(echo "$PROBE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for rule in d.get('hostRules', []):
    if 'api.heygrabit.com' in rule.get('hosts', []):
        print(rule.get('pathMatcher',''))
        break
")

if [ -z "$APEX_MATCHER" ]; then
  echo "ERROR: URL Map has no host rule for heygrabit.com/www.heygrabit.com. Refuse to run." >&2
  exit 1
fi
if [ -z "$API_MATCHER" ]; then
  echo "ERROR: URL Map has no host rule for api.heygrabit.com. Refuse to run." >&2
  exit 1
fi

APEX_BACKEND=$(echo "$PROBE" | python3 -c "
import sys, json, os
d = json.load(sys.stdin)
target = '$APEX_MATCHER'
for pm in d.get('pathMatchers', []):
    if pm.get('name') == target:
        svc = pm.get('defaultService','').split('/')[-1]
        print(svc)
        break
")
API_BACKEND=$(echo "$PROBE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
target = '$API_MATCHER'
for pm in d.get('pathMatchers', []):
    if pm.get('name') == target:
        svc = pm.get('defaultService','').split('/')[-1]
        print(svc)
        break
")

if [ "$APEX_BACKEND" != "grabit-web-backend" ]; then
  echo "ERROR: heygrabit.com host matcher backend expected 'grabit-web-backend', got '$APEX_BACKEND'. Refuse to run." >&2
  exit 1
fi
echo "  OK: heygrabit.com / www.heygrabit.com → grabit-web-backend"

if [ "$API_BACKEND" != "grabit-api-backend" ]; then
  echo "ERROR: api.heygrabit.com host matcher backend expected 'grabit-api-backend', got '$API_BACKEND'. Refuse to run." >&2
  exit 1
fi
echo "  OK: api.heygrabit.com → grabit-api-backend"

echo "=== D-14 Hard Gate [3/3] — 24h traffic log empty check ==="
LAST_TS=$(gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name=("grapit-web" OR "grapit-api")' \
  --project="$PROJECT_ID" \
  --freshness=24h \
  --limit=1 \
  --format='value(timestamp)' 2>/dev/null || echo "")
if [ -n "$LAST_TS" ]; then
  echo "ERROR: grapit-* received traffic within last 24h (last: $LAST_TS). Refuse to run." >&2
  exit 1
fi
echo "  OK: no grapit-* traffic in last 24h"

echo "=== All D-14 hard gates passed. Proceeding with cleanup. ==="

echo "=== [1/3] Delete old Cloud Run services ==="
for svc in grapit-web grapit-api; do
  if gcloud run services describe "$svc" --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "  Deleting $svc..."
    gcloud run services delete "$svc" --region="$REGION" --project="$PROJECT_ID" --quiet
  else
    echo "  $svc not found (already deleted?) — skip"
  fi
done

echo "=== [2/3] Delete old Artifact Registry repo 'grapit' ==="
if gcloud artifacts repositories describe grapit --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  Deleting AR repo grapit (includes all images)..."
  gcloud artifacts repositories delete grapit --location="$REGION" --project="$PROJECT_ID" --quiet
else
  echo "  AR repo grapit not found — skip"
fi

echo "=== [3/3] Sentry old projects (manual, Sentry has no gcloud-equivalent CLI) ==="
echo "  Wave 3 에서 slug 가 이미 grabit-api / grabit-web 으로 rename 되었으므로"
echo "  '구 Sentry 프로젝트' 는 별도로 없음. Phase 13 관련 Sentry 작업은 종료 상태."
echo "  (Revision 3 note — 기존 plan 원안의 '구 grapit-* 프로젝트 삭제' 단계는 해당 없음)"

echo "=== Cleanup complete (--confirm-after-date=$CONFIRM_DATE) ==="
echo "Verify:"
echo "  gcloud run services list --region=$REGION --project=$PROJECT_ID | grep grapit-  # expected: empty"
echo "  gcloud artifacts repositories list --location=$REGION --project=$PROJECT_ID | grep grapit  # expected: empty"
