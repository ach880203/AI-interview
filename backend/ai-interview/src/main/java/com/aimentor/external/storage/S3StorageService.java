package com.aimentor.external.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * AWS S3 파일 업로드 서비스 (현재 Mock 구현)
 *
 * Mock 동작:
 * - 실제 S3 업로드 없이 가짜 URL 반환
 * - 파일명은 UUID로 고유하게 생성하여 충돌 방지
 *
 * TODO (실제 S3 연동 시):
 * 1. build.gradle에 aws-java-sdk-s3 또는 software.amazon.awssdk:s3 추가
 * 2. application.yml에 aws.s3.bucket, aws.region, aws.credentials 추가
 * 3. uploadFile() 메서드에서 AmazonS3.putObject() 호출로 교체
 * 4. deleteFile() 메서드로 파일 삭제 구현
 */
@Slf4j
@Service
public class S3StorageService {

    // 실제 S3 연동 시 이 값을 application.yml에서 @Value로 주입
    private static final String MOCK_BUCKET_URL = "https://ai-interview-bucket.s3.ap-northeast-2.amazonaws.com";

    /**
     * 파일 업로드 (Mock)
     * @param file      업로드할 파일
     * @param directory 저장 경로 (예: "resumes", "job-postings")
     * @return 업로드된 파일의 public URL
     */
    public String uploadFile(MultipartFile file, String directory) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        // 원본 파일명에서 확장자 추출
        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);

        // UUID로 고유한 파일명 생성 (한글/특수문자 파일명 충돌 방지)
        String storedFilename = UUID.randomUUID() + extension;
        String fileKey = directory + "/" + storedFilename;

        // TODO: 실제 S3 업로드 코드로 교체
        // PutObjectRequest request = PutObjectRequest.builder()
        //     .bucket(bucketName)
        //     .key(fileKey)
        //     .contentType(file.getContentType())
        //     .build();
        // s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));

        String mockUrl = MOCK_BUCKET_URL + "/" + fileKey;
        log.info("[Mock S3] 파일 업로드 완료: {} → {}", originalFilename, mockUrl);

        return mockUrl;
    }

    /**
     * 파일 삭제 (Mock)
     * @param fileUrl 삭제할 파일 URL
     */
    public void deleteFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }
        // TODO: 실제 S3 삭제 코드로 교체
        // String key = fileUrl.replace(MOCK_BUCKET_URL + "/", "");
        // s3Client.deleteObject(b -> b.bucket(bucketName).key(key));
        log.info("[Mock S3] 파일 삭제 완료: {}", fileUrl);
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf("."));
    }
}
