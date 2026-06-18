# 1. AWS Secrets Manager (in LocalStack)
resource "aws_secretsmanager_secret" "db_password_secret" {
  name        = "my-db-password"
  description = "Database credentials stored in AWS Secrets Manager"
}

resource "aws_secretsmanager_secret_version" "db_password_version" {
  secret_id = aws_secretsmanager_secret.db_password_secret.id
  secret_string = jsonencode({
    password = "super-secure-local-password-from-secretsmanager"
  })
}

# 2. ConfigMaps & Secrets (sourcing password from Secrets Manager)
resource "kubernetes_config_map" "backend_config" {
  metadata {
    name      = "backend-config"
    namespace = var.namespace
  }

  data = {
    APP_ENV    = "local-dev"
    REDIS_HOST = "redis"
  }
}

resource "kubernetes_secret" "backend_secret" {
  metadata {
    name      = "backend-secret"
    namespace = var.namespace
  }

  type = "Opaque"

  data = {
    # Decode the JSON payload from Secrets Manager and read the password key
    DB_PASSWORD = jsondecode(aws_secretsmanager_secret_version.db_password_version.secret_string)["password"]
  }
}

# 3. Redis deployment & service
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = var.namespace
    labels = {
      app = "redis"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis"
        }
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"

          port {
            container_port = 6379
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = var.namespace
  }

  spec {
    port {
      port        = 6379
      target_port = 6379
    }

    selector = {
      app = "redis"
    }
  }
}

# 4. Backend deployment & service
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "backend"
    namespace = var.namespace
    labels = {
      app = "backend"
    }
  }

  spec {
    replicas = var.backend_replicas

    selector {
      match_labels = {
        app = "backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "backend"
        }
      }

      spec {
        container {
          name  = "backend"
          image = "hashicorp/http-echo:latest"
          args  = ["-text=Backend Echo Service (Terraform). Env: $(ENV_NAME), Redis Host: $(REDIS_HOST), DB Password: $(DB_PASS)"]

          port {
            container_port = 5678
          }

          env {
            name = "ENV_NAME"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.backend_config.metadata[0].name
                key  = "APP_ENV"
              }
            }
          }

          env {
            name = "REDIS_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.backend_config.metadata[0].name
                key  = "REDIS_HOST"
              }
            }
          }

          env {
            name = "DB_PASS"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.backend_secret.metadata[0].name
                key  = "DB_PASSWORD"
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend" {
  metadata {
    name      = "backend"
    namespace = var.namespace
  }

  spec {
    port {
      port        = 8080
      target_port = 5678
    }

    selector = {
      app = "backend"
    }
  }
}

# 5. Frontend deployment & service (fetching assets via initContainer)
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "frontend"
    namespace = var.namespace
    labels = {
      app = "frontend"
    }
  }

  spec {
    replicas = var.frontend_replicas

    selector {
      match_labels = {
        app = "frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "frontend"
        }
      }

      spec {
        init_container {
          name    = "git-clone"
          image   = "alpine/git:latest"
          command = ["sh", "-c", "git clone https://github.com/octocat/Spoon-Knife.git /data"]

          volume_mount {
            name       = "html-volume"
            mount_path = "/data"
          }
        }

        container {
          name  = "frontend"
          image = "nginx:alpine"

          port {
            container_port = 80
          }

          volume_mount {
            name       = "html-volume"
            mount_path = "/usr/share/nginx/html"
          }
        }

        volume {
          name = "html-volume"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "frontend"
    namespace = var.namespace
  }

  spec {
    port {
      port        = 80
      target_port = 80
    }

    selector = {
      app = "frontend"
    }
  }
}

# 6. Ingress Configuration
resource "kubernetes_ingress_v1" "app_ingress" {
  metadata {
    name      = "app-ingress"
    namespace = var.namespace
    annotations = {
      "nginx.ingress.kubernetes.io/rewrite-target" = "/$1"
    }
  }

  spec {
    rule {
      http {
        path {
          path      = "/(.*)"
          path_type = "ImplementationSpecific"
          backend {
            service {
              name = kubernetes_service.frontend.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }

        path {
          path      = "/api/(.*)"
          path_type = "ImplementationSpecific"
          backend {
            service {
              name = kubernetes_service.backend.metadata[0].name
              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}
