# Docker 초보자용 ChromaDB 안전 운영 가이드

작성일: 2026-04-02

## 1. 이 문서의 목적

이 문서는 `Docker를 전혀 모르는 사람`이 현재 프로젝트에서 `ChromaDB만 가장 안전하게` 붙이는 방법을 설명하는 문서이다.

이 문서의 목표는 아래 3가지다.

1. Docker가 왜 필요한지 이해한다.
2. ChromaDB만 먼저 안전하게 Docker로 띄운다.
3. 나중에 전체 프로젝트 Docker 운영으로 확장할 수 있게 기초를 잡는다.

중요한 점:

- 지금 프로젝트는 `frontend`, `backend`, `ai-server`, `mariadb`, `chromadb`까지 모두 Docker로 올릴 수 있는 구조가 이미 있다.
- 하지만 초보자 기준 가장 안전한 방향은 `처음부터 전부 Docker로 올리는 것`이 아니다.
- 가장 안전한 시작은 `ChromaDB만 Docker로 띄우고`, 나머지는 익숙한 로컬 실행 방식을 유지하는 것이다.

즉 이 문서의 권장 방향은 아래와 같다.

## 2. 가장 안전한 권장 방향

### 2.1 지금 당장 권장하는 방식

가장 안전한 운영 순서는 아래다.

1. Docker Desktop 설치
2. Docker가 정상 작동하는지 확인
3. `ChromaDB`만 Docker로 실행
4. `ai-server`는 로컬에서 실행
5. `backend`도 로컬에서 실행
6. ChromaDB가 실제로 영구 저장되는지 확인

이 방식이 가장 안전한 이유:

- 문제 생겼을 때 원인 범위를 좁히기 쉽다.
- 기존 로컬 개발 흐름을 크게 안 바꾼다.
- Docker를 한 번에 많이 배우지 않아도 된다.
- ChromaDB 영구 저장이라는 핵심 목적은 바로 달성된다.

### 2.2 지금 당장 권장하지 않는 방식

초보자 기준 아래 방식은 바로 하지 않는 편이 좋다.

- `docker compose up`으로 전체 서비스를 한 번에 모두 올리기
- Docker 안에서 backend, frontend, ai-server를 동시에 디버깅하기
- Docker 네트워크, 볼륨, rebuild, image cache를 한 번에 다 이해하려고 하기

이유:

- 한 번에 바뀌는 요소가 너무 많다.
- 어디서 문제가 났는지 구분하기 어렵다.
- 지금 목표는 `ChromaDB 영구 저장`이지 `전체 인프라 전환`이 아니다.

---

## 3. 지금 왜 Docker가 필요한가

현재 프로젝트에서 ChromaDB는 환경변수 `CHROMA_HOST`가 없으면 메모리 모드로 동작한다.

즉 지금 상태는 보통 이렇게 된다.

- AI 서버 실행
- 문제/면접 질문 자산 저장
- 서버 종료
- 다시 서버 실행
- 이전 벡터 데이터 사라짐

이게 왜 문제인가:

- 학습 문제 재사용 기록이 쌓이지 않는다.
- 면접 질문 자산이 누적되지 않는다.
- 혼합 출제 효과가 재시작 후 사라진다.

반대로 Docker로 ChromaDB를 띄우면:

- ChromaDB가 별도 프로세스로 유지된다.
- 데이터가 Docker 볼륨에 저장된다.
- AI 서버를 껐다 켜도 벡터 데이터가 남는다.

즉 Docker를 쓰는 핵심 이유는:

`ChromaDB를 진짜 저장소처럼 쓰기 위해서`다.

---

## 4. 이 프로젝트 구조에서 Docker가 맡는 역할

이 프로젝트에서 Docker는 여러 역할을 맡을 수 있지만, 초보자 기준 첫 단계에서는 아래 하나만 알면 된다.

### 4.1 첫 단계 역할

- `ChromaDB 서버를 안전하게 띄우는 도구`

즉 지금 단계에서는 Docker를 아래처럼 생각하면 된다.

`Docker = ChromaDB를 내 컴퓨터 안에 깔끔하게 실행해주는 상자`

### 4.2 나중 단계 역할

나중에는 Docker가 아래 역할까지 맡을 수 있다.

- backend 실행
- ai-server 실행
- mariadb 실행
- frontend 배포 이미지 생성
- AWS 배포용 이미지 관리

하지만 그건 나중 문제다.

지금은:

`Docker = ChromaDB 전용 실행기`

정도로 이해하면 충분하다.

---

## 5. 꼭 알아야 하는 아주 쉬운 용어

### 5.1 이미지

프로그램 실행용 설계도라고 생각하면 된다.

예:

- `chromadb/chroma:latest`

이건 ChromaDB를 실행하기 위한 이미지다.

### 5.2 컨테이너

이미지를 실제로 실행한 상태라고 생각하면 된다.

예:

- `ai-interview-chroma`

이건 실제로 실행 중인 ChromaDB 프로그램이다.

### 5.3 볼륨

데이터를 디스크에 보관하는 저장 공간이다.

예:

- `chroma_data`

이 볼륨 덕분에 컨테이너를 다시 켜도 데이터가 남는다.

### 5.4 포트

프로그램이 외부와 통신하는 문이다.

현재 compose 기준:

- 내 컴퓨터에서 보는 포트: `8001`
- 컨테이너 안 ChromaDB 포트: `8000`

즉:

- 로컬에서 접속: `http://localhost:8001`
- 컨테이너 내부에서는 `8000`

### 5.5 Compose

여러 서비스를 한 번에 관리하는 Docker 설정 파일이다.

현재 프로젝트의 파일:

- [docker-compose.yml](/C:/Programmer/Work/AI-interview/docker-compose.yml)

---

## 6. 이 프로젝트의 현재 ChromaDB 설정 읽는 법

현재 [docker-compose.yml](/C:/Programmer/Work/AI-interview/docker-compose.yml) 안의 ChromaDB 설정은 핵심만 보면 아래와 같다.

```yaml
chromadb:
  image: chromadb/chroma:latest
  container_name: ai-interview-chroma
  ports:
    - "8001:8000"
  volumes:
    - chroma_data:/chroma/chroma
```

이 의미는 다음과 같다.

### 6.1 `image: chromadb/chroma:latest`

- ChromaDB 공식 이미지를 사용하겠다는 뜻이다.

### 6.2 `container_name: ai-interview-chroma`

- 실행된 컨테이너 이름을 `ai-interview-chroma`로 붙인다는 뜻이다.

### 6.3 `ports: "8001:8000"`

- 내 컴퓨터의 `8001` 포트를
- 컨테이너 안 ChromaDB의 `8000` 포트에 연결한다는 뜻이다.

즉 브라우저나 테스트에서:

- `http://localhost:8001`

로 접근하면 컨테이너 안 ChromaDB로 연결된다.

### 6.4 `volumes: chroma_data:/chroma/chroma`

- 컨테이너 안 저장 경로 `/chroma/chroma`를
- Docker 볼륨 `chroma_data`에 연결한다는 뜻이다.

즉 데이터가 컨테이너 안에만 잠깐 저장되는 게 아니라,
실제 디스크 볼륨에 저장되어 재시작 후에도 유지된다.

---

## 7. 설치 전에 확인할 것

Windows 기준으로 아래를 먼저 확인한다.

1. 가상화 기능이 켜져 있는지
2. Docker Desktop을 설치할 권한이 있는지
3. 메모리가 너무 부족하지 않은지
4. 회사 PC면 보안 정책상 Docker 설치가 막혀 있지 않은지

권장 사양:

- 메모리 8GB 이상
- SSD 여유 공간 10GB 이상

---

## 8. Docker Desktop 설치 방법

### 8.1 설치 파일 받기

공식 사이트에서 `Docker Desktop for Windows`를 설치한다.

### 8.2 설치 중 주의

설치 중 아래 항목이 보이면 보통 기본값으로 두는 편이 안전하다.

- WSL 2 사용
- Windows 컨테이너 대신 Linux 컨테이너 사용

초보자 기준 권장:

- `Linux container` 유지
- `WSL 2 backend` 사용

### 8.3 설치 후 재부팅

설치 후 Windows 재부팅이 필요할 수 있다.

이때 당황하지 말고 재부팅 후 다시 Docker Desktop을 실행하면 된다.

---

## 9. Docker가 정상 설치됐는지 확인하는 방법

PowerShell에서 아래를 실행한다.

```powershell
docker --version
docker compose version
```

정상이라면 버전 문자열이 나온다.

예:

```powershell
Docker version 28.x.x
Docker Compose version v2.x.x
```

추가 확인:

```powershell
docker run hello-world
```

이 명령이 정상 작동하면 Docker 기본 실행은 된 것이다.

---

## 10. 가장 안전한 첫 실행 방식

여기서 핵심이다.

처음에는 전체 서비스를 올리지 말고 `ChromaDB만` 올린다.

프로젝트 루트에서 아래 명령만 실행한다.

```powershell
docker compose up -d chromadb
```

이 명령의 의미:

- `docker compose`: 현재 compose 파일 사용
- `up`: 서비스 실행
- `-d`: 백그라운드 실행
- `chromadb`: ChromaDB 서비스만 선택 실행

이 방식이 가장 안전하다.

---

## 11. ChromaDB만 실행했는지 확인하는 방법

아래 명령으로 확인한다.

```powershell
docker ps
```

정상이라면 `ai-interview-chroma`가 보여야 한다.

예상 체크 포인트:

- `CONTAINER NAME` 또는 `NAMES`에 `ai-interview-chroma`
- `PORTS`에 `0.0.0.0:8001->8000/tcp`

추가로 상태를 더 보고 싶으면:

```powershell
docker compose ps
```

---

## 12. ChromaDB가 실제로 살아 있는지 확인하는 방법

브라우저에서 직접 확인해도 되고, PowerShell에서 확인해도 된다.

### 12.1 PowerShell 확인

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/v1/heartbeat"
```

정상이라면 응답이 와야 한다.

### 12.2 안 되면 확인할 것

1. Docker Desktop이 켜져 있는지
2. 컨테이너가 실행 중인지
3. 포트 `8001`이 다른 프로그램과 충돌하지 않는지

---

## 13. 지금 프로젝트에서 가장 안전한 연결 방식

가장 안전한 방식은 아래다.

### 13.1 ChromaDB는 Docker

- `docker compose up -d chromadb`

### 13.2 AI 서버는 로컬

- 지금처럼 [ai-server](/C:/Programmer/Work/AI-interview/ai-server)에서 로컬 실행

### 13.3 backend도 로컬

- 지금처럼 Gradle로 로컬 실행

이렇게 하면:

- Docker는 ChromaDB만 담당
- Python 코드 디버깅은 그대로 쉬움
- Java 코드 디버깅도 그대로 쉬움

초보자에게 가장 좋은 조합이다.

---

## 14. AI 서버를 ChromaDB에 연결하는 방법

현재 코드상 AI 서버는 `CHROMA_HOST`가 없으면 메모리 모드로 간다.

즉 ChromaDB를 Docker로 띄웠다면, AI 서버가 아래 값을 보게 해야 한다.

### 14.1 로컬 실행 기준 권장값

```env
CHROMA_HOST=localhost
CHROMA_PORT=8001
```

이유:

- Docker 컨테이너 바깥에서 로컬 AI 서버가 접속할 때는
- `chromadb`라는 컨테이너 이름이 아니라
- 내 컴퓨터 기준 주소 `localhost:8001`로 접속해야 한다.

중요:

- `CHROMA_HOST=chromadb`는 `ai-server도 Docker 안에서 돌 때` 쓰는 값이다.
- `ai-server를 로컬에서 실행할 때`는 `localhost`가 맞다.

### 14.2 안전한 이해법

정리:

- `Docker 안에서 Docker 서비스끼리 통신`: `chromadb:8000`
- `내 컴퓨터 로컬 프로그램이 Docker 컨테이너에 접속`: `localhost:8001`

이 차이를 반드시 기억해야 한다.

---

## 15. 가장 안전한 실제 실행 순서

이 순서를 그대로 따라 하면 된다.

### 15.1 1단계: ChromaDB만 실행

```powershell
docker compose up -d chromadb
```

### 15.2 2단계: ChromaDB 헬스체크

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/v1/heartbeat"
```

### 15.3 3단계: AI 서버 환경변수 설정

예시:

```powershell
$env:CHROMA_HOST="localhost"
$env:CHROMA_PORT="8001"
```

또는 `.env` 파일에 넣는다.

### 15.4 4단계: AI 서버 실행

```powershell
cd ai-server
.\.venv313\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### 15.5 5단계: AI 서버 헬스체크

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

### 15.6 6단계: backend 실행

프로젝트 backend 실행 명령으로 실행한다.

### 15.7 7단계: 실제 기능 점검

- 학습 문제 생성
- 면접 질문 생성
- 자산 재사용 여부 확인

---

## 16. 지금 구조에서 절대로 헷갈리지 말아야 할 것

### 16.1 `chromadb`와 `localhost`는 같은 말이 아니다

아니다.

- `chromadb`: Docker 내부 서비스 이름
- `localhost`: 내 컴퓨터 자신

### 16.2 포트 8000과 8001도 같은 게 아니다

아니다.

- ChromaDB 컨테이너 내부 포트: `8000`
- 내 컴퓨터에서 접근하는 포트: `8001`

즉:

- 로컬 AI 서버에서 접속: `localhost:8001`
- Docker 안 ai-server에서 접속: `chromadb:8000`

---

## 17. 문제가 생겼을 때 가장 먼저 보는 순서

문제 해결은 아래 순서가 가장 안전하다.

### 17.1 Docker Desktop이 켜져 있는지

가장 먼저 본다.

꺼져 있으면 아무 것도 안 된다.

### 17.2 컨테이너가 떠 있는지

```powershell
docker ps
```

여기서 `ai-interview-chroma`가 보여야 한다.

### 17.3 헬스체크 응답이 오는지

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/v1/heartbeat"
```

### 17.4 AI 서버가 어떤 주소를 보고 있는지

AI 서버 실행 환경에서:

- `CHROMA_HOST`
- `CHROMA_PORT`

값이 무엇인지 확인한다.

### 17.5 AI 서버 로그 확인

현재 코드에는 아래 같은 로그가 남는다.

- ChromaDB HTTP 클라이언트 연결
- 메모리 기반 ChromaDB 사용

즉 로그를 보면 지금이:

- 진짜 ChromaDB 연결인지
- 메모리 fallback인지

구분할 수 있다.

---

## 18. 가장 흔한 실수와 해결 방법

### 18.1 실수: ChromaDB는 Docker로 띄웠는데 AI 서버는 계속 메모리 모드

원인:

- `CHROMA_HOST`를 안 넣음
- 또는 `chromadb`로 넣었는데 AI 서버는 로컬 실행 중

해결:

로컬 실행이면 아래로 맞춘다.

```env
CHROMA_HOST=localhost
CHROMA_PORT=8001
```

### 18.2 실수: `localhost:8000`으로 ChromaDB 접속 시도

원인:

- 8000은 AI 서버 기본 포트라서 헷갈림

해결:

- ChromaDB 로컬 접근 포트는 `8001`
- AI 서버는 `8000`

### 18.3 실수: Docker는 켰는데 컨테이너는 안 띄움

해결:

```powershell
docker compose up -d chromadb
```

### 18.4 실수: 데이터가 사라졌다고 느껴짐

원인:

- 실제로는 메모리 모드로 저장한 것일 수 있음
- 또는 컨테이너를 지우는 과정에서 볼륨까지 삭제했을 수 있음

확인:

```powershell
docker volume ls
```

여기서 `chroma_data`가 남아 있는지 본다.

---

## 19. 가장 안전한 중지 방법

ChromaDB만 멈추고 싶으면:

```powershell
docker compose stop chromadb
```

다시 켜려면:

```powershell
docker compose start chromadb
```

이 방식이 안전한 이유:

- 컨테이너는 멈추지만
- 볼륨 데이터는 남는다

즉 초보자는 가능하면 `down`보다 `stop/start`를 먼저 쓰는 게 안전하다.

---

## 20. 초보자가 조심해야 할 위험한 명령

아래는 의미를 알고 쓰기 전에는 조심해야 한다.

### 20.1 `docker compose down -v`

이 명령은 매우 조심해야 한다.

이유:

- 컨테이너를 내리고
- 연결된 볼륨도 같이 지울 수 있다

즉 `chroma_data`까지 사라질 수 있다.

현재 단계에서는 이 명령을 함부로 쓰지 않는 것이 안전하다.

### 20.2 `docker system prune -a`

이 명령도 조심해야 한다.

잘못 쓰면 이미지, 중지된 컨테이너, 캐시 등이 많이 정리된다.

초보자 기준:

- 지금은 사용하지 않는 편이 안전하다.

---

## 21. 백업을 가장 안전하게 생각하는 방법

초보자 기준 백업은 어렵게 생각할 필요 없다.

가장 쉬운 원칙:

- 중요한 벡터 데이터가 쌓이기 시작하면
- Docker 볼륨 백업 방법을 별도로 정리해 둔다

지금 단계에서는 우선 아래만 기억하면 된다.

- `chroma_data`가 실제 저장 공간이다
- 이 볼륨이 사라지면 벡터 데이터도 사라질 수 있다

---

## 22. 지금 당장 해야 하는 실전 권장 시나리오

### 권장 시나리오 A

처음 배우는 단계에서 가장 추천한다.

1. Docker Desktop 설치
2. `docker compose up -d chromadb`
3. `localhost:8001` 헬스체크 확인
4. AI 서버는 로컬 실행
5. `CHROMA_HOST=localhost`, `CHROMA_PORT=8001` 적용
6. 학습/면접 자산 저장 테스트
7. 재시작 후 데이터 유지 확인

이게 가장 안전하다.

### 권장 시나리오 B

익숙해진 뒤에만 추천한다.

1. ChromaDB + ai-server까지 Docker
2. backend는 로컬

### 권장 시나리오 C

나중 최종 단계에서만 추천한다.

1. frontend
2. backend
3. ai-server
4. mariadb
5. chromadb

전체를 Docker Compose로 운영

이건 지금 당장은 하지 않는 편이 안전하다.

---

## 23. 지금 이 프로젝트 기준으로 가장 안전한 최종 결론

지금 당신에게 가장 안전한 방향은 아래다.

1. Docker는 `ChromaDB 전용`으로만 먼저 사용한다.
2. backend와 ai-server는 당분간 로컬 실행을 유지한다.
3. ChromaDB 연결 주소는 로컬 실행 기준으로 `localhost:8001`을 사용한다.
4. 전체 Docker 전환은 나중에 익숙해진 뒤에 한다.

즉 지금의 정답은:

`전체 Docker화가 아니라, ChromaDB만 Docker로 먼저 붙이는 것`

이다.

---

## 24. 바로 따라 하는 최소 명령 모음

### 설치 확인

```powershell
docker --version
docker compose version
```

### ChromaDB만 실행

```powershell
docker compose up -d chromadb
```

### 실행 확인

```powershell
docker ps
```

### 헬스체크

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/v1/heartbeat"
```

### AI 서버 로컬 실행 전 환경변수

```powershell
$env:CHROMA_HOST="localhost"
$env:CHROMA_PORT="8001"
```

### ChromaDB 중지

```powershell
docker compose stop chromadb
```

### ChromaDB 다시 시작

```powershell
docker compose start chromadb
```

---

## 25. 이 문서 다음 단계

이 문서를 다 이해한 뒤 다음으로 넘어가면 좋은 문서는 아래다.

- [DESIGN_ChromaDB_출제자산_혼합출제_확장설계서_2026-03-31.md](/C:/Programmer/Work/AI-interview/docs/DESIGN_ChromaDB_%EC%B6%9C%EC%A0%9C%EC%9E%90%EC%82%B0_%ED%98%BC%ED%95%A9%EC%B6%9C%EC%A0%9C_%ED%99%95%EC%9E%A5%EC%84%A4%EA%B3%84%EC%84%9C_2026-03-31.md)
- [GUIDE_ChromaDB_RAG_실습_완전가이드.md](/C:/Programmer/Work/AI-interview/docs/GUIDE_ChromaDB_RAG_%EC%8B%A4%EC%8A%B5_%EC%99%84%EC%A0%84%EA%B0%80%EC%9D%B4%EB%93%9C.md)

이 문서는 `실행 방법`에 집중했고,
설계 문서는 `왜 그렇게 설계했는지`에 더 가깝다.

