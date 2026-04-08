terraform {
  # 로컬 검증 기준 최신 안정 버전인 1.14 계열과 맞춰 사용합니다.
  required_version = ">= 1.14.0, < 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.30"
    }
  }
}
