#!/bin/bash
# sync-src.sh — Sync canonical service sources into the Helm chart src/ directory
# Run this before committing so ArgoCD picks up the latest code.
# Usage: ./sync-src.sh

CHART_SRC="$(dirname "$0")/project/k8s/ecommerce/src"
SERVICES="$(dirname "$0")/project/services"

echo "🔄 Syncing service sources → chart src/"
cp "$SERVICES/api/src/api.js"          "$CHART_SRC/api.js"
cp "$SERVICES/auth/src/auth.js"        "$CHART_SRC/auth.js"
cp "$SERVICES/payment/src/payment.js"  "$CHART_SRC/payment.js"
cp "$SERVICES/worker/src/worker.js"    "$CHART_SRC/worker.js"

mkdir -p "$CHART_SRC/frontend" "$CHART_SRC/admin"
cp "$SERVICES/frontend/src/index.html" "$CHART_SRC/frontend/index.html"
cp "$SERVICES/frontend/src/style.css"  "$CHART_SRC/frontend/style.css"
cp "$SERVICES/frontend/src/script.js"  "$CHART_SRC/frontend/script.js"
cp "$SERVICES/admin/src/index.html"    "$CHART_SRC/admin/index.html"
cp "$SERVICES/admin/src/style.css"     "$CHART_SRC/admin/style.css"
cp "$SERVICES/admin/src/script.js"     "$CHART_SRC/admin/script.js"

echo "✅ Sync complete. Files in $CHART_SRC:"
ls -la "$CHART_SRC" "$CHART_SRC/frontend" "$CHART_SRC/admin"
