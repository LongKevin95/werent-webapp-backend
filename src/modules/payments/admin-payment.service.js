import mongoose from "mongoose";
import ApiError from "../../common/ApiError.js";
import { ORDER_STATUS } from "../../common/constants.js";
import { sendAdminWalletAdjustmentNotification } from "../notifications/notification.service.js";
import User from "../users/user.model.js";
import PaymentOrder from "./payment.model.js";
import TopupPromotion from "./promotion.model.js";
import {
  buildLockedTopupPromotionFields,
  calculatePromotionBonus,
  findApplicableTopupPromotion,
} from "./topup-promotion.service.js";
import {
  adjustWalletBalance,
  reconcileWalletTopUps,
} from "./wallet.service.js";

const DEMO_TOP_UP_PROVIDER = "admin_demo";
const DEMO_TOP_UP_PACKAGE_CODE = "ADMIN_DEMO_TOPUP";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertId(id, message) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, message);
}

async function reconcilePaidTopUpOrders(items) {
  const userIds = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.status === ORDER_STATUS.PAID &&
            item.orderType === "wallet_top_up" &&
            item.user,
        )
        .map((item) => String(item.user._id ?? item.user)),
    ),
  ];

  if (!userIds.length) return;
  await Promise.all(userIds.map((userId) => reconcileWalletTopUps(userId)));
}

function populateAdminTransactionQuery(query) {
  return query
    .populate(
      "user",
      "fullName email phone avatarUrl walletBalance walletPromotionBalance",
    )
    .populate("adminActor", "fullName email")
    .populate("promotion", "name code bonusPercent");
}

async function findDemoTopUpUser(payload) {
  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    assertId(payload.userId, "Không tìm thấy người dùng.");
  }

  const user = email
    ? await User.findOne({ email })
    : await User.findById(payload.userId);
  if (!user)
    throw new ApiError(404, "Không tìm thấy tài khoản với email đã nhập.");

  return user;
}

function serializeDemoTopUpQuote(user, amount, promotion) {
  const bonusAmount = calculatePromotionBonus(amount, promotion);
  return {
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      walletBalance: user.walletBalance ?? 0,
      walletPromotionBalance: user.walletPromotionBalance ?? 0,
    },
    amount,
    bonusAmount,
    totalCredit: amount + bonusAmount,
    promotion: promotion
      ? {
          id: promotion._id.toString(),
          name: promotion.name,
          code: promotion.code,
          bonusPercent: promotion.bonusPercent,
          maximumBonus: promotion.maximumBonus,
        }
      : null,
  };
}

export async function listAdminTransactions(query = {}) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const filter = {};
  const topupScopeTypes = [
    "topup",
    "promotion_bonus",
    "admin_adjustment",
    "refund",
  ];
  if (query.status) filter.status = query.status;
  if (query.transactionType) {
    filter.transactionType = query.transactionType;
  } else if (query.scope === "topup") {
    filter.transactionType = { $in: topupScopeTypes };
  }
  if (query.provider) filter.provider = query.provider;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = query.dateFrom;
    if (query.dateTo) filter.createdAt.$lte = query.dateTo;
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    const users = await User.find({
      $or: [{ fullName: pattern }, { email: pattern }, { phone: pattern }],
    }).select("_id");
    filter.$or = [
      { orderCode: pattern },
      { providerTransactionId: pattern },
      { user: { $in: users.map((user) => user._id) } },
    ];
  }
  const summaryFilter = query.transactionType
    ? { transactionType: query.transactionType }
    : query.scope === "topup"
      ? { transactionType: { $in: topupScopeTypes } }
      : {};

  let [items, total, statusCounts, totalValue] = await Promise.all([
    populateAdminTransactionQuery(PaymentOrder.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PaymentOrder.countDocuments(filter),
    PaymentOrder.aggregate([
      { $match: summaryFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    PaymentOrder.aggregate([
      {
        $match: {
          ...summaryFilter,
          status: ORDER_STATUS.PAID,
          transactionType: "topup",
        },
      },
      { $group: { _id: null, value: { $sum: "$baseAmount" } } },
    ]),
  ]);
  await reconcilePaidTopUpOrders(items);
  if (items.length) {
    items = await populateAdminTransactionQuery(
      PaymentOrder.find({ _id: { $in: items.map((item) => item._id) } }),
    ).sort({ createdAt: -1 });
  }
  const counts = Object.fromEntries(
    statusCounts.map((entry) => [entry._id, entry.count]),
  );
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    summary: {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      paid: counts.paid ?? 0,
      pending: counts.pending ?? 0,
      failed: counts.failed ?? 0,
      canceled: counts.canceled ?? 0,
      totalValue: totalValue[0]?.value ?? 0,
    },
  };
}

export async function getAdminTransaction(id) {
  assertId(id, "Không tìm thấy giao dịch.");
  let item = await populateAdminTransactionQuery(PaymentOrder.findById(id));
  if (!item) throw new ApiError(404, "Không tìm thấy giao dịch.");
  await reconcilePaidTopUpOrders([item]);
  item = await populateAdminTransactionQuery(PaymentOrder.findById(id));
  return item;
}

export async function adjustBalance(adminId, payload) {
  assertId(payload.userId, "Không tìm thấy người dùng.");
  const delta =
    payload.direction === "credit" ? payload.amount : -payload.amount;
  const user = await User.findById(payload.userId);
  if (!user) throw new ApiError(404, "Không tìm thấy người dùng.");
  const adjustment = await adjustWalletBalance(
    user._id,
    payload.direction,
    payload.amount,
    {
      adminId: String(adminId),
      reason: payload.reason,
    },
  );
  try {
    const item = await PaymentOrder.create({
      user: user._id,
      packageCode: "ADMIN_ADJUSTMENT",
      packageName:
        payload.direction === "credit"
          ? "Điều chỉnh tăng số dư"
          : "Điều chỉnh giảm số dư",
      amount: payload.amount,
      baseAmount: payload.amount,
      bonusAmount: 0,
      totalCredit: delta,
      balanceBefore: adjustment.balanceBefore,
      balanceAfter: adjustment.balanceAfter,
      orderCode: `ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      transactionType: "admin_adjustment",
      orderType: "admin_adjustment",
      provider: "system",
      status: ORDER_STATUS.PAID,
      adminActor: adminId,
      adjustmentReason: payload.reason,
      confirmedAt: new Date(),
      creditedAt: new Date(),
    });
    await sendAdminWalletAdjustmentNotification(
      user,
      item,
      payload.direction,
    ).catch(() => null);
    return item;
  } catch (error) {
    await adjustment.transaction.deleteOne().catch(() => null);
    await reconcileWalletTopUps(user._id).catch(() => null);
    throw error;
  }
}

export async function createDemoTopUp(adminId, payload) {
  const user = await findDemoTopUpUser(payload);
  const amount = Number(payload.amount);
  const paidAt = new Date();
  const promotionFields = await buildLockedTopupPromotionFields(
    user._id,
    amount,
    {
      referenceDate: paidAt,
    },
  );
  const bonusAmount = promotionFields.bonusAmount;
  const currentTotals = await reconcileWalletTopUps(user._id);
  const balanceBefore =
    Number(currentTotals.walletBalance ?? 0) +
    Number(currentTotals.walletPromotionBalance ?? 0);
  const totalCredit = amount + bonusAmount;

  const order = await PaymentOrder.create({
    user: user._id,
    packageCode: DEMO_TOP_UP_PACKAGE_CODE,
    packageName: "Admin nạp tiền demo",
    transactionType: "topup",
    orderType: "wallet_top_up",
    amount,
    baseAmount: amount,
    ...promotionFields,
    balanceBefore,
    balanceAfter: balanceBefore + totalCredit,
    orderCode: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    provider: DEMO_TOP_UP_PROVIDER,
    paymentMethod: "ADMIN_DEMO",
    status: ORDER_STATUS.PAID,
    paidAt,
    confirmedAt: paidAt,
    creditedAt: paidAt,
    adminActor: adminId,
    adjustmentReason: payload.note || "Admin nạp tiền demo",
    note: payload.note || "",
    rawWebhookPayload: {
      source: DEMO_TOP_UP_PROVIDER,
      adminActor: String(adminId),
    },
  });

  const totals = await reconcileWalletTopUps(user._id);
  const balanceAfter =
    Number(totals.walletBalance ?? 0) +
    Number(totals.walletPromotionBalance ?? 0);
  order.balanceAfter = balanceAfter;
  order.balanceBefore = Math.max(balanceAfter - totalCredit, 0);
  await order.save();

  return order.populate(
    "user",
    "fullName email phone avatarUrl walletBalance walletPromotionBalance",
  );
}

export async function getDemoTopUpQuote(payload) {
  const user = await findDemoTopUpUser(payload);
  const amount = Number(payload.amount);
  const promotion = await findApplicableTopupPromotion(user._id, amount, {
    includePendingReservations: true,
  });
  return serializeDemoTopUpQuote(user, amount, promotion);
}

export function listPromotions() {
  return TopupPromotion.find()
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 });
}

export function createPromotion(adminId, payload) {
  return TopupPromotion.create({
    ...payload,
    code: payload.code.toUpperCase(),
    createdBy: adminId,
  });
}

export async function updatePromotion(id, payload) {
  assertId(id, "Không tìm thấy chương trình khuyến mãi.");
  const item = await TopupPromotion.findById(id);
  if (!item) throw new ApiError(404, "Không tìm thấy chương trình khuyến mãi.");
  Object.assign(item, payload);
  if (payload.code) item.code = payload.code.toUpperCase();
  if (item.endsAt <= item.startsAt)
    throw new ApiError(400, "Thời gian kết thúc phải sau thời gian bắt đầu.");
  await item.save();
  return item;
}
