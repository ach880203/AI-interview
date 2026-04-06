package com.aimentor.external.ai.dto;

import java.util.List;

/**
 * 학습 문제 DTO
 *
 * [역할]
 * Python AI 서버가 생성한 학습 문제 하나를 담습니다.
 * 객관식(MULTIPLE)과 주관식(SHORT) 두 가지 형태를 하나의 DTO로 처리합니다.
 *
 * [사용 흐름]
 * PythonAiService.generateLearningProblems()
 *   → List<ProblemDto> (이 클래스)
 *     → LearningService.generateProblems()
 *       → List<LearningProblemDto> (프론트엔드 응답)
 *
 * [왜 record 대신 class를 사용하는가]
 * Java record는 생성자를 하나만 가집니다.
 * 주관식 문제는 choices(선택지)가 없어서 편의 생성자가 필요합니다.
 * class로 구현하면 두 개의 생성자를 정의할 수 있습니다.
 *
 * [문제 유형별 필드 사용]
 * - MULTIPLE (객관식): question, choices(4개), correctAnswer, explanation, type="MULTIPLE"
 * - SHORT    (주관식): question, correctAnswer, explanation, type="SHORT", choices=null
 */
public class ProblemDto {

    /** 문제 본문 */
    private final String question;

    /** 정답 문자열 (객관식이면 선택지 중 하나, 주관식이면 서술형 답안) */
    private final String correctAnswer;

    /** 해설: 왜 이 답이 정답인지 설명 */
    private final String explanation;

    /** 난이도: "EASY" / "MEDIUM" / "HARD" */
    private final String difficulty;

    /** 선택지 목록: 객관식일 때 4개, 주관식이면 null */
    private final List<String> choices;

    /** 문제 유형: "MULTIPLE" (객관식) 또는 "SHORT" (주관식) */
    private final String type;

    // ──────────────────────────────────────────────────
    // 생성자
    // ──────────────────────────────────────────────────

    /**
     * 주관식 문제 생성자 (MockAiService에서 사용)
     *
     * choices를 null로 설정하고 type을 "SHORT"로 고정합니다.
     * 주관식 문제를 만들 때 매번 null과 "SHORT"를 적지 않아도 됩니다.
     *
     * @param question      문제 본문
     * @param correctAnswer 정답
     * @param explanation   해설
     * @param difficulty    난이도
     */
    public ProblemDto(String question, String correctAnswer, String explanation, String difficulty) {
        this(question, correctAnswer, explanation, difficulty, null, "SHORT");
    }

    /**
     * 전체 필드 생성자 (객관식/주관식 모두 사용 가능)
     *
     * PythonAiService와 MockAiService(객관식)에서 사용합니다.
     *
     * @param question      문제 본문
     * @param correctAnswer 정답
     * @param explanation   해설
     * @param difficulty    난이도
     * @param choices       객관식 선택지 목록 (주관식이면 null)
     * @param type          문제 유형 ("MULTIPLE" 또는 "SHORT")
     */
    public ProblemDto(String question, String correctAnswer, String explanation,
                      String difficulty, List<String> choices, String type) {
        this.question = question;
        this.correctAnswer = correctAnswer;
        this.explanation = explanation;
        this.difficulty = difficulty;
        this.choices = choices;
        this.type = type;
    }

    // ──────────────────────────────────────────────────
    // Getter (record처럼 필드명으로 바로 접근하는 형태)
    // ──────────────────────────────────────────────────

    /** @return 문제 본문 */
    public String question() { return question; }

    /** @return 정답 문자열 */
    public String correctAnswer() { return correctAnswer; }

    /** @return 해설 */
    public String explanation() { return explanation; }

    /** @return 난이도 ("EASY" / "MEDIUM" / "HARD") */
    public String difficulty() { return difficulty; }

    /**
     * @return 객관식 선택지 목록, 주관식이면 null
     */
    public List<String> choices() { return choices; }

    /** @return 문제 유형 ("MULTIPLE" 또는 "SHORT") */
    public String type() { return type; }
}
