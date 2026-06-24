# Phase 7: E-Commerce Cloud Platform Project

This project deploys a fully event-driven, microservice-based E-Commerce cloud platform utilizing a hybrid local architecture:
- **Cloud Infrastructure (AWS Services)**: Provisioned on LocalStack via Terraform.
- **Application Services (Containers)**: Parameterized via Helm and deployed on Minikube via ArgoCD GitOps.

---

## 1. System Flow & Architecture

1. **User Interaction**: Users access the platform via Ingress. The Frontend provides a web GUI to place orders.
2. **Order Ingestion**: The API Service writes a new order to the DynamoDB Table with status `PENDING` and publishes a record message to the SNS Topic.
3. **Queue Delivery**: SNS publishes the event message into the SQS Queue.
4. **Order Processing**: The Worker Service polls the SQS Queue, processes the order, and creates an invoice JSON file in the S3 Bucket under `invoices/`.
5. **Post-Processing (Serverless)**: S3 triggers an AWS Lambda Function when the invoice JSON file is created. The Lambda function reads the invoice details and updates the order status inside the DynamoDB Table to `COMPLETED`.

---

## 2. Setup & Deployment Instructions

### Step 1: Provision LocalStack Infrastructure
1. Make sure LocalStack is running:
   ```bash
   localstack status
   ```
2. Navigate to the terraform directory:
   ```bash
   cd project/terraform
   ```
3. Initialize and deploy resources:
   ```bash
   terraform init
   terraform apply -auto-approve
   ```

---

### Step 2: Push Configurations to GitHub
ArgoCD reads configuration directly from Git. Ensure you commit and push the newly created `project` configurations to your GitHub repository:
```bash
git add .
git commit -m "Add Phase 7 E-Commerce Platform project files"
git push origin basics-using-localstack
```

---

### Step 3: Deploy workloads via ArgoCD
1. Register the application with ArgoCD:
   ```bash
   kubectl apply -f project/applications/ecommerce-app.yaml
   ```
2. Open the ArgoCD Web Console to monitor the deployment. ArgoCD will spin up:
   - `ecommerce-frontend`
   - `ecommerce-api`
   - `ecommerce-worker`
   - Services & Ingress routing

---

### Step 4: Access URLs & Dashboards
Ensure that `minikube tunnel` is running in a background terminal. You can then access the main applications and operational consoles at the following URLs:

* **E-Commerce Web Board (Frontend)**: [http://localhost/](http://localhost/)
* **Grafana Dashboard**: [http://localhost/grafana/](http://localhost/grafana/)
  * *Credentials:* Username `admin` / Password `admin`
* **ArgoCD Web Console**: Access by running port-forwarding:
  ```bash
  kubectl port-forward svc/argocd-server -n argocd 8080:443
  ```
  Then open [https://localhost:8080/](https://localhost:8080/)

---

## 3. Operations & Verification

### Step 1: Place an Order
Access the Frontend web interface (or start a `minikube tunnel` and open `http://localhost/`). Enter a purchase amount and click **Place Order**.
You can also trigger it via CLI cURL:
```bash
curl -X POST http://localhost/api/orders -H "Content-Type: application/json" -d '{"amount": 149.99}'
```
*Expected response:*
```json
{
  "orderId": "order_xxxxxxxxx",
  "status": "PENDING",
  "amount": 149.99
}
```

### Step 2: Verify SQS Message Queue
To verify the message was published to SQS and read by the worker, run:
```bash
aws --endpoint-url=http://localhost:4566 sqs receive-message --queue-url http://localhost:4566/000000000000/dev-process-order-queue --region us-east-1
```
*(It should show empty if the worker has already polled and processed it.)*

### Step 3: Verify S3 Invoice Storage
Confirm the worker successfully uploaded the invoice JSON:
```bash
aws --endpoint-url=http://localhost:4566 s3 ls s3://dev-ecommerce-invoices/invoices/ --region us-east-1
```

### Step 4: Verify Order Completion & Transactions (Lambda Triggered)
1. Run a DynamoDB scan to see if the order status was automatically updated to `COMPLETED` by the Lambda function:
   ```bash
   aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name dev-ecommerce-orders --region us-east-1
   ```
2. Scan the transactions table to verify the corresponding transaction status was updated to `SUCCESS`:
   ```bash
   aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name dev-ecommerce-transactions --region us-east-1
   ```

---

## 4. API Gateway & Logging Integration

### Querying via API Gateway
API Gateway (REST API v1) routes traffic into Minikube. 
1. Get the REST API Gateway ID:
   ```bash
   aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --region us-east-1
   ```
   *(Locate the `id` value of your API)*
2. Submit a request using the API Gateway URL directly:
   ```bash
   curl -X POST http://localhost:4566/restapis/jkdcyrvxry/dev/_user_request_/orders -H "Content-Type: application/json" -d '{"amount": 250.00}'
   ```
   *(API Gateway will proxy the request directly into the frontend/api routes inside your cluster!)*

### Verifying CloudWatch to Loki Log Pipeline
When the `invoice-processor` Lambda executes, its logs are pushed to CloudWatch Log Groups. A subscription filter sends those logs to the `loki-log-shipper` Lambda, which POSTs them into Loki.
1. Query Grafana Loki (from the Grafana console or using Loki API):
   ```bash
   curl -G -s "http://localhost:3100/loki/api/v1/query_range" --data-urlencode 'query={job="aws-cloudwatch"}' | jq
   ```
   *(You will see the decompressed Lambda logs streamed in real-time to your Loki server!)*

---

## 5. Grafana & Prometheus Monitoring

We can deploy Grafana and Prometheus directly through ArgoCD:

### Deploying Grafana & Prometheus
1. Apply the monitoring application manifest:
   ```bash
   kubectl apply -f project/applications/monitoring.yaml
   ```
2. Wait for the pods in the cluster to initialize.

### Accessing the Grafana Dashboard
1. Ensure your `minikube tunnel` is active.
2. Open your web browser and navigate to:
   `http://localhost/grafana/`
3. Log in with the default administrator credentials:
   - **Username**: `admin`
   - **Password**: `admin`
4. Under **Connections -> Data Sources**, you can add **Loki** (`http://localhost:3100`) and **Prometheus** to explore and visualize all metrics and logs on unified dashboards!
