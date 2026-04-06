package com.aimentor.domain.book;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.book.dto.BookCreateRequestDto;
import com.aimentor.domain.book.dto.BookResponseDto;
import com.aimentor.domain.book.dto.BookUpdateRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 도서 API 컨트롤러
 * 기본 경로: /api/books
 *
 * 공개 API (인증 불필요):
 *   GET /api/books       - 도서 목록 (검색+페이징)
 *   GET /api/books/{id}  - 도서 상세
 *
 * ADMIN 전용 (SecurityConfig에서 hasRole('ADMIN') 적용):
 *   POST   /api/books       - 도서 등록
 *   PUT    /api/books/{id}  - 도서 수정
 *   DELETE /api/books/{id}  - 도서 삭제
 *   POST /api/books/upload-cover - 표지 이미지 업로드 (max 20MB)
 */
@Slf4j
@RestController
@RequestMapping("/api/books")
@RequiredArgsConstructor
public class BookController {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");
    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024; // 20MB

    private final BookService bookService;

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    /**
     * GET /api/books - 도서 목록 조회 (공개)
     * @param keyword 검색어 (제목/저자/출판사), 없으면 전체
     * @param pageable page, size, sort 쿼리 파라미터 자동 바인딩
     *                 기본: page=0, size=20, sort=createdAt 내림차순
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<BookResponseDto>>> getBooks(
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        return ResponseEntity.ok(ApiResponse.success(bookService.getBooks(keyword, pageable)));
    }

    /**
     * GET /api/books/{id} - 도서 상세 조회 (공개)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponseDto>> getBook(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(bookService.getBook(id)));
    }

    /**
     * POST /api/books - 도서 등록 (🔒 ADMIN)
     * SecurityConfig: hasRole("ADMIN")
     */
    @PostMapping
    public ResponseEntity<ApiResponse<BookResponseDto>> createBook(
            @Valid @RequestBody BookCreateRequestDto request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(bookService.createBook(request)));
    }

    /**
     * PUT /api/books/{id} - 도서 수정 (🔒 ADMIN)
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponseDto>> updateBook(
            @PathVariable Long id,
            @Valid @RequestBody BookUpdateRequestDto request) {

        return ResponseEntity.ok(ApiResponse.success(bookService.updateBook(id, request)));
    }

    /**
     * POST /api/books/upload-cover - 표지 이미지 업로드 (🔒 ADMIN)
     * 최대 20MB, 이미지 파일만 허용
     * 응답: { "url": "/uploads/books/xxx.jpg" }
     */
    @PostMapping(value = "/upload-cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadCover(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST", "파일이 비어있습니다."));
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST", "파일 크기는 20MB를 초과할 수 없습니다."));
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST", "이미지 파일만 업로드할 수 있습니다. (JPEG, PNG, GIF, WebP, SVG)"));
        }

        try {
            Path booksDir = Paths.get(uploadDir, "books").toAbsolutePath().normalize();
            Files.createDirectories(booksDir);

            String originalName = file.getOriginalFilename();
            String extension = (originalName != null && originalName.contains("."))
                    ? originalName.substring(originalName.lastIndexOf("."))
                    : ".jpg";
            String storedName = UUID.randomUUID() + extension;
            Path target = booksDir.resolve(storedName);

            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            log.info("[BookCover] 이미지 업로드 완료: {} → {}", originalName, target);

            String url = "/uploads/books/" + storedName;
            return ResponseEntity.ok(ApiResponse.success(Map.of("url", url)));
        } catch (IOException e) {
            log.error("[BookCover] 이미지 업로드 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("UPLOAD_FAILED", "이미지 업로드에 실패했습니다."));
        }
    }

    /**
     * DELETE /api/books/{id} - 도서 삭제 (🔒 ADMIN)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteBook(@PathVariable Long id) {
        bookService.deleteBook(id);
        return ResponseEntity.ok(ApiResponse.success());
    }
}
