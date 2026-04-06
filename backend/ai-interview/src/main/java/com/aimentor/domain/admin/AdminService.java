package com.aimentor.domain.admin;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.admin.dto.*;
import com.aimentor.domain.book.BookEntity;
import com.aimentor.domain.book.BookRepository;
import com.aimentor.domain.book.BookService;
import com.aimentor.domain.book.OrderEntity;
import com.aimentor.domain.book.OrderItemRepository;
import com.aimentor.domain.book.OrderRepository;
import com.aimentor.domain.subscription.SubscriptionEntity;
import com.aimentor.domain.subscription.SubscriptionRepository;
import com.aimentor.domain.subscription.SubscriptionStatus;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.domain.user.UserRole;
import com.aimentor.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 관리자 전용 비즈니스 로직 서비스입니다.
 *
 * [역할]
 * 회원 목록 조회, 권한 변경, 도서 재고 조회/수정, 전체 주문 목록 조회,
 * 관리자 대시보드 통계 계산을 담당합니다.
 *
 * [동작 방식]
 * 각 도메인의 레포지토리를 조합해서 관리자 화면에 필요한 데이터만
 * 읽기 쉬운 DTO 형태로 만들어 반환합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private static final int LOW_STOCK_THRESHOLD = 5;

    private final UserRepository userRepository;
    private final UserService userService;
    private final BookRepository bookRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final BookService bookService;
    private final SubscriptionRepository subscriptionRepository;

    /** 매출로 집계하는 주문 상태 (결제 완료 ~ 구매 확정) */
    private static final List<OrderEntity.OrderStatus> REVENUE_ORDER_STATUSES = List.of(
            OrderEntity.OrderStatus.PAID,
            OrderEntity.OrderStatus.SHIPPED,
            OrderEntity.OrderStatus.DELIVERED,
            OrderEntity.OrderStatus.PURCHASE_CONFIRMED
    );

    /** 환불/취소로 집계하는 주문 상태 */
    private static final List<OrderEntity.OrderStatus> REFUND_ORDER_STATUSES = List.of(
            OrderEntity.OrderStatus.REFUNDED,
            OrderEntity.OrderStatus.CANCELLED
    );

    /** 매출로 집계하는 구독 상태 (결제 승인 이력이 있는 상태) */
    private static final List<SubscriptionStatus> REVENUE_SUB_STATUSES = List.of(
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.EXPIRED
    );

    /**
     * 회원 목록을 최신 가입순으로 조회합니다.
     *
     * @return 관리자 회원 목록 응답 DTO 목록
     */
    public List<AdminUserResponseDto> getUsers() {
        return userRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(AdminUserResponseDto::from)
                .toList();
    }

    /**
     * 특정 사용자의 권한을 변경합니다.
     *
     * @param userId 대상 사용자 ID
     * @param request 변경할 권한 정보
     * @return 변경 후 사용자 정보
     */
    @Transactional
    public AdminUserResponseDto updateUserRole(Long userId, AdminUserRoleUpdateRequestDto request) {
        userService.updateUserRole(userId, request.role());
        UserEntity user = userService.findById(userId);
        return AdminUserResponseDto.from(user);
    }

    /**
     * 도서 재고 현황을 최신 등록순으로 조회합니다.
     *
     * @return 관리자 재고 목록 응답 DTO 목록
     */
    public List<AdminBookStockResponseDto> getBookStocks() {
        return bookRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(AdminBookStockResponseDto::from)
                .toList();
    }

    /**
     * 특정 도서의 재고를 직접 수정합니다.
     *
     * @param bookId 도서 ID
     * @param request 변경할 최종 재고 수량
     * @return 변경 후 재고 응답 DTO
     */
    @Transactional
    public AdminBookStockResponseDto updateBookStock(Long bookId, AdminBookStockUpdateRequestDto request) {
        BookEntity book = bookRepository.findById(bookId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        book.updateStock(request.stock());
        return AdminBookStockResponseDto.from(book);
    }

    /**
     * 전체 주문 목록을 최신 주문순으로 조회합니다.
     * 주문별 상품 요약(도서명 x수량)을 단일 배치 쿼리로 함께 반환합니다.
     *
     * @return 관리자 주문 목록 응답 DTO 목록
     */
    public List<AdminOrderResponseDto> getOrders() {
        List<OrderEntity> orders = orderRepository.findAll(Sort.by(Sort.Direction.DESC, "orderedAt"));
        if (orders.isEmpty()) return List.of();

        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();

        // 주문 항목 배치 조회
        Map<Long, List<com.aimentor.domain.book.OrderItemEntity>> itemsByOrderId =
                orderItemRepository.findByOrderIdIn(orderIds).stream()
                        .collect(Collectors.groupingBy(item -> item.getOrder().getId()));

        // 필요한 도서 ID 수집 후 배치 조회
        Set<Long> bookIds = itemsByOrderId.values().stream()
                .flatMap(List::stream)
                .map(com.aimentor.domain.book.OrderItemEntity::getBookId)
                .collect(Collectors.toSet());
        Map<Long, String> bookTitles = bookIds.isEmpty()
                ? Map.of()
                : bookRepository.findAllById(bookIds).stream()
                        .collect(Collectors.toMap(BookEntity::getId, BookEntity::getTitle));

        return orders.stream()
                .map(order -> AdminOrderResponseDto.from(
                        order,
                        buildItemSummary(itemsByOrderId.get(order.getId()), bookTitles)))
                .toList();
    }

    /**
     * 주문 항목 목록을 "도서명 x수량, ..." 형식의 요약 문자열로 변환합니다.
     */
    private String buildItemSummary(
            List<com.aimentor.domain.book.OrderItemEntity> items,
            Map<Long, String> bookTitles) {
        if (items == null || items.isEmpty()) return "(상품 없음)";
        return items.stream()
                .map(item -> bookTitles.getOrDefault(item.getBookId(), "삭제된 도서")
                        + " x" + item.getQuantity())
                .collect(Collectors.joining(", "));
    }

    /**
     * 주문 상태를 변경합니다.
     *
     * [동작 방식]
     * 1. 주문을 조회합니다.
     * 2. 현재 상태에서 변경 가능한 상태인지 검증합니다.
     * 3. 엔티티 메서드를 호출해 상태를 변경합니다.
     *
     * [상태 전이 규칙]
     * - PENDING -> PAID, CANCELLED
     * - PAID -> SHIPPED, CANCELLED
     * - SHIPPED -> DELIVERED
     * - REFUND_REQUESTED -> REFUNDED
     * - DELIVERED, PURCHASE_CONFIRMED, REFUNDED, CANCELLED -> 변경 불가
     *
     * @param orderId 주문 ID
     * @param request 변경할 상태 정보
     * @return 변경 후 주문 응답 DTO
     */
    @Transactional
    public AdminOrderResponseDto updateOrderStatus(Long orderId, AdminOrderStatusUpdateRequestDto request) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        validateOrderStatusChange(order.getStatus(), request.status());

        if (request.status() == OrderEntity.OrderStatus.PAID) {
            order.markAsPaid();
        } else if (request.status() == OrderEntity.OrderStatus.SHIPPED) {
            order.markAsShipped();
        } else if (request.status() == OrderEntity.OrderStatus.DELIVERED) {
            order.markAsDelivered();
        } else if (request.status() == OrderEntity.OrderStatus.REFUNDED) {
            restoreOrderItemStocks(order.getId());
            order.markAsRefunded(request.reason());
        } else if (request.status() == OrderEntity.OrderStatus.CANCELLED) {
            restoreOrderItemStocks(order.getId());
            order.cancel(request.reason());
        }

        // 상태 변경 후에도 상품 요약을 포함해 반환
        List<com.aimentor.domain.book.OrderItemEntity> items = orderItemRepository.findByOrderId(orderId);
        Set<Long> bookIds = items.stream()
                .map(com.aimentor.domain.book.OrderItemEntity::getBookId)
                .collect(Collectors.toSet());
        Map<Long, String> bookTitles = bookIds.isEmpty()
                ? Map.of()
                : bookRepository.findAllById(bookIds).stream()
                        .collect(Collectors.toMap(BookEntity::getId, BookEntity::getTitle));
        return AdminOrderResponseDto.from(order, buildItemSummary(items, bookTitles));
    }

    /**
     * 관리자 대시보드 요약 통계를 계산합니다.
     *
     * [동작 방식]
     * 1. 회원, 도서, 주문 전체 수를 집계합니다.
     * 2. 대기 중 주문 수와 저재고 도서 수를 계산합니다.
     * 3. 결제가 끝난 주문 금액을 합산해 총 매출 지표를 만듭니다.
     *
     * @return 관리자 대시보드 통계 DTO
     */
    public AdminDashboardResponseDto getDashboard() {
        List<UserEntity> users = userRepository.findAll();
        List<BookEntity> books = bookRepository.findAll();
        List<OrderEntity> orders = orderRepository.findAll();

        long adminUsers = users.stream()
                .filter(user -> user.getRole() == UserRole.ADMIN)
                .count();

        long lowStockBooks = books.stream()
                .filter(book -> book.getStock() <= LOW_STOCK_THRESHOLD)
                .count();

        // 관리자 메인 카드의 "총 매출"은 지금까지 누적된 순매출로 통일합니다.
        // 도서 주문만 부분 집계하면 매출관리 탭의 구독/환불 집계와 의미가 달라져 숫자가 어긋나므로,
        // 누적 구독 매출 + 누적 도서 매출 - 누적 환불/취소 금액 기준으로 한 번에 맞춥니다.
        long totalSales =
                sumSubscriptionSales(null, null)
                        + sumOrderSales(REVENUE_ORDER_STATUSES, null, null)
                        - sumOrderSales(REFUND_ORDER_STATUSES, null, null);

        return new AdminDashboardResponseDto(
                users.size(),
                books.size(),
                orders.size(),
                orderRepository.countByStatus(OrderEntity.OrderStatus.PENDING),
                lowStockBooks,
                adminUsers,
                totalSales
        );
    }

    /**
     * 현재 주문 상태에서 목표 상태로 전이 가능한지 검증합니다.
     *
     * @param currentStatus 현재 주문 상태
     * @param nextStatus 변경할 목표 상태
     */
    private void validateOrderStatusChange(
            OrderEntity.OrderStatus currentStatus,
            OrderEntity.OrderStatus nextStatus
    ) {
        if (currentStatus == nextStatus) {
            return;
        }

        boolean isValidTransition =
                (currentStatus == OrderEntity.OrderStatus.PENDING
                        && (nextStatus == OrderEntity.OrderStatus.PAID
                        || nextStatus == OrderEntity.OrderStatus.CANCELLED))
                || (currentStatus == OrderEntity.OrderStatus.PAID
                        && (nextStatus == OrderEntity.OrderStatus.SHIPPED
                        || nextStatus == OrderEntity.OrderStatus.CANCELLED))
                || (currentStatus == OrderEntity.OrderStatus.SHIPPED
                        && nextStatus == OrderEntity.OrderStatus.DELIVERED)
                || (currentStatus == OrderEntity.OrderStatus.CANCEL_REQUESTED
                        && (nextStatus == OrderEntity.OrderStatus.CANCELLED
                        || nextStatus == OrderEntity.OrderStatus.PAID))
                || (currentStatus == OrderEntity.OrderStatus.REFUND_REQUESTED
                        && (nextStatus == OrderEntity.OrderStatus.REFUNDED
                        || nextStatus == OrderEntity.OrderStatus.DELIVERED));

        if (!isValidTransition) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "현재 주문 상태에서는 요청한 상태로 변경할 수 없습니다."
            );
        }
    }

    /**
     * 환불/취소로 종료되는 주문의 재고를 주문 항목 기준으로 복구합니다.
     *
     * [주의]
     * 이미 재고가 복구된 주문 상태에서는 이 메서드를 다시 호출하면 안 되므로
     * 반드시 상태 전이 검증 이후에만 사용해야 합니다.
     */
    private void restoreOrderItemStocks(Long orderId) {
        // OrderService와 동일한 복구 규칙을 유지해 주문 도메인 전체의 재고 일관성을 맞춥니다.
        orderItemRepository.findByOrderId(orderId)
                .forEach(item -> bookService.increaseStock(item.getBookId(), item.getQuantity()));
    }

    /**
     * 관리자 매출 통계를 계산합니다.
     *
     * [동작 방식]
     * 1. 구독 매출: ACTIVE + EXPIRED 상태의 paymentAmount 합산
     * 2. 도서 매출: PAID ~ PURCHASE_CONFIRMED 상태의 totalPrice 합산
     * 3. 환불/취소: REFUNDED + CANCELLED 상태의 totalPrice 합산
     * 4. 일/월/연 매출: 각각 당일/당월/당해 기간의 구독 + 도서 매출 합산
     *
     * @return 매출 통계 응답 DTO
     */
    public AdminRevenueResponseDto getRevenue() {
        long subscriptionSales = sumSubscriptionSales(null, null);
        long bookSales = sumOrderSales(REVENUE_ORDER_STATUSES, null, null);
        long refundTotal = sumOrderSales(REFUND_ORDER_STATUSES, null, null);

        LocalDate today = LocalDate.now();
        LocalDateTime dayStart = today.atStartOfDay();
        LocalDateTime dayEnd = today.plusDays(1).atStartOfDay();
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime yearStart = today.withDayOfYear(1).atStartOfDay();

        long dailySales = sumOrderSales(REVENUE_ORDER_STATUSES, dayStart, dayEnd)
                + sumSubscriptionSales(dayStart, dayEnd);
        long monthlySales = sumOrderSales(REVENUE_ORDER_STATUSES, monthStart, dayEnd)
                + sumSubscriptionSales(monthStart, dayEnd);
        long yearlySales = sumOrderSales(REVENUE_ORDER_STATUSES, yearStart, dayEnd)
                + sumSubscriptionSales(yearStart, dayEnd);

        return new AdminRevenueResponseDto(
                subscriptionSales, bookSales, refundTotal,
                dailySales, monthlySales, yearlySales
        );
    }

    /**
     * 특정 기간의 매출을 상세 조회합니다.
     * 매출관리 탭의 달력에서 날짜 선택 시 사용합니다.
     *
     * @param startDate 시작 날짜
     * @param endDate 종료 날짜
     * @return 기간별 매출 상세 응답 DTO
     */
    public AdminRevenueDateResponseDto getRevenueByDate(LocalDate startDate, LocalDate endDate) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.plusDays(1).atStartOfDay();

        long subSales = sumSubscriptionSales(start, end);
        long bkSales = sumOrderSales(REVENUE_ORDER_STATUSES, start, end);
        long refund = sumOrderSales(REFUND_ORDER_STATUSES, start, end);

        return new AdminRevenueDateResponseDto(
                startDate, endDate,
                subSales, bkSales, refund,
                subSales + bkSales - refund
        );
    }

    /**
     * 주문 매출 합계를 계산합니다.
     * start/end가 null이면 전체 기간 합산입니다.
     */
    private long sumOrderSales(List<OrderEntity.OrderStatus> statuses,
                               LocalDateTime start, LocalDateTime end) {
        List<OrderEntity> orders;
        if (start != null && end != null) {
            orders = orderRepository
                    .findAllByStatusInAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(statuses, start, end);
        } else {
            orders = orderRepository.findAllByStatusIn(statuses);
        }
        return orders.stream().mapToLong(OrderEntity::getTotalPrice).sum();
    }

    /**
     * 구독 매출 합계를 계산합니다.
     * start/end가 null이면 전체 기간 합산입니다.
     */
    private long sumSubscriptionSales(LocalDateTime start, LocalDateTime end) {
        List<SubscriptionEntity> subs;
        if (start != null && end != null) {
            subs = subscriptionRepository
                    .findAllByStatusInAndSubscribedAtGreaterThanEqualAndSubscribedAtLessThan(
                            REVENUE_SUB_STATUSES, start, end);
        } else {
            subs = subscriptionRepository.findAllByStatusIn(REVENUE_SUB_STATUSES);
        }
        return subs.stream().mapToLong(SubscriptionEntity::getPaymentAmount).sum();
    }
}
