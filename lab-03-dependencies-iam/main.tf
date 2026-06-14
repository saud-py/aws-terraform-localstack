# 1. S3 Bucket
resource "aws_s3_bucket" "upload_bucket" {
  bucket        = "learning-upload-bucket"
  force_destroy = true
}

# 2. SQS Queue to receive notifications
resource "aws_sqs_queue" "notification_queue" {
  name = "s3-upload-notification-queue"
}

# 3. IAM Policy Document for SQS (allows S3 to publish messages)
data "aws_iam_policy_document" "sqs_policy" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.notification_queue.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.upload_bucket.arn]
    }
  }
}

# 4. Apply SQS Queue Policy
resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id
  policy    = data.aws_iam_policy_document.sqs_policy.json
}

# 5. S3 Bucket Notification Configuration
# This depends on the SQS queue policy being applied first,
# otherwise AWS (and LocalStack) validation might fail.
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.upload_bucket.id

  queue {
    queue_arn     = aws_sqs_queue.notification_queue.arn
    events        = ["s3:ObjectCreated:*"]
    filter_suffix = ".json"
  }

  # Explicit dependency to ensure the queue policy is in place first
  depends_on = [aws_sqs_queue_policy.notification_queue_policy]
}
