resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-localstack-learning-bucket"

  tags = {
    Environment = "Local"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket" "saud_bucket" {
  bucket = "my-saud-bucket"

  tags = {
    Environment = "localstack"
    ManagedBy   = "Terraform"
  }
}
