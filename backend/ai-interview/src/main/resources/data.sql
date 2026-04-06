-- ============================================================
-- 초기 학습 과목 시드 데이터
-- 실행 조건: spring.sql.init.mode=always (application.yml)
-- 중복 삽입 방지: INSERT IGNORE (MariaDB 문법)
-- ============================================================

INSERT IGNORE INTO learning_subjects (name, description, created_at, updated_at) VALUES
  ('Java',         'JVM 동작 원리, 컬렉션, 멀티스레딩, 가비지컬렉션 등 Java 핵심 개념',          NOW(), NOW()),
  ('Spring Boot',  'DI/IoC, AOP, Spring MVC, Spring Security, JPA 연동 등 Spring 생태계',       NOW(), NOW()),
  ('데이터베이스', 'SQL, 인덱스, 트랜잭션, 정규화, 조인 최적화 등 관계형 DB 핵심 개념',           NOW(), NOW()),
  ('자료구조',     '배열, 연결리스트, 스택, 큐, 트리, 그래프, 힙, 해시테이블 구조와 복잡도',      NOW(), NOW()),
  ('알고리즘',     '정렬, 탐색, 동적 프로그래밍, 그리디, BFS/DFS 알고리즘 설계 및 분석',         NOW(), NOW()),
  ('운영체제',     '프로세스/스레드, 메모리 관리, 파일 시스템, 동기화, 교착상태 등 OS 개념',       NOW(), NOW()),
  ('네트워크',     'TCP/IP, HTTP/HTTPS, REST, 웹소켓, DNS, 보안(TLS) 등 네트워크 프로토콜',      NOW(), NOW()),
  ('영어',         '어휘, 문법, 독해 중심의 영어 학습 (수능~고급 수준)',                           NOW(), NOW()),
  ('한국사',       '선사시대~현대사, 인물, 사건, 문화재 중심의 한국사 (수능 스타일)',               NOW(), NOW());

-- ============================================================
-- 도서 스토어 시드 데이터
-- 실행 조건: spring.sql.init.mode=always (application.yml)
-- 중복 삽입 방지: 제목 기준 NOT EXISTS
-- 화면에서 과목 추천 서가가 잘 보이도록 제목/소개에 과목 키워드를 함께 넣습니다.
-- ============================================================

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT 'Java 면접을 뚫는 핵심 문장 101', '김현우', '멘토프레스', 24800, 18, NULL,
       'Java 핵심 문법을 외우는 책이 아니라, JVM 동작 원리와 컬렉션 선택 이유를 면접 답변 문장으로 바꾸는 실전형 가이드입니다. 신입과 주니어 개발자가 가장 자주 막히는 질문을 짧고 강한 문장으로 정리했습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = 'Java 면접을 뚫는 핵심 문장 101');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT 'Spring Boot 실무 설계 노트', '박서윤', '멘토프레스', 28600, 14, NULL,
       'Spring Boot 프로젝트를 처음부터 끝까지 설계하는 감각을 다룹니다. DI, 계층 분리, 예외 처리, 보안, 테스트까지 이어지는 흐름을 실제 팀 개발 관점으로 묶어 설명합니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = 'Spring Boot 실무 설계 노트');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '데이터베이스 설계 감각', '이정민', '커리어북스', 27200, 11, NULL,
       '데이터베이스 이론만 아는 상태에서 한 단계 올라가고 싶을 때 보는 책입니다. 정규화와 인덱스, 조인 최적화, 트랜잭션 설계를 서비스 장애 사례와 함께 풀어 줍니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '데이터베이스 설계 감각');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '자료구조를 설명하는 개발자', '최도윤', '스터디웨이', 23100, 16, NULL,
       '자료구조를 시험용 암기가 아니라 설명력으로 연결하는 책입니다. 배열, 연결 리스트, 스택, 큐, 트리, 해시를 왜 그 구조로 써야 하는지 말로 풀어내는 훈련에 집중합니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '자료구조를 설명하는 개발자');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '알고리즘 사고력 인터뷰 훈련', '정유진', '커리어북스', 25900, 13, NULL,
       '알고리즘 문제를 푸는 법보다, 왜 그렇게 접근했는지를 설명하는 훈련에 초점을 둡니다. 정렬, 탐색, 그리디, DP, BFS와 DFS를 면접 답변 흐름으로 정리했습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '알고리즘 사고력 인터뷰 훈련');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '운영체제 한 장씩 이해하기', '한지수', '멘토프레스', 26400, 9, NULL,
       '운영체제를 두꺼운 이론서처럼 밀어붙이지 않고, 프로세스와 스레드, 메모리, 파일 시스템, 동기화를 한 장 한 장 끊어 이해하게 돕는 입문 심화형 책입니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '운영체제 한 장씩 이해하기');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '네트워크는 결국 흐름이다', '오태훈', '테크브릿지', 27800, 12, NULL,
       '네트워크를 포트와 패킷 용어로만 보지 않고, 요청이 오고 응답이 돌아가는 흐름으로 설명합니다. TCP/IP, HTTP, HTTPS, DNS, 로드밸런싱 감각을 실무 관점으로 묶었습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '네트워크는 결국 흐름이다');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '백엔드 신입 포트폴리오 문장력', '윤가람', '커리어북스', 19800, 21, NULL,
       '프로젝트를 했는데도 소개 문장이 밋밋한 사람을 위한 책입니다. 이력서, 자기소개서, 포트폴리오 설명을 개발자 채용 문장으로 바꾸는 실전 예시를 풍부하게 담았습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '백엔드 신입 포트폴리오 문장력');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '기술 면접 답변의 구조', '문태성', '멘토프레스', 22300, 17, NULL,
       '답을 알고도 횡설수설하는 사람을 위해 만든 면접 책입니다. 결론 먼저 말하기, 근거 붙이기, 경험 연결하기, 반례 대응하기를 실제 기술 면접 질문으로 훈련합니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '기술 면접 답변의 구조');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '영어 기술 면접 스몰토크', '서민재', '글로벌멘토', 21400, 10, NULL,
       '영어 면접을 유창함보다 전달력 중심으로 준비하게 돕는 책입니다. 자기소개, 프로젝트 설명, 협업 경험, 강점과 약점을 짧고 자연스럽게 말하는 문장을 모았습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '영어 기술 면접 스몰토크');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '한국사 한 번에 정리하는 흐름', '장하린', '스터디웨이', 18900, 8, NULL,
       '한국사를 사건 암기가 아니라 시대 흐름으로 정리하는 책입니다. 선사부터 근현대까지 연결 구조를 잡아 주어 공무원형 학습이나 교양형 복습에 모두 잘 맞습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '한국사 한 번에 정리하는 흐름');

INSERT INTO books (title, author, publisher, price, stock, cover_url, description, created_at, updated_at)
SELECT '개발자 커리어를 바꾸는 학습 루틴', '배소은', '테크브릿지', 17600, 24, NULL,
       '무작정 오래 공부하는 방식에서 벗어나, 학습 과목 선택과 복습 주기, 오답 정리, 면접 대비까지 한 흐름으로 묶어 주는 커리어 학습서입니다. 학습하기와 면접하기를 함께 쓰는 사용자에게 특히 잘 맞습니다.',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = '개발자 커리어를 바꾸는 학습 루틴');
-- ============================================================
-- 도서 표지 이미지 URL 보정
-- 이미 같은 제목의 책이 먼저 들어가 있어도 표지가 비어 있으면 채워지도록 UPDATE로 한 번 더 보정합니다.
-- 프론트 정적 자산(/book-covers/*.svg)을 사용하므로 로컬/배포 환경 모두에서 경로가 단순합니다.
-- ============================================================

UPDATE books SET cover_url = '/book-covers/java-interview-101.svg', updated_at = NOW()
WHERE title = 'Java 면접을 뚫는 핵심 문장 101' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/spring-boot-design-note.svg', updated_at = NOW()
WHERE title = 'Spring Boot 실무 설계 노트' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/database-design-sense.svg', updated_at = NOW()
WHERE title = '데이터베이스 설계 감각' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/data-structure-developer.svg', updated_at = NOW()
WHERE title = '자료구조를 설명하는 개발자' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/algorithm-interview-training.svg', updated_at = NOW()
WHERE title = '알고리즘 사고력 인터뷰 훈련' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/operating-system-pages.svg', updated_at = NOW()
WHERE title = '운영체제 한 장씩 이해하기' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/network-is-flow.svg', updated_at = NOW()
WHERE title = '네트워크는 결국 흐름이다' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/backend-portfolio-writing.svg', updated_at = NOW()
WHERE title = '백엔드 신입 포트폴리오 문장력' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/interview-answer-structure.svg', updated_at = NOW()
WHERE title = '기술 면접 답변의 구조' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/english-tech-smalltalk.svg', updated_at = NOW()
WHERE title = '영어 기술 면접 스몰토크' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/korean-history-flow.svg', updated_at = NOW()
WHERE title = '한국사 한 번에 정리하는 흐름' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/career-learning-routine.svg', updated_at = NOW()
WHERE title = '개발자 커리어를 바꾸는 학습 루틴' AND (cover_url IS NULL OR cover_url = '');

-- ============================================================
-- 도서 표지 이미지 URL 보정 (시드 INSERT 이후 최종 보정)
-- 파일 앞쪽 보정 구문과 별개로, 새 데이터가 INSERT된 뒤에도 표지가 채워지도록 마지막에 한 번 더 실행합니다.
-- ============================================================

UPDATE books SET cover_url = '/book-covers/java-interview-101.svg', updated_at = NOW()
WHERE title = 'Java 면접을 뚫는 핵심 문장 101' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/spring-boot-design-note.svg', updated_at = NOW()
WHERE title = 'Spring Boot 실무 설계 노트' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/database-design-sense.svg', updated_at = NOW()
WHERE title = '데이터베이스 설계 감각' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/data-structure-developer.svg', updated_at = NOW()
WHERE title = '자료구조를 설명하는 개발자' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/algorithm-interview-training.svg', updated_at = NOW()
WHERE title = '알고리즘 사고력 인터뷰 훈련' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/operating-system-pages.svg', updated_at = NOW()
WHERE title = '운영체제 한 장씩 이해하기' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/network-is-flow.svg', updated_at = NOW()
WHERE title = '네트워크는 결국 흐름이다' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/backend-portfolio-writing.svg', updated_at = NOW()
WHERE title = '백엔드 신입 포트폴리오 문장력' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/interview-answer-structure.svg', updated_at = NOW()
WHERE title = '기술 면접 답변의 구조' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/english-tech-smalltalk.svg', updated_at = NOW()
WHERE title = '영어 기술 면접 스몰토크' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/korean-history-flow.svg', updated_at = NOW()
WHERE title = '한국사 한 번에 정리하는 흐름' AND (cover_url IS NULL OR cover_url = '');

UPDATE books SET cover_url = '/book-covers/career-learning-routine.svg', updated_at = NOW()
WHERE title = '개발자 커리어를 바꾸는 학습 루틴' AND (cover_url IS NULL OR cover_url = '');
