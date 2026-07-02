# Saud's Store — Cloud-Native E-Commerce Platform

A production-inspired, cloud-native E-Commerce platform running on **Minikube** + **LocalStack** (AWS service emulation), automatically deployed via **ArgoCD**. Rebranded and redesigned as **Saud's Store** — v3.

[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![Helm](https://img.shields.io/badge/Helm-0F1689?logo=helm&logoColor=white)](https://helm.sh)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-EF7B4D?logo=argo&logoColor=white)](https://argo-cd.readthedocs.io)
[![LocalStack](https://img.shields.io/badge/LocalStack-FFC300?logo=amazon-aws&logoColor=black)](https://localstack.cloud)
[![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io)
[![Grafana](https://img.shields.io/badge/Grafana-F46800?logo=grafana&logoColor=white)](https://grafana.com)

---

## 🗂️ Project Structure

```
aws-terraform-localstack/
├── .gitignore                       # Excludes .terraform/, *.tfstate, provider binaries
├── sync-src.sh                      # 🔄 Syncs services/*/src → k8s/ecommerce/src/
│
├── project/                         # ── Main Platform ──────────────────────────
│   ├── services/                    # 📦 Canonical microservice source code
│   │   ├── api/src/api.js           #   Order & product REST API (Node.js)
│   │   ├── auth/src/auth.js         #   Authentication service (Node.js)
│   │   ├── payment/src/payment.js   #   Payment processing service (Node.js)
│   │   ├── worker/src/worker.js     #   SQS queue consumer (Node.js)
│   │   ├── frontend/src/            #   Customer storefront (Saud's Store)
│   │   │   ├── index.html           #     Hero slider, categories, products, checkout
│   │   │   ├── style.css            #     Premium CSS with animations & glassmorphism
│   │   │   └── script.js            #     Cart, auth, checkout, hero slider logic
│   │   └── admin/src/               #   Admin dashboard (dark sidebar layout)
│   │       ├── index.html           #     Orders, payments, inventory, alerts
│   │       ├── style.css            #     Dark theme dashboard styles
│   │       └── script.js            #     Data fetching, charts, live polling
│   │
│   ├── k8s/                         # ☸️ Kubernetes / Helm manifests
│   │   └── ecommerce/               #   Helm chart (ArgoCD watches this path)
│   │       ├── Chart.yaml           #     Chart metadata v2.0.0
│   │       ├── values.yaml          #     Image & replica configuration
│   │       ├── src/                 #     ← Mirrored from services/ via sync-src.sh
│   │       └── templates/
│   │           ├── configmaps.yaml      # Per-service ConfigMaps (split per service)
│   │           ├── deployments.yaml     # All 6 service deployments + nginx configs
│   │           ├── services.yaml        # ClusterIP services
│   │           ├── ingress.yaml         # NGINX Ingress routing rules
│   │           ├── hpa.yaml             # Horizontal Pod Autoscaler (API service)
│   │           └── grafana-dashboard.yaml # 📊 Saud's Store platform metrics dashboard
│   │
│   ├── infra/                       # 🏗️ Terraform — LocalStack AWS infrastructure
│   │   ├── main.tf                  #   DynamoDB, SQS, SNS, S3, Secrets Manager, Lambda
│   │   ├── provider.tf              #   LocalStack AWS provider config
│   │   └── lambda/                  #   Lambda function source code
│   │       ├── index.js             #     Invoice processor
│   │       └── loki-shipper.js      #     CloudWatch → Loki log shipper
│   │
│   ├── applications/                # 🤖 ArgoCD Application manifests
│   │   ├── ecommerce-app.yaml       #   Main app (watches k8s/ecommerce)
│   │   └── argocd-ingress.yaml      #   ArgoCD ingress rule
│   │
│   └── docs/                        # 📚 Learning guides & ADRs
│       └── karpenter-explained.md
│
├── lab-01-basic-s3/                 # ── Terraform Labs (Learning) ─────────────
├── lab-02-variables-outputs/
├── lab-03-dependencies-iam/
├── lab-04-vpc-ec2-nginx/
└── lab-05-kubernetes-basics/
```

> **Workflow:** Edit files in `services/*/src/` → run `./sync-src.sh` → commit & push → ArgoCD auto-deploys.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([🛒 Customer]) -->|HTTP /| Frontend[Frontend nginx\nSaud's Store UI]
    Admin([🛡️ Admin]) -->|HTTP /admin| AdminPanel[Admin Dashboard nginx]

    Frontend -->|POST /api/auth/login| AuthService[Auth Service :3000]
    Frontend -->|GET /api/products| APIService[API Service :3000]
    Frontend -->|POST /api/orders| APIService
    Frontend -->|POST /api/payments/charge| PaymentService[Payment Service :3000]

    AdminPanel -->|POST /api/auth/login| AuthService
    AdminPanel -->|GET /api/payments/ledger| PaymentService
    AdminPanel -->|GET /api/orders| APIService

    APIService -->|Secrets| SecretsManager[AWS Secrets Manager\nLocalStack]
    PaymentService -->|Secrets| SecretsManager

    APIService -->|Stock decrement| DynamoInventory[(DynamoDB Inventory)]
    APIService -->|Write order| DynamoOrders[(DynamoDB Orders)]
    APIService -->|Publish event| SNS[SNS Order Events Topic]

    SNS -->|Deliver| SQS[SQS Queue]
    SQS -->|Poll| Worker[SQS Worker]

    Worker -->|Write transaction| DynamoTxs[(DynamoDB Transactions)]
    Worker -->|Upload invoice| S3[(S3 Invoices Bucket)]
    S3 -->|Trigger| Lambda[Lambda Invoice Processor]

    PaymentService -->|Write payment| DynamoPayments[(DynamoDB Payments)]

    Prometheus{{Prometheus}} -->|Scrapes| Pods[All k8s Pods]
    Prometheus -->|Feeds| Grafana[📊 Grafana\nSaud's Store Dashboard]

    SNSAlerts[SNS Alerts Topic] -->|CPU/Memory Spike| Email[saud.ali@kissht.com]
```

### Services
| Service | Stack | Port | Description |
|---------|-------|------|-------------|
| `frontend` | nginx + HTML/CSS/JS | 80 | Premium storefront — hero slider, cart, checkout |
| `admin` | nginx + HTML/CSS/JS | 80 | Dark sidebar dashboard — orders, payments, inventory |
| `auth` | Node.js 18 | 3000 | JWT-style authentication for users & admins |
| `api` | Node.js 18 | 3000 | Product catalog, order placement, stock management |
| `payment` | Node.js 18 | 3000 | Payment processing & global ledger |
| `worker` | Node.js 18 | — | SQS consumer — invoices, transactions, S3 upload |

---

## 🔐 Access Credentials

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Customer | `user` | `user123` | Storefront only |
| Admin | `admin` | `admin123` | Admin dashboard only |

---

## 🌐 Application URLs

| Service | URL |
|---------|-----|
| 🛒 Customer Storefront | [http://localhost/](http://localhost/) |
| 🛡️ Admin Dashboard | [http://localhost/admin](http://localhost/admin) |
| 📊 Grafana Metrics | [http://localhost/grafana](http://localhost/grafana) |
| 🤖 ArgoCD Console | Port-forward below |

### Get ArgoCD Admin Password
```bash
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

### ArgoCD Access (via Ingress — no port-forward needed)
```bash
# Browse: https://localhost/argocd
# Or via port-forward as fallback:
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

---

## 📊 Grafana Dashboard — Saud's Store Platform Metrics

A custom Grafana dashboard (**Saud's Store — Platform Metrics**, UID: `sauds-ecommerce-v2`) is auto-loaded via the Grafana sidecar ConfigMap watcher. It includes:

| Panel | Metric |
|-------|--------|
| 🟢 Running Pods | `kube_pod_status_phase{phase="Running"}` |
| 🔥 Node CPU % | `1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))` |
| 💾 Node Memory % | `1 - (MemAvailable / MemTotal)` |
| ⚠️ Pods Not Running | Pods in non-Running, non-Succeeded phase |
| 📈 CPU by Pod | `rate(container_cpu_usage_seconds_total[5m])` |
| 📈 Memory by Pod | `container_memory_working_set_bytes` |
| 🌐 Network RX/TX | `rate(container_network_*_bytes_total[5m])` |
| 🔄 Replicas | `kube_deployment_status_replicas_available` |
| ⚡ HPA Scaling | `kube_horizontalpodautoscaler_status_current_replicas` |
| 🔁 Restarts | `increase(kube_pod_container_status_restarts_total[1h])` |
| ⏱️ Node Uptime | `time() - node_boot_time_seconds` |

**Browse to:** [http://localhost/grafana](http://localhost/grafana) → Dashboards → `Saud's Store — Platform Metrics`

---

## ☁️ AWS Services (via LocalStack)

| Service | Resource | Purpose |
|---------|----------|---------|
| DynamoDB | `dev-ecommerce-inventory` | Product catalog & stock levels |
| DynamoDB | `dev-ecommerce-orders` | Customer orders |
| DynamoDB | `dev-ecommerce-transactions` | SQS worker transactions |
| DynamoDB | `dev-ecommerce-payments` | Payment ledger |
| SQS | `dev-process-order-queue` | Order event queue |
| SNS | `dev-order-events-topic` | Order event bus |
| SNS | `dev-system-alerts-topic` | CPU/Memory alerts → saud.ali@kissht.com |
| S3 | `dev-ecommerce-invoices` | Invoice JSON storage |
| Lambda | `invoice-processor` | S3-triggered invoice post-processing |
| Lambda | `loki-log-shipper` | CloudWatch → Loki log shipping |
| Secrets Manager | `dev-ecommerce-secrets` | Runtime config & credentials |

---

## 🚀 Quick Start

### Prerequisites
- [Minikube](https://minikube.sigs.k8s.io/) with ingress addon enabled
- [Helm 3](https://helm.sh/)
- [Terraform](https://www.terraform.io/)
- [LocalStack](https://localstack.cloud/) running

### 1. Start LocalStack & Provision Infrastructure
```bash
localstack start -d
cd project/infra && terraform init && terraform apply -auto-approve
```

### 2. Start Minikube
```bash
minikube start
minikube addons enable ingress
```

### 3. Deploy ArgoCD + App
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f project/applications/ecommerce-app.yaml
kubectl apply -f project/applications/argocd-ingress.yaml
```

### 4. Force Sync & Browse
```bash
minikube tunnel  # run in separate terminal
kubectl patch application ecommerce-platform -n argocd \
  --type merge -p '{"operation":{"sync":{"revision":"HEAD","prune":true}}}'
# Open: http://localhost
```

---

## 🛠️ Development Workflow

```bash
# 1. Edit canonical source files
vim project/services/frontend/src/index.html

# 2. Sync to Helm chart directory
./sync-src.sh

# 3. Commit & push — ArgoCD auto-deploys in ~3 minutes
git add -A && git commit -m "feat: update UI" && git push
```

---

## 📐 Ingress Routing

| Path | Backend | Port |
|------|---------|------|
| `/api/auth/*` | auth service | 3000 |
| `/api/payments/*` | payment service | 3000 |
| `/api/*` | api service | 3000 |
| `/admin*` | admin service | 80 |
| `/grafana*` | kube-prometheus-stack-grafana | 80 |
| `/argocd*` | argocd-server | 80 |
| `/*` | frontend service | 80 |

---

## 📚 Documentation
- [Karpenter Explained](project/docs/karpenter-explained.md)