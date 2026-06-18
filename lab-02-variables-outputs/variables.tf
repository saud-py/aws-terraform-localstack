variable "environment" {
  type        = string
  description = "The environment name (e.g. dev, staging, prod)"
  default     = "dev"
}

variable "queue_name" {
  type        = string
  description = "Name of the SQS queue"
  default     = "learning-queue"
}

variable "table_name" {
  type        = string
  description = "Name of the DynamoDB table"
  default     = "learning-table"
}

variable "hash_key" {
  type        = string
  description = "DynamoDB partition key"
  default     = "id"
}
