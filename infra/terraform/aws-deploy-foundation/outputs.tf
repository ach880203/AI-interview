output "vpc_id" {
  description = "배포용 VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "배포용 퍼블릭 서브넷 ID"
  value       = aws_subnet.public.id
}

output "frontend_bucket_name" {
  description = "프론트 정적 파일용 S3 버킷 이름"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_distribution_id" {
  description = "프론트 CloudFront 배포 ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_cloudfront_domain_name" {
  description = "프론트 CloudFront 기본 도메인"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "api_cloudfront_distribution_id" {
  description = "백엔드 API CloudFront 배포 ID"
  value       = aws_cloudfront_distribution.api.id
}

output "api_cloudfront_domain_name" {
  description = "백엔드 API CloudFront 기본 도메인"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "api_base_url" {
  description = "프론트 빌드 시 VITE_API_BASE_URL로 넣을 값"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "backend_ecr_repository_url" {
  description = "백엔드 ECR 저장소 URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ai_ecr_repository_url" {
  description = "AI 서버 ECR 저장소 URL"
  value       = aws_ecr_repository.ai_server.repository_url
}

output "ec2_instance_id" {
  description = "배포용 EC2 인스턴스 ID"
  value       = aws_instance.app.id
}

output "ec2_public_ip" {
  description = "GitHub Actions SSH 배포에 사용할 EC2 공인 IP"
  value       = aws_eip.app.public_ip
}

output "ec2_public_dns" {
  description = "배포용 EC2 공개 DNS"
  value       = local.ec2_public_dns_via_eip
}

output "ec2_ssh_user" {
  description = "GitHub Actions SSH 접속 사용자"
  value       = var.ec2_ssh_user
}

output "ec2_deploy_path" {
  description = "EC2 배포 경로"
  value       = var.ec2_deploy_path
}

output "github_actions_variables_guide" {
  description = "Terraform 적용 후 GitHub Repository Variables에 옮겨 적을 주요 값"
  value = {
    AWS_REGION                          = var.aws_region
    EC2_INSTANCE_ID                     = aws_instance.app.id
    ECR_BACKEND_REPOSITORY              = var.backend_ecr_repository_name
    ECR_AI_REPOSITORY                   = var.ai_ecr_repository_name
    FRONTEND_S3_BUCKET                  = aws_s3_bucket.frontend.bucket
    FRONTEND_CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.frontend.id
    EC2_HOST                            = aws_eip.app.public_ip
    EC2_USER                            = var.ec2_ssh_user
    EC2_DEPLOY_PATH                     = var.ec2_deploy_path
    VITE_API_BASE_URL                   = "https://${aws_cloudfront_distribution.api.domain_name}"
  }
}
