resource "aws_sqs_queue" "my_queue" {
  name                      = local.prefixed_queue_name
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400
  receive_wait_time_seconds = 10

  tags = local.common_tags
}

resource "aws_dynamodb_table" "my_table" {
  name         = local.prefixed_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = var.hash_key

  attribute {
    name = var.hash_key
    type = "S"
  }

  tags = local.common_tags
}
