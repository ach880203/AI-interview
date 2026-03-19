FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY gradlew gradlew.bat ./
COPY gradle/ gradle/
COPY build.gradle.kts settings.gradle.kts ./
COPY src/ src/

RUN chmod +x gradlew && ./gradlew bootJar -x test --no-daemon

# ── 실행 이미지 (경량) ──────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
