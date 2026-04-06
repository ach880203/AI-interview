# ── Stage 1: 빌드 ──────────────────────────────────────────────
# Gradle 빌드 환경 (JDK 21 + Gradle Wrapper 사용)
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Gradle Wrapper 및 빌드 스크립트 먼저 복사 (의존성 레이어 캐시 활용)
COPY gradlew .
COPY gradle/ gradle/
COPY build.gradle.kts .
COPY settings.gradle.kts .

# gradlew 실행 권한 부여 후 의존성 다운로드 (소스 없이 먼저 수행 → 캐시)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon 2>/dev/null || true

# 소스 코드 복사 후 JAR 빌드 (테스트는 Docker 외부에서 별도 실행)
COPY src/ src/
RUN ./gradlew bootJar -x test --no-daemon

# ── Stage 2: 런타임 ────────────────────────────────────────────
# JRE만 포함한 경량 이미지 사용 (JDK 불필요 → 이미지 크기 절감)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# 빌드 스테이지에서 생성된 JAR만 복사
COPY --from=builder /app/build/libs/ai-interview-*.jar app.jar

# 비루트 사용자로 실행 (보안 강화)
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

EXPOSE 8080

# spring.profiles.active는 환경 변수로 주입 (예: SPRING_PROFILES_ACTIVE=prod)
ENTRYPOINT ["java", "-jar", "app.jar"]
