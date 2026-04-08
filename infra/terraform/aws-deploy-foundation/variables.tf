variable "aws_region" {
  description = "AWS 리전"
  type        = string
}

variable "project_name" {
  description = "리소스 이름 접두사"
  type        = string
  default     = "ai-interview"
}

variable "frontend_bucket_name" {
  description = "프론트 정적 파일 배포용 S3 버킷 이름"
  type        = string
}

variable "backend_ecr_repository_name" {
  description = "백엔드 ECR 저장소 이름"
  type        = string
  default     = "ai-interview-backend"
}

variable "ai_ecr_repository_name" {
  description = "AI 서버 ECR 저장소 이름"
  type        = string
  default     = "ai-interview-ai"
}

variable "vpc_cidr" {
  description = "배포용 VPC CIDR"
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidr" {
  description = "EC2를 올릴 퍼블릭 서브넷 CIDR"
  type        = string
  default     = "10.42.10.0/24"
}

variable "ssh_ingress_cidrs" {
  description = "SSH 접속을 허용할 CIDR 목록. GitHub Actions 또는 관리자 공인 IP만 넣어야 합니다."
  type        = list(string)

  validation {
    condition     = length(var.ssh_ingress_cidrs) > 0
    error_message = "ssh_ingress_cidrs는 최소 1개 이상 필요합니다."
  }
}

variable "ec2_key_pair_name" {
  description = "Terraform이 생성할 EC2 Key Pair 이름"
  type        = string
  default     = "ai-interview-deploy-key"
}

variable "ec2_ssh_public_key" {
  description = "EC2 SSH 접속용 공개키"
  type        = string

  validation {
    condition     = can(regex("^ssh-", var.ec2_ssh_public_key))
    error_message = "ec2_ssh_public_key는 OpenSSH 공개키 형식이어야 합니다."
  }
}

variable "ec2_ssh_user" {
  description = "GitHub Actions가 SSH로 접속할 EC2 사용자"
  type        = string
  default     = "ec2-user"
}

variable "ec2_deploy_path" {
  description = "EC2 내 배포 파일 업로드 경로"
  type        = string
  default     = "/opt/ai-interview"
}

variable "ec2_instance_type" {
  description = "Docker로 백엔드, AI 서버, MariaDB, ChromaDB를 함께 돌릴 EC2 인스턴스 타입"
  type        = string
  default     = "t3.large"
}

variable "ec2_root_volume_size" {
  description = "EC2 루트 디스크 크기(GB)"
  type        = number
  default     = 40
}

variable "backend_origin_port" {
  description = "EC2에서 백엔드 컨테이너가 외부로 여는 포트"
  type        = number
  default     = 8080
}

variable "docker_compose_version" {
  description = "EC2 user_data에서 설치할 Docker Compose 버전"
  type        = string
  default     = "v2.33.1"
}

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default = {
    managed_by = "terraform"
    project    = "ai-interview"
  }
}
