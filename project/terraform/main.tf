# 1. DynamoDB Tables
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

resource "aws_dynamodb_table" "transactions" {
  name         = "dev-ecommerce-transactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transaction_id"

  attribute {
    name = "transaction_id"
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

# 7. Lambda Function Setup (Zip Archive)
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

# 8. S3 Invoice Processor Lambda
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

# Explicit CloudWatch Log Group for Invoice Processor
resource "aws_cloudwatch_log_group" "invoice_processor_logs" {
  name              = "/aws/lambda/invoice-processor"
  retention_in_days = 7
}

# S3 Event Trigger Permission
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

# 9. Loki Log Shipper Lambda (CloudWatch Log Streamer)
resource "aws_lambda_function" "loki_shipper" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "loki-log-shipper"
  role             = aws_iam_role.lambda_role.arn
  handler          = "loki-shipper.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      LOKI_ENDPOINT = "http://host.minikube.internal:3100/loki/api/v1/push"
    }
  }
}

# CloudWatch Log Trigger Permission
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.loki_shipper.arn
  principal     = "logs.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.invoice_processor_logs.arn}:*"
}

resource "aws_cloudwatch_log_subscription_filter" "loki_filter" {
  name            = "loki_log_filter"
  log_group_name  = aws_cloudwatch_log_group.invoice_processor_logs.name
  filter_pattern  = "" # Capture all log events
  destination_arn = aws_lambda_function.loki_shipper.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch]
}

# 10. API Gateway (v1 REST API)
resource "aws_api_gateway_rest_api" "rest_api" {
  name = "dev-ecommerce-api-gateway"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy" {
  rest_api_id             = aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy.http_method
  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "http://192.168.65.254:8085/api/{proxy}"
}

resource "aws_api_gateway_method" "root" {
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root" {
  rest_api_id             = aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_rest_api.rest_api.root_resource_id
  http_method             = aws_api_gateway_method.root.http_method
  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "http://192.168.65.254:8085/api/"
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy.id,
      aws_api_gateway_method.proxy.id,
      aws_api_gateway_integration.proxy.id,
      aws_api_gateway_integration.proxy.uri,
      aws_api_gateway_method.root.id,
      aws_api_gateway_integration.root.id,
      aws_api_gateway_integration.root.uri,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "stage" {
  deployment_id = aws_api_gateway_deployment.deployment.id
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  stage_name    = "dev"
}
