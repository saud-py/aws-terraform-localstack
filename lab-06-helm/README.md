# Lab 06: Helm (Kubernetes Package Manager)

This lab introduces Helm, the standard package manager for Kubernetes. Helm allows you to bundle related manifests into a single reusable unit called a "Chart", parameterize variables using `values.yaml`, and control deployments as named releases.

---

## 1. Core Concepts Explained

1. **Chart (`Chart.yaml`)**:
   Metadata containing chart name, API version, description, and application version.

2. **Values (`values.yaml`)**:
   A declarative configuration file containing key-value pairs representing parameters (e.g. replicas, image registry, secrets).

3. **Templates (`templates/`)**:
   Kubernetes YAML resource specifications containing placeholder expressions (like `{{ .Values.backend.replicas }}`) compiled dynamically by Helm.

4. **Helpers (`_helpers.tpl`)**:
   Reusable Go template functions defining common snippets (labels, name generation).

---

## 2. Steps to Run

1. **Verify Helm is installed**:
   ```bash
   helm version
   ```

2. **Navigate to the Lab directory**:
   ```bash
   cd lab-06-helm
   ```

3. **Dry-run Template Generation**:
   Compile the templates locally without sending them to Kubernetes. This is extremely useful for checking syntax:
   ```bash
   helm template myapp ./helm-charts/myapp
   ```

4. **Install the Chart**:
   Deploy the chart onto your active Minikube cluster as a release named `release-prod`:
   ```bash
   helm install release-prod ./helm-charts/myapp
   ```

5. **Verify Running Resources**:
   ```bash
   kubectl get pods,svc,ingress
   ```

6. **Upgrade the Deployment**:
   Change replica counts or other values dynamically on the fly:
   ```bash
   # Scale backend replicas to 3
   helm upgrade release-prod ./helm-charts/myapp --set backend.replicas=3
   ```
   *Verify the new pod instances spinning up:*
   ```bash
   kubectl get pods
   ```

7. **Uninstall/Teardown**:
   Remove all deployed resources cleanly:
   ```bash
   helm uninstall release-prod
   ```
