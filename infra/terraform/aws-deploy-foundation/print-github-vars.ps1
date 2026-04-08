param(
    [string]$TerraformOutputJsonPath = ".\terraform-outputs.json"
)

if (-not (Test-Path $TerraformOutputJsonPath)) {
    Write-Error "Terraform 출력 파일이 없습니다: $TerraformOutputJsonPath"
    exit 1
}

# 왜 이 스크립트를 두나:
# - terraform output -json 결과는 중첩 구조라서 사람이 GitHub Variables로 옮길 때 실수하기 쉽습니다.
# - 이 스크립트는 필요한 값만 평평하게 출력해 복붙 과정을 단순화합니다.
$terraformOutputs = Get-Content -Encoding UTF8 $TerraformOutputJsonPath | ConvertFrom-Json
$guide = $terraformOutputs.github_actions_variables_guide.value

Write-Host "GitHub Repository Variables"
Write-Host "AWS_REGION=$($guide.AWS_REGION)"
Write-Host "ECR_BACKEND_REPOSITORY=$($guide.ECR_BACKEND_REPOSITORY)"
Write-Host "ECR_AI_REPOSITORY=$($guide.ECR_AI_REPOSITORY)"
Write-Host "FRONTEND_S3_BUCKET=$($guide.FRONTEND_S3_BUCKET)"
Write-Host "FRONTEND_CLOUDFRONT_DISTRIBUTION_ID=$($guide.FRONTEND_CLOUDFRONT_DISTRIBUTION_ID)"
Write-Host "EC2_HOST=$($guide.EC2_HOST)"
Write-Host "EC2_USER=$($guide.EC2_USER)"
Write-Host "EC2_DEPLOY_PATH=$($guide.EC2_DEPLOY_PATH)"
Write-Host "VITE_API_BASE_URL=$($guide.VITE_API_BASE_URL)"
