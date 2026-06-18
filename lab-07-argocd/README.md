# Lab 07: GitOps with ArgoCD

This lab introduces **GitOps**, a modern software deployment methodology where Git is used as the single source of truth for declarative infrastructure and applications. We will use **ArgoCD**, a GitOps agent running on Kubernetes, to automatically sync changes from this Git repository into your Minikube cluster.

---

## 1. Core Concepts Explained

1. **Declarative State**: All Kubernetes configurations (YAML/Helm charts) are stored in Git.
2. **Reconciliation Loop**: ArgoCD continuously compares the desired state in Git against the live state inside Kubernetes. If there is a drift (e.g. replicas configured as 2 in Git but running as 1 in K8s), ArgoCD corrects the live cluster to match Git.
3. **Application Custom Resource (CRD)**: Defines the mapping between the Git repository source, path to manifests, values overrides, and target cluster namespace.

---

## 2. Steps to Run

### Step 1: Install ArgoCD inside Minikube
1. Create the `argocd` namespace:
   ```bash
   kubectl create namespace argocd
   ```
2. Apply the cached installation manifest:
   ```bash
   kubectl apply -n argocd -f gitops/argocd-install/install.yaml
   ```
3. Watch the pods until all ArgoCD components are `Running`:
   ```bash
   kubectl get pods -n argocd
   ```

---

### Step 2: Access the ArgoCD Web UI
1. Port-forward the ArgoCD API Server:
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   ```
2. Access the UI at `https://localhost:8080` (bypass the SSL warning).
3. The username is `admin`. Retrieve the default generated password by running:
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 --decode; echo
   ```

---

### Step 3: Configure and Deploy the GitOps Application
1. **Push your code**: Since ArgoCD needs to access a remote repository, make sure you push this repository to your GitHub account.
2. **Update the repository URL**: Open [gitops/applications/myapp.yaml](file:///Users/saudali/Documents/github/aws-terraform-localstack/lab-07-argocd/gitops/applications/myapp.yaml) and update the `repoURL` value to point to your GitHub fork:
   ```yaml
   repoURL: 'https://github.com/<your-username>/aws-terraform-localstack.git'
   ```
3. Apply the application manifest to register the application with ArgoCD:
   ```bash
   kubectl apply -f gitops/applications/myapp.yaml
   ```
4. Open the ArgoCD UI. You will see `myapp` appear! It will automatically fetch the Helm chart from your repository, compile it using the configurations in `myapp-values/values-dev.yaml`, and deploy it to the `default` namespace.

---

### Step 4: Test the Reconciliation Loop
1. Manually change something in the cluster (e.g., delete the backend deployment):
   ```bash
   kubectl delete deployment release-prod-myapp-backend
   ```
2. Watch the ArgoCD UI. In a few seconds, ArgoCD will detect that the backend deployment is missing (Out of Sync) and automatically recreate it to restore the Git state!
