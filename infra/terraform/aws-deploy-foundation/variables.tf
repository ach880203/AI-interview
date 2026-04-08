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

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default = {
    managed_by = "terraform"
    project    = "ai-interview"
  }
}
