# Lab 03: Resource Dependencies & IAM Policies

This lab demonstrates how resources depend on each other and how Terraform builds a directed acyclic graph (DAG) to determine the order of resource creation. We'll set up an S3 Bucket that automatically notifies an SQS Queue when files with a `.json` extension are uploaded.

## Core Concepts Explained

1. **Implicit Dependencies**:
   When resource A references a property of resource B (e.g. `resources = [aws_sqs_queue.notification_queue.arn]`), Terraform automatically knows that resource B must be created *before* resource A.

2. **Explicit Dependencies (`depends_on`)**:
   Sometimes, an API requires an authorization configuration (like a policy) to be applied before another action is attempted. Here, we must apply the `aws_sqs_queue_policy` *before* configuring `aws_s3_bucket_notification`, otherwise the notification setup will fail because the bucket won't have permission to write to the queue.
   We achieve this by adding:
   ```hcl
   depends_on = [aws_sqs_queue_policy.notification_queue_policy]
   ```

3. **Data Sources (`data`)**:
   Data sources allow fetching data or constructing formats (like IAM policy JSON documents) without creating new infrastructure resources. We use `data "aws_iam_policy_document"` to programmatically generate a clean, JSON-formatted policy.

---

## Steps to Run

1. **Change Directory to Lab 03**:
   ```bash
   cd lab-03-dependencies-iam
   ```

2. **Initialize Terraform**:
   ```bash
   terraform init
   ```

3. **Create the Infrastructure**:
   ```bash
   terraform apply
   ```
   *(Type `yes` when prompted.)*

4. **Verify S3 and SQS**:
   Check that both S3 bucket and SQS queue were created:
   ```bash
   aws --endpoint-url=http://localhost:4566 s3 ls
   aws --endpoint-url=http://localhost:4566 sqs list-queues
   ```

5. **Test the Event Notification**:
   Let's upload a `.json` file to the S3 bucket to trigger the SQS notification:
   ```bash
   # Create a sample JSON file
   echo '{"message": "Hello from LocalStack!"}' > sample.json

   # Copy to S3
   aws --endpoint-url=http://localhost:4566 s3 cp sample.json s3://learning-upload-bucket/sample.json

   # Read messages from the SQS queue
   aws --endpoint-url=http://localhost:4566 sqs receive-message --queue-url http://localhost:4566/000000000000/s3-upload-notification-queue
   ```
   *(You should see a message containing the S3 event notification JSON!)*

6. **Cleanup**:
   ```bash
   rm sample.json
   terraform destroy
   ```
   *(Type `yes` when prompted.)*
