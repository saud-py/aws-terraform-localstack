locals {
  # Prefix resource names with environment
  prefixed_queue_name = "${var.environment}-${var.queue_name}"
  prefixed_table_name = "${var.environment}-${var.table_name}"

  # Common tags to apply to all resources
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "LocalStackLearning"
  }
}
