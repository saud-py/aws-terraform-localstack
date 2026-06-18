# 1. DynamoDB Table
resource "aws_dynamodb_table" "orders" {
  name         = "dev-ecommerce-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = "dev"
    Project     = "ECommercePlatform"
  }
}

# 2. S3 Bucket for Invoices
resource "aws_s3_bucket" "invoices" {
  bucket        = "dev-ecommerce-invoices"
  force_destroy = true
}

# 3. SNS Topic for Order Events
resource "aws_sns_topic" "order_events" {
  name = "dev-order-events-topic"
}

# 4. SQS Queue for Order Processing
resource "aws_sqs_queue" "process_order" {
  name = "dev-process-order-queue"
}

# 5. SNS Subscription to SQS
resource "aws_sns_topic_subscription" "sns_to_sqs" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.process_order.arn
}

# 6. SQS Queue Policy to allow SNS publishing
data "aws_iam_policy_document" "sqs_policy" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.process_order.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.order_events.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "sqs_policy" {
  queue_url = aws_sqs_queue.process_order.id
  policy    = data.aws_iam_policy_document.sqs_policy.json
}

# 7. Lambda Function Setup
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "dev-invoice-processor-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_lambda_function" "invoice_processor" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "invoice-processor"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      NODE_ENV = "development"
    }
  }
}

# 8. S3 Bucket Notification Triggering Lambda
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invoice_processor.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.invoices.arn
}

resource "aws_s3_bucket_notification" "s3_notification" {
  bucket = aws_s3_bucket.invoices.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.invoice_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "invoices/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}
