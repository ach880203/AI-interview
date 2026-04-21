# 배포 기록 보관

이 저장소는 과거 AWS에 배포된 이력이 있습니다.

## 정리 일시

- 2026-04-21 (KST)

## 배포 이력

- EC2 기반 애플리케이션 서버
- ECR 기반 컨테이너 이미지 저장소
- S3 기반 프론트엔드 정적 파일 배포
- CloudFront 기반 프론트엔드/API 배포
- Terraform 경로: `infra/terraform/aws-deploy-foundation`

## 정리 내용

- AWS에 남아 있던 과금 가능 배포 리소스를 종료 또는 삭제했습니다.
- 배포 관련 GitHub Actions 워크플로는 실수로 재배포되지 않도록 비활성화했습니다.
- 이 저장소는 현재 운영 중인 AWS 리소스를 의미하지 않으며, 배포 이력이 있었음을 남기는 용도로 유지합니다.

## 재배포 주의

재배포가 필요하면 비용이 발생할 수 있으므로 Terraform 변수, GitHub Secrets/Variables, AWS 예산 알림을 먼저 다시 점검해야 합니다.
