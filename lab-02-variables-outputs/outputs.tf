output "queue_url" {
  value       = aws_sqs_queue.my_queue.id
  description = "The URL of the created SQS queue"
}

output "queue_arn" {
  value       = aws_sqs_queue.my_queue.arn
  description = "The ARN of the created SQS queue"
}

output "dynamodb_table_arn" {
  value       = aws_dynamodb_table.my_table.arn
  description = "The ARN of the created DynamoDB table"
}
