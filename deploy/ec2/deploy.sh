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

# 주의:
# - Windows에서 GitHub Secret 본문이나 .env 파일을 만들면 UTF-8 BOM이 앞에 붙는 경우가 있습니다.
# - bash source는 BOM이 붙은 첫 줄을 변수 선언이 아니라 잘못된 명령으로 볼 수 있어
#   배포 초반에 `command not found`(127)로 바로 실패할 수 있습니다.
# - 배포 전에 BOM을 제거해 두면 로컬/CI/수동 업로드 경로가 달라도 같은 문제를 막을 수 있습니다.
python3 - <<'PY' "${ENV_FILE}"
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8-sig")
path.write_text(text.replace("\r\n", "\n"), encoding="utf-8")
PY

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
