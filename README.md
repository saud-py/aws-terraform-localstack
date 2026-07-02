# AnonStore — Cloud-Native E-Commerce Platform

A production-inspired, cloud-native E-Commerce platform running on **Minikube** + **LocalStack** (AWS service emulation), automatically deployed via **ArgoCD**.

[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![Helm](https://img.shields.io/badge/Helm-0F1689?logo=helm&logoColor=white)](https://helm.sh)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-EF7B4D?logo=argo&logoColor=white)](https://argo-cd.readthedocs.io)
[![LocalStack](https://img.shields.io/badge/LocalStack-FFC300?logo=amazon-aws&logoColor=black)](https://localstack.cloud)
[![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io)

---

## 🗂️ Project Structure

```
aws-terraform-localstack/
├── sync-src.sh                      # 🔄 Syncs services/*/src → k8s/ecommerce/src/
└── project/
    ├── services/                    # 📦 Canonical service source code
    │   ├── api/src/api.js           # Order & product REST API (Node.js)
    │   ├── auth/src/auth.js         # Authentication service (Node.js)
    │   ├── payment/src/payment.js   # Payment processing service (Node.js)
    │   ├── worker/src/worker.js     # SQS queue consumer (Node.js)
    │   ├── frontend/src/            # Customer storefront (HTML/CSS/JS)
    │   │   ├── index.html
    │   │   ├── style.css
    │   │   └── script.js
    │   └── admin/src/               # Admin dashboard (HTML/CSS/JS)
    │       ├── index.html
    │       ├── style.css
    │       └── script.js
    ├── k8s/                         # ☸️ Kubernetes / Helm manifests
    │   └── ecommerce/               # Helm chart (ArgoCD watches this)
    │       ├── Chart.yaml
    │       ├── values.yaml
    │       ├── src/                 # ← Mirrored from services/ via sync-src.sh
    │       └── templates/
    │           ├── configmaps.yaml  # Per-service ConfigMaps
    │           ├── deployments.yaml # All 6 service deployments
    │           ├── services.yaml    # ClusterIP services
    │           ├── ingress.yaml     # NGINX Ingress routing
    │           └── hpa.yaml         # Horizontal Pod Autoscaler
    ├── infra/                       # 🏗️ Terraform (LocalStack infrastructure)
    │   ├── main.tf                  # DynamoDB, SQS, SNS, S3, Secrets Manager
    │   └── provider.tf              # LocalStack AWS provider config
    ├── applications/                # 🤖 ArgoCD Application manifests
    │   ├── ecommerce-app.yaml       # Main app (watches k8s/ecommerce)
    │   └── argocd-ingress.yaml      # ArgoCD ingress rule
    └── docs/                        # 📚 Documentation & learning guides
```

> **Workflow:** Edit files in `services/*/src/` → run `./sync-src.sh` → commit & push → ArgoCD auto-deploys.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([🛒 Customer]) -->|HTTP /| Frontend[Frontend Nginx]
    Admin([🛡️ Admin]) -->|HTTP /admin| AdminPanel[Admin Dashboard Nginx]

    Frontend -->|POST /api/auth/login| AuthService[Auth Service]
    Frontend -->|GET /api/products| APIService[API Service]
    Frontend -->|POST /api/orders| APIService
    Frontend -->|POST /api/payments/charge| PaymentService[Payment Service]

    AdminPanel -->|POST /api/auth/login| AuthService
    AdminPanel -->|GET /api/payments/ledger| PaymentService
    AdminPanel -->|GET /api/orders| APIService
    AdminPanel -->|GET /api/products| APIService

    APIService -->|Secrets| SecretsManager[AWS Secrets Manager]
    PaymentService -->|Secrets| SecretsManager

    APIService -->|Stock decrement| DynamoInventory[(DynamoDB Inventory)]
    APIService -->|Write order| DynamoOrders[(DynamoDB Orders)]
    APIService -->|Publish event| SNS[SNS Topic]

    SNS -->|Deliver| SQS[SQS Queue]
    SQS -->|Poll| Worker[SQS Worker]

    Worker -->|Write transaction| DynamoTxs[(DynamoDB Transactions)]
    Worker -->|Upload invoice JSON| S3[(S3 Invoices)]

    PaymentService -->|Write payment| DynamoPayments[(DynamoDB Payments)]

    CloudWatch{{CloudWatch Alarms}} -->|CPU/Memory Spike| SNSAlerts[SNS Alerts Topic]
    SNSAlerts -->|Email| Email[saud.ali@kissht.com]
```

### Services
| Service | Stack | Port | Role |
|---------|-------|------|------|
| `frontend` | nginx + HTML/CSS/JS | 80 | Premium customer storefront |
| `admin` | nginx + HTML/CSS/JS | 80 | Admin dashboard & payment ledger |
| `auth` | Node.js 18 | 3000 | JWT-style authentication |
| `api` | Node.js 18 | 3000 | Product catalog & order management |
| `payment` | Node.js 18 | 3000 | Payment processing |
| `worker` | Node.js 18 | — | SQS consumer / invoice processor |

---

## 🔐 Access Credentials

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Customer | `user` | `user123` | Storefront only |
| Admin | `admin` | `admin123` | Admin dashboard only |

---

## 🌐 Application URLs

| Service | URL | Description |
|---------|-----|-------------|
| Customer Storefront | [http://localhost/](http://localhost/) | Premium shopping UI with cart, checkout |
| Admin Dashboard | [http://localhost/admin](http://localhost/admin) | Orders, payments, inventory, alerts |
| ArgoCD Console | `kubectl port-forward svc/argocd-server -n argocd 8080:443` → [https://localhost:8080](https://localhost:8080) | GitOps control plane |
| Grafana | [http://localhost/grafana](http://localhost/grafana) | Metrics & dashboards |

### Get ArgoCD Admin Password
```bash
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

---

## 🚀 Quick Start

### Prerequisites
- [Minikube](https://minikube.sigs.k8s.io/) with ingress addon
- [Helm 3](https://helm.sh/)
- [Terraform](https://www.terraform.io/)
- [LocalStack](https://localstack.cloud/) running on `localhost:4566`

### 1. Start Infrastructure
```bash
# Start LocalStack
localstack start -d

# Provision AWS resources (DynamoDB, SQS, SNS, S3, Secrets Manager)
cd project/infra
terraform init && terraform apply -auto-approve
```

### 2. Start Kubernetes
```bash
minikube start
minikube addons enable ingress
```

### 3. Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f project/applications/ecommerce-app.yaml
kubectl apply -f project/applications/argocd-ingress.yaml
```

### 4. Deploy the Platform
ArgoCD will auto-sync within 3 minutes. Force immediate sync:
```bash
kubectl patch application ecommerce-platform -n argocd \
  --type merge -p '{"operation":{"sync":{"revision":"HEAD","prune":true}}}'
```

### 5. Open the App
```bash
minikube tunnel  # Run in separate terminal
# Browse: http://localhost
```

---

## 🛠️ Development Workflow

When you edit service source files:

```bash
# 1. Edit files in services/*/src/
vim project/services/frontend/src/script.js

# 2. Sync to chart directory
./sync-src.sh

# 3. Commit & push — ArgoCD auto-deploys within 3 minutes
git add -A && git commit -m "feat: update frontend" && git push
```

---

## ☁️ AWS Services (via LocalStack)

| Service | Resource | Purpose |
|---------|----------|---------|
| DynamoDB | `dev-ecommerce-inventory` | Product catalog & stock |
| DynamoDB | `dev-ecommerce-orders` | Customer orders |
| DynamoDB | `dev-ecommerce-transactions` | Order transactions |
| DynamoDB | `dev-ecommerce-payments` | Payment ledger |
| SQS | `dev-process-order-queue` | Order event queue |
| SNS | `dev-order-events-topic` | Order event bus |
| SNS | `dev-system-alerts-topic` | CPU/Memory spike alerts → saud.ali@kissht.com |
| S3 | `dev-ecommerce-invoices` | Invoice JSON storage |
| Secrets Manager | `dev-ecommerce-secrets` | Runtime config & credentials |

---

## 📚 Documentation
- [Karpenter Explained](project/docs/karpenter-explained.md)
- [Architecture Decision Records](project/docs/)

---

## 📐 Kubernetes Ingress Routing

| Path | Service | Port |
|------|---------|------|
| `/api/auth/*` | auth | 3000 |
| `/api/payments/*` | payment | 3000 |
| `/api/*` | api | 3000 |
| `/admin*` | admin | 80 |
| `/*` | frontend | 80 |