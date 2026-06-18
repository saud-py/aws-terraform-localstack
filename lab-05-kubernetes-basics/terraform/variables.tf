variable "namespace" {
  type        = string
  description = "Kubernetes namespace to deploy resources into"
  default     = "default"
}

variable "frontend_replicas" {
  type        = number
  description = "Number of frontend replicas"
  default     = 1
}

variable "backend_replicas" {
  type        = number
  description = "Number of backend replicas"
  default     = 1
}
