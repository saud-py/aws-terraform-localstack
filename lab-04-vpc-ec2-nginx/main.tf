# 1. Generate SSH Key Pair automatically using TLS provider
resource "tls_private_key" "key" {
  algorithm = "RSA"
  rsa_bits  = 4048
}

resource "local_file" "private_key" {
  content         = tls_private_key.key.private_key_pem
  filename        = "${path.module}/my-key.pem"
  file_permission = "0600"
}

resource "aws_key_pair" "deployer" {
  key_name   = "my-localstack-key"
  public_key = tls_private_key.key.public_key_openssh
}

# 2. VPC Setup
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "main-vpc"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}

# 3. Internet Gateway
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "main-gw"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}

# 4. Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name        = "public-subnet"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}

# 5. Route Table
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name        = "public-rt"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}

resource "aws_route_table_association" "public_rt_assoc" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public_rt.id
}

# 6. Security Group (SSH and HTTP)
resource "aws_security_group" "allow_ssh_http" {
  name        = "allow_ssh_http"
  description = "Allow inbound SSH and HTTP traffic"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "allow-ssh-http-sg"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}

# 7. EC2 Instance
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0" # Mock AMI ID (LocalStack accepts any AMI ID)
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public.id
  key_name      = aws_key_pair.deployer.key_name

  vpc_security_group_ids = [aws_security_group.allow_ssh_http.id]

  # User data to install Nginx
  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              apt-get install nginx -y
              systemctl start nginx
              systemctl enable nginx
              echo "<h1>Welcome to LocalStack Web Server</h1>" > /var/www/html/index.html
              EOF

  tags = {
    Name        = "nginx-web-server"
    Environment = "Dev"
    Service     = "LocalStackLearning"
  }
}
