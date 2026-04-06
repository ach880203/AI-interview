package com.aimentor.domain.book;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.common.payment.PaymentResultRequestDto;
import com.aimentor.common.payment.PaymentResultType;
import com.aimentor.domain.book.dto.BookResponseDto;
import com.aimentor.domain.book.dto.OrderActionRequestDto;
import com.aimentor.domain.book.dto.OrderCreateRequestDto;
import com.aimentor.domain.book.dto.OrderDetailResponseDto;
import com.aimentor.domain.book.dto.OrderItemResponseDto;
import com.aimentor.domain.book.dto.OrderResponseDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.payment.PortOneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 주문 비즈니스 로직 서비스입니다.
 *
 * [이번 변경의 핵심]
 * 예전에는 주문 생성과 동시에 PAID로 끝냈지만,
 * 이제는 주문 생성 -> 결제 결과 반영의 2단계로 나눕니다.
 * 이렇게 해야 승인, 실패, 취소를 각각 다른 상태로 남길 수 있습니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final BookService bookService;
    private final UserRepository userRepository;
    private final PortOneService portOneService;

    /**
     * 주문을 결제 대기 상태로 생성합니다.
     *
     * [동작 방식]
     * 1. 모든 상품의 재고를 먼저 확인합니다.
     * 2. 결제 대기 주문과 주문 항목을 저장합니다.
     * 3. 재고를 선차감해서 다른 결제 흐름과 겹칠 때 과판매를 줄입니다.
     *
     * [주의]
     * 장바구니는 아직 비우지 않습니다.
     * 결제가 실패했을 때 사용자가 다시 시도할 수 있어야 하기 때문입니다.
     */
    @Transactional
    public OrderDetailResponseDto createOrder(String email, OrderCreateRequestDto request) {
        UserEntity user = getUser(email);

        List<BookResponseDto> books = request.items().stream()
                .map(item -> {
                    BookResponseDto book = bookService.getBook(item.bookId());
                    if (book.stock() < item.quantity()) {
                        throw new BusinessException(ErrorCode.OUT_OF_STOCK);
                    }
                    return book;
                })
                .toList();

        int totalPrice = 0;
        for (int index = 0; index < request.items().size(); index++) {
            totalPrice += books.get(index).price() * request.items().get(index).quantity();
        }

        OrderEntity order = OrderEntity.builder()
                .user(user)
                .totalPrice(totalPrice)
                .postalCode(request.postalCode())
                .address(buildFinalAddress(request.address(), request.detailAddress()))
                .ordererName(request.ordererName())
                .ordererPhone(request.ordererPhone())
                .paymentMethod(request.paymentMethod())
                .orderedAt(LocalDateTime.now())
                .build();

        saveDefaultShippingInfoIfRequested(user, request);
        orderRepository.save(order);
        List<OrderItemResponseDto> itemDtos = buildOrderItems(order, request, books);

        log.info("주문 생성 완료: orderId={}, userId={}, totalPrice={}, status={}",
                order.getId(), user.getId(), totalPrice, order.getStatus());
        return OrderDetailResponseDto.of(order, itemDtos);
    }

    /**
     * 결제 결과를 반영합니다.
     *
     * [중요]
     * 결제 결과는 PENDING 상태에서 한 번만 반영해야 합니다.
     * 이미 승인되었거나 취소된 주문에 다시 실패/취소를 누르면 재고가 두 번 복구될 수 있어서
     * 반드시 상태를 먼저 검증합니다.
     */
    @Transactional
    public OrderDetailResponseDto applyPaymentResult(String email, Long orderId, PaymentResultRequestDto request) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);

        validateUserOrderAction(
                order.getStatus(),
                List.of(OrderEntity.OrderStatus.PENDING),
                "결제 대기 상태의 주문만 결제 결과를 반영할 수 있습니다."
        );

        if (request.resultType() == PaymentResultType.APPROVED) {
            order.markAsPaid();
            cartItemRepository.deleteByUser(user);
        } else if (request.resultType() == PaymentResultType.CANCELLED) {
            restoreOrderItemStocks(order.getId());
            order.cancel(resolvePaymentReason(request.reason(), "카카오페이 결제가 취소되었습니다."));
        } else {
            restoreOrderItemStocks(order.getId());
            order.markAsPaymentFailed(resolvePaymentReason(request.reason(), "카카오페이 결제 승인에 실패했습니다."));
        }

        return buildOrderDetail(order);
    }

    /**
     * PortOne 결제 검증 후 주문을 PAID로 확정합니다.
     *
     * [흐름]
     * 1. 주문 소유권 · 상태(PENDING) 확인
     * 2. PortOne V2 API로 paymentId 조회 → 상태(PAID) + 금액 비교
     * 3. 검증 통과 시 PAID 전환 + 장바구니 비우기
     * 4. 금액 불일치 / 상태 불일치 시 BusinessException → 결제 실패 처리
     *
     * [위변조 방지]
     * 프론트에서 보내는 paymentId는 "order_{orderId}_{ts}" 형식입니다.
     * 백엔드는 PortOne에 직접 조회해 결제 금액이 DB 주문 금액과 일치하는지 확인합니다.
     */
    @Transactional
    public OrderDetailResponseDto verifyAndConfirmPayment(String email, Long orderId, String paymentId) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);

        // 이미 처리된 주문이면 현재 상태 그대로 반환 (멱등성 — Webhook 중복 호출 대비)
        if (order.getStatus() == OrderEntity.OrderStatus.PAID) {
            log.info("이미 결제 완료된 주문: orderId={}", orderId);
            return buildOrderDetail(order);
        }

        validateUserOrderAction(
                order.getStatus(),
                List.of(OrderEntity.OrderStatus.PENDING),
                "결제 대기 상태의 주문만 검증할 수 있습니다."
        );

        try {
            // PortOne V2 결제 검증 (금액 위변조 포함)
            portOneService.verifyPayment(paymentId, order.getTotalPrice());
            order.markAsPaid();
            cartItemRepository.deleteByUser(user);
            log.info("PortOne 결제 검증 완료 → PAID: orderId={}, paymentId={}", orderId, paymentId);
        } catch (BusinessException e) {
            // 검증 실패 시 재고 복구 + 결제 실패 상태로 변경
            restoreOrderItemStocks(orderId);
            order.markAsPaymentFailed("PortOne 결제 검증 실패: " + e.getErrorCode().getMessage());
            log.warn("PortOne 결제 검증 실패 → PAYMENT_FAILED: orderId={}, reason={}", orderId, e.getMessage());
            throw e;
        }

        return buildOrderDetail(order);
    }

    /**
     * 내 주문 목록을 최신순으로 조회합니다.
     */
    public List<OrderResponseDto> getOrders(String email) {
        UserEntity user = getUser(email);
        List<OrderEntity> orders = orderRepository.findByUserOrderByOrderedAtDesc(user);
        Map<Long, List<OrderItemEntity>> orderItemsByOrderId = getOrderItemsByOrderId(orders);
        Map<Long, BookEntity> booksById = getBooksById(orderItemsByOrderId.values());

        return orders.stream()
                .map(order -> buildOrderSummary(order, orderItemsByOrderId.get(order.getId()), booksById))
                .toList();
    }

    /**
     * 내 주문 상세를 조회합니다.
     */
    public OrderDetailResponseDto getOrderDetail(String email, Long orderId) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);
        return buildOrderDetail(order);
    }

    /**
     * 사용자가 주문 취소를 요청합니다.
     *
     * [변경 사항]
     * 이전에는 즉시 CANCELLED로 전환했지만,
     * 이제는 CANCEL_REQUESTED로 전환하고 관리자 승인을 기다립니다.
     * 관리자가 승인하면 AdminService에서 재고 복구 + CANCELLED 처리를 합니다.
     */
    @Transactional
    public OrderDetailResponseDto cancelOrder(String email, Long orderId, OrderActionRequestDto request) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);

        validateUserOrderAction(
                order.getStatus(),
                List.of(OrderEntity.OrderStatus.PENDING, OrderEntity.OrderStatus.PAID),
                "결제 완료 전 주문과 결제 완료 주문만 취소 요청할 수 있습니다."
        );

        // 결제 대기 상태는 실제 승인 전 단계라서 사용자가 취소하면 바로 종료해도 안전합니다.
        if (order.getStatus() == OrderEntity.OrderStatus.PENDING) {
            restoreOrderItemStocks(order.getId());
            order.cancel(request.reason());
        } else {
            // 결제 완료 이후 취소는 관리자 확인이 필요한 흐름으로 유지합니다.
            order.requestCancel(request.reason());
        }
        return buildOrderDetail(order);
    }

    /**
     * 사용자가 환불을 요청합니다.
     */
    @Transactional
    public OrderDetailResponseDto requestRefund(String email, Long orderId, OrderActionRequestDto request) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);

        validateUserOrderAction(
                order.getStatus(),
                List.of(OrderEntity.OrderStatus.DELIVERED, OrderEntity.OrderStatus.PURCHASE_CONFIRMED),
                "배송 완료된 주문만 환불 요청할 수 있습니다."
        );

        order.requestRefund(request.reason());
        return buildOrderDetail(order);
    }

    /**
     * 사용자가 구매 확정을 처리합니다.
     */
    @Transactional
    public OrderDetailResponseDto confirmPurchase(String email, Long orderId, OrderActionRequestDto request) {
        UserEntity user = getUser(email);
        OrderEntity order = getOwnedOrder(user, orderId);

        validateUserOrderAction(
                order.getStatus(),
                List.of(OrderEntity.OrderStatus.DELIVERED),
                "배송 완료된 주문만 구매 확정할 수 있습니다."
        );

        order.confirmPurchase(request.reason());
        return buildOrderDetail(order);
    }

    /**
     * 주문 상세 응답을 현재 상태 기준으로 다시 조립합니다.
     *
     * [의도]
     * 목록, 완료 화면, 상세 모달이 모두 같은 기준으로 보이게 하려고
     * 주문 항목 조립을 한곳에 모았습니다.
     */
    private OrderDetailResponseDto buildOrderDetail(OrderEntity order) {
        List<OrderItemResponseDto> items = orderItemRepository.findByOrderId(order.getId())
                .stream()
                .map(item -> OrderItemResponseDto.of(item, getBookTitleSafely(item.getBookId())))
                .toList();

        return OrderDetailResponseDto.of(order, items);
    }

    /**
     * 주문 항목을 만들고 재고를 선차감합니다.
     */
    private List<OrderItemResponseDto> buildOrderItems(
            OrderEntity order,
            OrderCreateRequestDto request,
            List<BookResponseDto> books
    ) {
        return java.util.stream.IntStream.range(0, request.items().size())
                .mapToObj(index -> {
                    OrderCreateRequestDto.OrderItemRequestDto item = request.items().get(index);
                    BookResponseDto book = books.get(index);

                    bookService.decreaseStock(item.bookId(), item.quantity());

                    OrderItemEntity orderItem = orderItemRepository.save(
                            OrderItemEntity.builder()
                                    .order(order)
                                    .bookId(item.bookId())
                                    .quantity(item.quantity())
                                    .price(book.price())
                                    .build()
                    );

                    return OrderItemResponseDto.of(orderItem, book.title());
                })
                .toList();
    }

    /**
     * 주문 항목 기준으로 재고를 복구합니다.
     *
     * [주의]
     * 결제 실패와 취소에서만 호출해야 합니다.
     * 승인 후에 다시 호출하면 재고가 잘못 늘어날 수 있습니다.
     */
    private void restoreOrderItemStocks(Long orderId) {
        orderItemRepository.findByOrderId(orderId)
                .forEach(item -> bookService.increaseStock(item.getBookId(), item.getQuantity()));
    }

    /**
     * 주문 목록 화면에서 대표 상품명을 만들기 위해 주문 항목을 주문 ID 기준으로 다시 묶습니다.
     *
     * [이유]
     * 주문마다 개별 조회를 하면 주문 수가 많을수록 느려지기 쉬워서
     * 한 번에 읽은 뒤 메모리에서 다시 나누는 방식으로 정리합니다.
     */
    private Map<Long, List<OrderItemEntity>> getOrderItemsByOrderId(List<OrderEntity> orders) {
        if (orders.isEmpty()) {
            return Map.of();
        }

        List<Long> orderIds = orders.stream()
                .map(OrderEntity::getId)
                .toList();

        return orderItemRepository.findByOrderIdIn(orderIds)
                .stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));
    }

    /**
     * 주문 항목에서 참조하는 도서 정보를 한 번에 읽어 옵니다.
     *
     * [주의]
     * 삭제된 도서는 맵에 없을 수 있으므로, 제목 계산에서는 항상 null 가능성을 같이 처리합니다.
     */
    private Map<Long, BookEntity> getBooksById(Collection<List<OrderItemEntity>> orderItemsGroups) {
        List<Long> bookIds = orderItemsGroups.stream()
                .flatMap(Collection::stream)
                .map(OrderItemEntity::getBookId)
                .distinct()
                .toList();

        return bookService.findBooksByIds(bookIds)
                .stream()
                .collect(Collectors.toMap(BookEntity::getId, Function.identity()));
    }

    /**
     * 주문 목록에 필요한 대표 상품명과 상품 수를 함께 조립합니다.
     *
     * [표시 의도]
     * 마이페이지에서는 주문 번호보다 어떤 책을 샀는지가 먼저 보여야
     * 사용자가 구매내역을 훨씬 빨리 구분할 수 있습니다.
     */
    private OrderResponseDto buildOrderSummary(
            OrderEntity order,
            List<OrderItemEntity> orderItems,
            Map<Long, BookEntity> booksById
    ) {
        List<OrderItemEntity> safeOrderItems = orderItems == null ? List.of() : orderItems;

        return OrderResponseDto.from(
                order,
                resolvePrimaryBookTitle(safeOrderItems, booksById),
                safeOrderItems.size()
        );
    }

    /**
     * 주문 목록에 보여줄 대표 상품명을 계산합니다.
     */
    private String resolvePrimaryBookTitle(List<OrderItemEntity> orderItems, Map<Long, BookEntity> booksById) {
        if (orderItems.isEmpty()) {
            return "상품 정보 없음";
        }

        BookEntity firstBook = booksById.get(orderItems.getFirst().getBookId());
        if (firstBook == null || firstBook.getTitle() == null || firstBook.getTitle().isBlank()) {
            return "상품 정보 없음";
        }

        return firstBook.getTitle();
    }

    /**
     * 삭제된 책도 주문 이력에서는 제목이 비어 보이지 않게 보호합니다.
     */
    private String getBookTitleSafely(Long bookId) {
        try {
            return bookService.getBook(bookId).title();
        } catch (BusinessException exception) {
            return "(삭제된 도서)";
        }
    }

    /**
     * 결제 실패/취소 사유를 정리합니다.
     *
     * [의도]
     * 프런트가 사유를 보내지 않아도 결과 화면에서 이해할 수 있는 문구를 남기기 위한 보정입니다.
     */
    private String resolvePaymentReason(String reason, String defaultReason) {
        if (reason == null || reason.isBlank()) {
            return defaultReason;
        }

        return reason.trim();
    }

    /**
     * 주문서의 기본 주소와 상세 주소를 한 줄 주소로 합칩니다.
     *
     * [이유]
     * 주문 이력 화면은 한 줄 배송지 문자열을 그대로 보여주고,
     * 사용자 기본 배송지는 기본 주소와 상세 주소를 나눠 저장해야 해서
     * 주문 저장용 문자열을 따로 조합합니다.
     */
    private String buildFinalAddress(String address, String detailAddress) {
        String normalizedDetailAddress = normalizeBlank(detailAddress);
        if (normalizedDetailAddress == null) {
            return address;
        }

        return address + " " + normalizedDetailAddress;
    }

    /**
     * 사용자가 체크한 경우에만 이번 주문 주소를 기본 배송지로 저장합니다.
     *
     * [주의]
     * 주문자 이름과 연락처는 선물 주문 등 다른 상황이 있을 수 있어서 건드리지 않고,
     * 배송지 정보만 따로 갱신합니다.
     */
    private void saveDefaultShippingInfoIfRequested(UserEntity user, OrderCreateRequestDto request) {
        if (!Boolean.TRUE.equals(request.saveShippingInfo())) {
            return;
        }

        user.updateDefaultShippingInfo(
                request.postalCode(),
                request.address(),
                normalizeBlank(request.detailAddress())
        );
    }

    /**
     * 공백 문자열을 null로 바꿔 선택 입력값을 더 단순하게 다룹니다.
     */
    private String normalizeBlank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    /**
     * 사용자가 가진 주문인지 검증하고 조회합니다.
     */
    private OrderEntity getOwnedOrder(UserEntity user, Long orderId) {
        return orderRepository.findByIdAndUser(orderId, user)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /**
     * 주문 액션이 가능한 상태인지 검증합니다.
     */
    private void validateUserOrderAction(
            OrderEntity.OrderStatus currentStatus,
            List<OrderEntity.OrderStatus> allowedStatuses,
            String errorMessage
    ) {
        if (!allowedStatuses.contains(currentStatus)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, errorMessage);
        }
    }

    /**
     * 로그인 사용자 엔티티를 조회합니다.
     */
    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
