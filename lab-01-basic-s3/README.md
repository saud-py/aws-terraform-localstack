# Lab 01: S3 & LocalStack Provider Configuration

This lab introduces the core basics of Terraform and how it interacts with AWS resources locally via LocalStack.

## Core Concepts Explained

1. **Provider (`provider.tf`)**:
   Terraform uses "providers" to interact with cloud APIs. In this case, we use the `hashicorp/aws` provider.
   Normally, the provider would talk directly to the real AWS endpoints. However, we have configured `endpoints { s3 = "http://localhost:4566" }` and set `s3_use_path_style = true`. This redirects all S3 requests to our locally running LocalStack container!
   We also supply mock AWS credentials (`access_key` and `secret_key`) so that Terraform can sign requests without requesting real credentials.

2. **Resources (`main.tf`)**:
   Resources are the objects created in your infrastructure. Here, we create an `aws_s3_bucket` with the logical name `"my_bucket"` and physical bucket name `"my-localstack-learning-bucket"`.

---

## Steps to Run

1. **Change Directory to Lab 01**:
   ```bash
   cd lab-01-basic-s3
   ```

2. **Initialize Terraform**:
   This downloads the AWS provider plugin.
   ```bash
   terraform init
   ```

3. **Generate a Plan**:
   This shows you what resources Terraform will create.
   ```bash
   terraform plan
   ```

4. **Apply the Changes**:
   This will instruct Terraform to deploy the S3 bucket to LocalStack.
   ```bash
   terraform apply
   ```
   *(Type `yes` when prompted to confirm the action.)*

5. **Verify the Bucket**:
   You can check if the bucket exists inside LocalStack using `curl` or the `aws` CLI:
   ```bash
   aws --endpoint-url=http://localhost:4566 s3 ls
   ```

6. **Destroy the Infrastructure**:
   To clean up the S3 bucket:
   ```bash
   terraform destroy
   ```
   *(Type `yes` when prompted to confirm the deletion.)*
