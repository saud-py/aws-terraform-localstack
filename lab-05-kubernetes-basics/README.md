# Lab 05: Kubernetes Fundamentals with Minikube & Terraform

This lab introduces core Kubernetes concepts and showcases how to manage containers locally using Minikube. We explore two approaches:
1. **Raw Manifests** using `kubectl` (ideal for learning basics).
2. **Infrastructure as Code** using Terraform's `kubernetes` provider.

---

## 1. Prerequisites & Cluster Setup

1. **Start Docker Desktop**:
   Make sure Docker Desktop is open and fully running on your macOS machine.
   *If needed, you can launch it using CLI:*
   ```bash
   open -a Docker
   ```

2. **Start Minikube**:
   We will initialize the cluster using the Docker driver:
   ```bash
   minikube start --driver=docker
   ```

3. **Enable Ingress Addon**:
   The Ingress addon allows routing external HTTP/HTTPS traffic to internal cluster services based on path rules:
   ```bash
   minikube addons enable ingress
   ```

---

## 2. Approach A: Deployment via Kubectl (Raw Manifests)

First, we will deploy our applications using standard Kubernetes YAML definitions to practice the core CLI tools.

1. **Apply the manifests**:
   ```bash
   kubectl apply -f k8s-manifests/
   ```

2. **Learn Kubectl Troubleshooting Commands**:
   * **List Pods**: Check status (`Running`, `Pending`, etc.)
     ```bash
     kubectl get pods
     ```
   * **List Services & Ingress**: Check allocated Cluster IPs and Routing:
     ```bash
     kubectl get service,ingress
     ```
   * **Describe Resources**: Get detailed events for troubleshooting failures:
     ```bash
     kubectl describe pod -l app=backend
     ```
   * **Inspect Container Logs**: Read live standard output:
     ```bash
     kubectl logs -l app=backend
     ```

3. **Verify the App**:
   To access the application without configuring local `/etc/hosts` DNS, start a minikube tunnel or tunnel directly to the ingress controller:
   ```bash
   # In a separate terminal session:
   minikube tunnel
   ```
   Now check the endpoints:
   * **Frontend**: Open `http://localhost/` in your browser (shows K8s learning HTML page).
   * **Backend**: Curl the backend route `http://localhost/api/` (returns backend configuration details like DB credentials and environment).

4. **Cleanup Manifests**:
   ```bash
   kubectl delete -f k8s-manifests/
   ```

---

## 3. Approach B: Deployment via Terraform (HCL)

Now we will automate the exact same deployment using Terraform. This mirrors how modern teams manage cloud-native clusters at scale.

1. **Change directory**:
   ```bash
   cd terraform
   ```

2. **Initialize Terraform**:
   Downloads the `hashicorp/kubernetes` provider:
   ```bash
   terraform init
   ```

3. **Plan & Deploy**:
   ```bash
   terraform plan
   terraform apply -auto-approve
   ```

4. **Verify Resources**:
   Verify everything has been created using `kubectl` (it will read the exact same minikube cluster state!):
   ```bash
   kubectl get pods,service,ingress
   ```

5. **Cleanup Terraform Resources**:
   ```bash
   terraform destroy -auto-approve
   ```
