output "frontend_bucket_name" {
  description = "프론트 정적 파일용 S3 버킷 이름"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront 배포 ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_cloudfront_domain_name" {
  description = "CloudFront 기본 도메인"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "backend_ecr_repository_url" {
  description = "백엔드 ECR 저장소 URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ai_ecr_repository_url" {
  description = "AI 서버 ECR 저장소 URL"
  value       = aws_ecr_repository.ai_server.repository_url
}
