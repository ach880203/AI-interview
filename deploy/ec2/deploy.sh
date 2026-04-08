#!/usr/bin/env bash
set -euo pipefail

# 왜 이렇게 했는지:
# - GitHub Actions에서 compose 파일과 .env만 올려도 EC2가 스스로 최신 이미지를 내려받아 재배포하도록 단순화했습니다.
# - 운영 서버에서 빌드하지 않고 ECR 이미지를 pull만 하므로 배포 시간이 짧고 실패 지점이 줄어듭니다.

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ai-interview}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "운영 compose 파일이 없습니다: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "운영 환경변수 파일이 없습니다: ${ENV_FILE}" >&2
  exit 1
fi

# .env 안의 BACKEND_IMAGE / AI_SERVER_IMAGE / ECR_REGISTRY 값을 재사용하기 위해 불러옵니다.
# set -a를 사용하면 compose 실행 전에 필요한 값이 환경변수로 자동 export 됩니다.
set -a
source "${ENV_FILE}"
set +a

if [[ -z "${ECR_REGISTRY:-}" && -n "${BACKEND_IMAGE:-}" ]]; then
  # 이미지 경로가 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/repo:tag 형태라고 가정하고
  # 앞쪽 레지스트리만 잘라내어 ECR 로그인에 재사용합니다.
  ECR_REGISTRY="${BACKEND_IMAGE%%/*}"
fi

if [[ -n "${AWS_REGION:-}" && -n "${ECR_REGISTRY:-}" ]]; then
  # 주의:
  # - EC2에 AWS CLI가 설치되어 있어야 합니다.
  # - ECR 로그인은 EC2 IAM Role(권장) 또는 서버 내 AWS 자격증명으로 처리합니다.
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull backend ai-server
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

# 주의:
# - DB/Chroma 볼륨은 유지해야 하므로 down -v는 절대 사용하지 않습니다.
# - 오래된 이미지 정리만 수행해 디스크 누적을 줄입니다.
docker image prune -f

echo "EC2 배포가 완료되었습니다."
