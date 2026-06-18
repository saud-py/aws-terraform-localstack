# Lab 02: Variables, Outputs, & Locals

This lab demonstrates how to make your Terraform code reusable and clean by using input variables, local values, and outputs. We will provision an SQS Queue and a DynamoDB table.

## Core Concepts Explained

1. **Variables (`variables.tf`)**:
   Input variables are like function arguments. They allow customizing your deployments without editing the core logic. You can define defaults, types, and descriptions.

2. **Locals (`locals.tf`)**:
   Local values are like temporary/helper variables inside a program. They let you compute complex values once and reference them in multiple places (e.g. prefixing resource names or constructing common tag maps).

3. **Outputs (`outputs.tf`)**:
   Outputs are like return values. When Terraform finishes deploying, it prints the outputs. They are also useful for other resources or external CLI scripts to query.

---

## Steps to Run

1. **Change Directory to Lab 02**:
   ```bash
   cd lab-02-variables-outputs
   ```

2. **Initialize Terraform**:
   ```bash
   terraform init
   ```

3. **Plan and Inspect Defaults**:
   Run a plan and notice the resource names generated (`dev-learning-queue` and `dev-learning-table`):
   ```bash
   terraform plan
   ```

4. **Plan with Custom Variable Values**:
   You can override variables using the `-var` flag:
   ```bash
   terraform plan -var="environment=prod" -var="queue_name=customer-billing"
   ```
   *(Notice how the name updates automatically to `prod-customer-billing` thanks to `locals.tf`!)*

5. **Apply the Changes**:
   Apply using default values:
   ```bash
   terraform apply
   ```
   *(Type `yes` when prompted.)*

6. **Verify the Outputs**:
   Terraform will output the Queue URL, Queue ARN, and DynamoDB ARN. You can also fetch them manually anytime using:
   ```bash
   terraform output
   ```

7. **Verify via AWS CLI / LocalStack**:
   ```bash
   # List queues
   aws --endpoint-url=http://localhost:4566 sqs list-queues

   # List DynamoDB tables
   aws --endpoint-url=http://localhost:4566 dynamodb list-tables
   ```

8. **Destroy the Infrastructure**:
   ```bash
   terraform destroy
   ```
   *(Type `yes` when prompted.)*
