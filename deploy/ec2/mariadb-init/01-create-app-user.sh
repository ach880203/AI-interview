#!/bin/sh
set -eu

# 왜 이렇게 하나요?
# - 운영 DB는 최초 볼륨 생성 시점에만 초기 계정/권한이 만들어집니다.
# - 환경변수만으로는 앱 계정의 host 범위('%')가 기대한 대로 잡히지 않는 경우가 있어
#   첫 초기화 단계에서 SQL을 직접 실행해 백엔드 접속 계정을 확실하게 보장합니다.

APP_DB_USERNAME="${APP_DB_USERNAME:-aiapp}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
APP_DB_NAME="${MARIADB_DATABASE:-ai_interview}"

mariadb --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<EOSQL
CREATE USER IF NOT EXISTS '${APP_DB_USERNAME}'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USERNAME}'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${APP_DB_USERNAME}'@'%';
FLUSH PRIVILEGES;
EOSQL
