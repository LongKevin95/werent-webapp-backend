import { ORDER_STATUS } from "../../common/constants.js";
import ApiError from "../../common/ApiError.js";
import PaymentOrder from "./payment.model.js";
import TopupPromotion from "./promotion.model.js";

const TOP_UP_PROMOTION_SELECTION_LIMIT = 3;
const TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT = 100;

export function calculatePromotionBonus(amount, promotion) {
  if (!promotion) return 0;
  const calculated = Math.floor((Number(amount) * promotion.bonusPercent) / 100);
  return promotion.maximumBonus == null ? calculated : Math.min(calculated, promotion.maximumBonus);
}

function serializeTopupPromotion(promotion, usageCount = 0) {
  const perUserLimit = Number(promotion.perUserLimit ?? 1);

  return {
    id: promotion._id.toString(),
    name: promotion.name,
    code: promotion.code,
    bonusPercent: promotion.bonusPercent,
    minimumAmount: promotion.minimumAmount,
    maximumBonus: promotion.maximumBonus,
    priority: promotion.priority,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    perUserLimit,
    usageCount,
    remainingUses: Math.max(perUserLimit - usageCount, 0),
    stackable: promotion.stackable ?? false,
    autoApply: promotion.autoApply ?? false,
  };
}

function buildPromotionUsageFilter(userId, promotion, options) {
  const filter = {
    user: userId,
    transactionType: "topup",
    $or: [
      { promotion: promotion._id },
      { "promotions.promotion": promotion._id },
    ],
  };

  if (!options.includePendingReservations) {
    filter.status = ORDER_STATUS.PAID;
    return filter;
  }

  filter.$and = [
    {
      $or: [
        { status: ORDER_STATUS.PAID },
        {
          status: ORDER_STATUS.PENDING,
          expiresAt: { $gt: options.referenceDate },
        },
      ],
    },
  ];
  return filter;
}

function buildPromotionSnapshot(promotion, amount) {
  return {
    promotion: promotion._id,
    name: promotion.name,
    code: promotion.code,
    bonusPercent: promotion.bonusPercent,
    minimumAmount: promotion.minimumAmount,
    maximumBonus: promotion.maximumBonus,
    priority: promotion.priority,
    perUserLimit: promotion.perUserLimit,
    stackable: promotion.stackable ?? false,
    autoApply: promotion.autoApply ?? false,
    bonusAmount: calculatePromotionBonus(amount, promotion),
  };
}

function buildPromotionSnapshotFields(promotions, amount, evaluatedAt) {
  const firstPromotion = promotions[0] ?? null;
  const promotionSnapshots = promotions.map((promotion) =>
    buildPromotionSnapshot(promotion, amount),
  );

  return {
    promotion: firstPromotion?._id ?? null,
    promotionName: firstPromotion?.name ?? null,
    promotionCode: firstPromotion?.code ?? null,
    promotionBonusPercent: firstPromotion?.bonusPercent ?? null,
    promotionMinimumAmount: firstPromotion?.minimumAmount ?? null,
    promotionMaximumBonus: firstPromotion?.maximumBonus ?? null,
    promotionPriority: firstPromotion?.priority ?? null,
    promotionPerUserLimit: firstPromotion?.perUserLimit ?? null,
    promotionStackable: firstPromotion?.stackable ?? false,
    promotionAutoApply: firstPromotion?.autoApply ?? false,
    promotions: promotionSnapshots,
    promotionSnapshotLocked: true,
    promotionEvaluatedAt: evaluatedAt,
  };
}

export async function findApplicableTopupPromotion(userId, amount, options = {}) {
  const referenceDate = options.referenceDate ?? new Date();
  const promotionFilter = {
    startsAt: { $lte: referenceDate },
    endsAt: { $gte: referenceDate },
    minimumAmount: { $lte: amount },
  };
  if (options.requireActive !== false) {
    promotionFilter.isActive = true;
  }
  if (options.autoApply !== undefined) {
    promotionFilter.autoApply = options.autoApply;
  }
  const promotions = await TopupPromotion.find(promotionFilter).sort({ priority: -1, createdAt: 1 });
  const candidates = [];

  for (const promotion of promotions) {
    const usageFilter = buildPromotionUsageFilter(userId, promotion, {
      ...options,
      referenceDate,
    });
    if (options.excludeOrderId) usageFilter._id = { $ne: options.excludeOrderId };
    const usageCount = await PaymentOrder.countDocuments(usageFilter);
    if (usageCount < promotion.perUserLimit) {
      candidates.push({
        promotion,
        bonusAmount: calculatePromotionBonus(amount, promotion),
      });
    }
  }

  candidates.sort((left, right) => {
    const priorityDiff = (right.promotion.priority ?? 0) - (left.promotion.priority ?? 0);
    if (priorityDiff) return priorityDiff;

    const bonusDiff = right.bonusAmount - left.bonusAmount;
    if (bonusDiff) return bonusDiff;

    const percentDiff = right.promotion.bonusPercent - left.promotion.bonusPercent;
    if (percentDiff) return percentDiff;

    return left.promotion.createdAt - right.promotion.createdAt;
  });

  return candidates[0]?.promotion ?? null;
}

async function findRequestedTopupPromotions(userId, amount, promotionIds, options = {}) {
  const uniquePromotionIds = [...new Set((promotionIds ?? []).map(String))];

  if (!uniquePromotionIds.length) {
    return [];
  }

  if (uniquePromotionIds.length > TOP_UP_PROMOTION_SELECTION_LIMIT) {
    throw new ApiError(400, `Chỉ được áp dụng tối đa ${TOP_UP_PROMOTION_SELECTION_LIMIT} chương trình khuyến mãi.`);
  }

  if (uniquePromotionIds.some((promotionId) => !/^[a-f\d]{24}$/i.test(String(promotionId)))) {
    throw new ApiError(400, "Chương trình khuyến mãi không hợp lệ hoặc chưa đủ điều kiện áp dụng.");
  }

  const referenceDate = options.referenceDate ?? new Date();
  const promotions = await TopupPromotion.find({
    _id: { $in: uniquePromotionIds },
    isActive: true,
    autoApply: false,
    startsAt: { $lte: referenceDate },
    endsAt: { $gte: referenceDate },
    minimumAmount: { $lte: amount },
  });

  if (promotions.length !== uniquePromotionIds.length) {
    throw new ApiError(400, "Chương trình khuyến mãi không hợp lệ hoặc chưa đủ điều kiện áp dụng.");
  }

  const promotionById = new Map(
    promotions.map((promotion) => [promotion._id.toString(), promotion]),
  );
  const orderedPromotions = uniquePromotionIds.map((promotionId) =>
    promotionById.get(String(promotionId)),
  );

  if (
    orderedPromotions.length > 1 &&
    orderedPromotions.some((promotion) => !promotion.stackable)
  ) {
    throw new ApiError(400, "Chỉ các khuyến mãi cho phép áp dụng song song mới được chọn cùng nhau.");
  }

  const totalPercent = orderedPromotions.reduce(
    (total, promotion) => total + Number(promotion.bonusPercent || 0),
    0,
  );
  if (totalPercent > TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT) {
    throw new ApiError(400, `Tổng % khuyến mãi áp dụng song song không được vượt quá ${TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT}%.`);
  }

  for (const promotion of orderedPromotions) {
    const usageFilter = buildPromotionUsageFilter(userId, promotion, {
      ...options,
      includePendingReservations: true,
      referenceDate,
    });
    if (options.excludeOrderId) usageFilter._id = { $ne: options.excludeOrderId };
    const usageCount = await PaymentOrder.countDocuments(usageFilter);

    if (usageCount >= promotion.perUserLimit) {
      throw new ApiError(400, "Chương trình khuyến mãi không hợp lệ hoặc chưa đủ điều kiện áp dụng.");
    }
  }

  return orderedPromotions;
}

async function findAutoApplyTopupPromotions(userId, amount, options = {}) {
  const referenceDate = options.referenceDate ?? new Date();
  const promotions = await TopupPromotion.find({
    isActive: true,
    autoApply: true,
    startsAt: { $lte: referenceDate },
    endsAt: { $gte: referenceDate },
    minimumAmount: { $lte: amount },
  }).sort({ priority: -1, createdAt: 1 });

  const candidates = [];
  for (const promotion of promotions) {
    const usageFilter = buildPromotionUsageFilter(userId, promotion, {
      ...options,
      includePendingReservations: true,
      referenceDate,
    });
    if (options.excludeOrderId) usageFilter._id = { $ne: options.excludeOrderId };
    const usageCount = await PaymentOrder.countDocuments(usageFilter);

    if (usageCount < promotion.perUserLimit) {
      candidates.push(promotion);
    }
  }

  if (!candidates.length) {
    return [];
  }

  const [firstPromotion] = candidates;
  if (!firstPromotion.stackable) {
    return [firstPromotion];
  }

  const selectedPromotions = [];
  let totalPercent = 0;
  for (const promotion of candidates) {
    if (!promotion.stackable) {
      continue;
    }
    const nextPercent = totalPercent + Number(promotion.bonusPercent || 0);
    if (
      selectedPromotions.length >= TOP_UP_PROMOTION_SELECTION_LIMIT ||
      nextPercent > TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT
    ) {
      break;
    }
    selectedPromotions.push(promotion);
    totalPercent = nextPercent;
  }

  return selectedPromotions;
}

export async function listCurrentTopupPromotions(userId, options = {}) {
  const referenceDate = options.referenceDate ?? new Date();
  const promotions = await TopupPromotion.find({
    isActive: true,
    startsAt: { $lte: referenceDate },
    endsAt: { $gte: referenceDate },
  }).sort({ priority: -1, createdAt: 1 });

  const items = [];
  const autoItems = [];
  for (const promotion of promotions) {
    const usageCount = await PaymentOrder.countDocuments(
      buildPromotionUsageFilter(userId, promotion, {
        includePendingReservations: true,
        referenceDate,
      }),
    );
    const serializedPromotion = serializeTopupPromotion(promotion, usageCount);
    if (promotion.autoApply) {
      autoItems.push(serializedPromotion);
    } else {
      items.push(serializedPromotion);
    }
  }

  return { items, autoItems };
}

export async function buildLockedTopupPromotionFields(userId, amount, options = {}) {
  const evaluatedAt = options.referenceDate ?? new Date();
  const requestedPromotionIds = options.promotionIds ?? (options.promotionId ? [options.promotionId] : []);
  const autoPromotions = await findAutoApplyTopupPromotions(userId, amount, {
    referenceDate: evaluatedAt,
  });
  const requestedPromotions = requestedPromotionIds.length
    ? await findRequestedTopupPromotions(userId, amount, requestedPromotionIds, {
        referenceDate: evaluatedAt,
      })
    : autoPromotions.length
      ? []
      : [
        await findApplicableTopupPromotion(userId, amount, {
          includePendingReservations: true,
          referenceDate: evaluatedAt,
          autoApply: false,
        }),
      ].filter(Boolean);
  const promotions = [...autoPromotions, ...requestedPromotions];

  if (promotions.length > TOP_UP_PROMOTION_SELECTION_LIMIT) {
    throw new ApiError(400, `Chỉ được áp dụng tối đa ${TOP_UP_PROMOTION_SELECTION_LIMIT} chương trình khuyến mãi.`);
  }

  if (promotions.length > 1 && promotions.some((promotion) => !promotion.stackable)) {
    throw new ApiError(400, "Chỉ các khuyến mãi cho phép áp dụng song song mới được chọn cùng nhau.");
  }

  const promotionPercent = promotions.reduce(
    (total, promotion) => total + Number(promotion.bonusPercent || 0),
    0,
  );
  if (promotionPercent > TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT) {
    throw new ApiError(400, `Tổng % khuyến mãi áp dụng song song không được vượt quá ${TOP_UP_STACKED_PROMOTION_PERCENT_LIMIT}%.`);
  }

  const bonusAmount = promotions.reduce(
    (total, promotion) => total + calculatePromotionBonus(amount, promotion),
    0,
  );
  return {
    bonusAmount,
    totalCredit: Number(amount) + bonusAmount,
    ...buildPromotionSnapshotFields(promotions, amount, evaluatedAt),
  };
}

export async function refreshTopupPromotionFields(order, options = {}) {
  if (!order || order.transactionType !== "topup" || order.orderType !== "wallet_top_up") {
    return order;
  }

  if (!options.force && (order.promotionSnapshotLocked || order.bonusAmount > 0 || order.promotion)) {
    return order;
  }

  const referenceDate = options.referenceDate ?? order.paidAt ?? order.confirmedAt ?? order.createdAt ?? new Date();
  const promotion = await findApplicableTopupPromotion(order.user, order.amount, {
    excludeOrderId: order._id,
    referenceDate,
    requireActive: options.requireActive,
  });
  const bonusAmount = calculatePromotionBonus(order.amount, promotion);
  order.baseAmount = order.baseAmount || order.amount;
  order.bonusAmount = bonusAmount;
  order.totalCredit = order.amount + bonusAmount;
  Object.assign(order, buildPromotionSnapshotFields(promotion ? [promotion] : [], order.amount, referenceDate));
  return order;
}
