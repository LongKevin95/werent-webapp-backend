import ApiError from "../../common/ApiError.js";
import { ORDER_STATUS } from "../../common/constants.js";
import User from "../users/user.model.js";
import PaymentOrder from "./payment.model.js";
import WalletTransaction from "./wallet-transaction.model.js";

const TEST_TOP_UP_PROMOTION_DAYS = 30;

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function calculateTopUpPromotionAmount(order) {
  return Math.max(Number(order.bonusAmount ?? 0), 0);
}

function getTopUpPromotionExpiresAt(order) {
  return addDays(order.paidAt ?? order.updatedAt ?? new Date(), TEST_TOP_UP_PROMOTION_DAYS);
}

function isAdminDemoTopUp(order) {
  return order.provider === "admin_demo" || order.packageCode === "ADMIN_DEMO_TOPUP";
}

function serializeWalletTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    type: transaction.type,
    direction: transaction.direction,
    amount: transaction.amount,
    realAmount: transaction.realAmount,
    promotionAmount: transaction.promotionAmount,
    promotionRemainingAmount: transaction.promotionRemainingAmount,
    balanceAfter: transaction.balanceAfter,
    promotionBalanceAfter: transaction.promotionBalanceAfter,
    description: transaction.description,
    paymentOrder: transaction.paymentOrder,
    property: transaction.property,
    expiresAt: transaction.expiresAt,
    createdAt: transaction.createdAt,
    metadata: transaction.metadata,
  };
}

async function getWalletTotals(userId) {
  const now = new Date();
  const transactions = await WalletTransaction.find({ user: userId }).lean();

  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.type === "top_up") {
        summary.totalDeposited += transaction.realAmount ?? transaction.amount ?? 0;
        summary.walletBalance += transaction.realAmount ?? transaction.amount ?? 0;
      }

      if (transaction.type === "promotion_credit") {
        const isExpired =
          transaction.expiresAt && new Date(transaction.expiresAt) <= now;

        if (!isExpired) {
          summary.walletPromotionBalance +=
            transaction.promotionRemainingAmount ??
            transaction.promotionAmount ??
            transaction.amount ??
            0;
        }
      }

      if (transaction.type === "spend") {
        const realAmount = transaction.realAmount ?? 0;
        const promotionAmount = transaction.promotionAmount ?? 0;
        summary.walletBalance -= realAmount;
        summary.totalSpent += realAmount + promotionAmount;
      }

      if (transaction.type === "refund") {
        summary.walletBalance += transaction.realAmount ?? transaction.amount ?? 0;
        summary.walletPromotionBalance += transaction.promotionAmount ?? 0;
      }

      if (transaction.type === "admin_adjustment") {
        const adjustedAmount = transaction.realAmount ?? transaction.amount ?? 0;
        summary.walletBalance += transaction.direction === "credit" ? adjustedAmount : -adjustedAmount;
      }

      return summary;
    },
    {
      walletBalance: 0,
      walletPromotionBalance: 0,
      totalDeposited: 0,
      totalSpent: 0,
    },
  );
}

async function updateUserWalletSnapshot(userId, totals) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        walletBalance: Math.max(totals.walletBalance, 0),
        walletPromotionBalance: Math.max(totals.walletPromotionBalance, 0),
      },
    },
  );
}

export async function reconcileWalletTopUps(userId) {
  const paidTopUpOrders = await PaymentOrder.find({
    user: userId,
    orderType: "wallet_top_up",
    status: ORDER_STATUS.PAID,
  }).sort({ paidAt: 1, createdAt: 1 });

  for (const order of paidTopUpOrders) {
    const existingTopUp = await WalletTransaction.exists({
      paymentOrder: order._id,
      type: "top_up",
    });

    if (!existingTopUp) {
      await WalletTransaction.create({
        user: userId,
        type: "top_up",
        direction: "credit",
        amount: order.amount,
        realAmount: order.amount,
        description: isAdminDemoTopUp(order)
          ? "Admin nạp tiền demo"
          : "Nạp tiền vào ví WeRent",
        paymentOrder: order._id,
        metadata: {
          orderCode: order.orderCode,
          provider: order.provider,
          packageCode: order.packageCode,
        },
      });
    }

    const promotionAmount = calculateTopUpPromotionAmount(order);
    const existingPromotion = await WalletTransaction.exists({
      paymentOrder: order._id,
      type: "promotion_credit",
    });

    if (promotionAmount > 0 && !existingPromotion) {
      await WalletTransaction.create({
        user: userId,
        type: "promotion_credit",
        direction: "credit",
        amount: promotionAmount,
        promotionAmount,
        promotionRemainingAmount: promotionAmount,
        description: isAdminDemoTopUp(order)
          ? "Khuyến mãi nạp tiền demo"
          : "Ưu đãi nạp tiền",
        paymentOrder: order._id,
        expiresAt: getTopUpPromotionExpiresAt(order),
        metadata: {
          orderCode: order.orderCode,
          provider: order.provider,
          packageCode: order.packageCode,
          promotionName: order.promotionName ?? null,
          promotionDays: TEST_TOP_UP_PROMOTION_DAYS,
        },
      });
    }
  }

  const totals = await getWalletTotals(userId);
  await updateUserWalletSnapshot(userId, totals);

  return totals;
}

export async function getWalletOverview(userId) {
  const totals = await reconcileWalletTopUps(userId);
  const transactions = await WalletTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20);

  return {
    summary: {
      availableBalance: Math.max(totals.walletBalance, 0),
      promotionBalance: Math.max(totals.walletPromotionBalance, 0),
      totalDeposited: totals.totalDeposited,
      totalSpent: totals.totalSpent,
      promotionPolicy: {
        rate: null,
        expiresInDays: TEST_TOP_UP_PROMOTION_DAYS,
      },
    },
    transactions: transactions.map(serializeWalletTransaction),
  };
}

export async function creditWalletTopUp(order) {
  return reconcileWalletTopUps(order.user);
}

export async function adjustWalletBalance(userId, direction, amount, metadata = {}) {
  const totals = await reconcileWalletTopUps(userId);
  const normalizedAmount = Number(amount);
  if (direction === "debit" && totals.walletBalance < normalizedAmount) {
    throw new ApiError(400, "Số dư không đủ để thực hiện điều chỉnh giảm.");
  }

  const balanceBefore = totals.walletBalance + totals.walletPromotionBalance;
  const nextWalletBalance = totals.walletBalance + (direction === "credit" ? normalizedAmount : -normalizedAmount);
  const balanceAfter = nextWalletBalance + totals.walletPromotionBalance;
  const transaction = await WalletTransaction.create({
    user: userId,
    type: "admin_adjustment",
    direction,
    amount: normalizedAmount,
    realAmount: normalizedAmount,
    balanceAfter: nextWalletBalance,
    promotionBalanceAfter: totals.walletPromotionBalance,
    description: metadata.reason ?? "Điều chỉnh số dư bởi quản trị viên",
    metadata,
  });
  await updateUserWalletSnapshot(userId, {
    walletBalance: nextWalletBalance,
    walletPromotionBalance: totals.walletPromotionBalance,
  });
  return { transaction, balanceBefore, balanceAfter };
}

export async function assertWalletCanSpend(userId, amount) {
  const spendAmount = Number(amount || 0);

  if (spendAmount <= 0) {
    return;
  }

  const totals = await reconcileWalletTopUps(userId);
  const totalAvailable =
    Math.max(totals.walletBalance, 0) +
    Math.max(totals.walletPromotionBalance, 0);

  if (totalAvailable < spendAmount) {
    throw new ApiError(
      400,
      "Số dư ví không đủ để thanh toán gói đăng tin. Vui lòng nạp thêm tiền.",
    );
  }
}

export async function spendWalletForListing(userId, amount, options = {}) {
  const spendAmount = Number(amount || 0);

  if (spendAmount <= 0) {
    return {
      realAmount: 0,
      promotionAmount: 0,
    };
  }

  const totals = await reconcileWalletTopUps(userId);
  const totalAvailable =
    Math.max(totals.walletBalance, 0) +
    Math.max(totals.walletPromotionBalance, 0);

  if (totalAvailable < spendAmount) {
    throw new ApiError(
      400,
      "Số dư ví không đủ để thanh toán gói đăng tin. Vui lòng nạp thêm tiền.",
    );
  }

  const now = new Date();
  let remainingPromotionToSpend = Math.min(
    spendAmount,
    Math.max(totals.walletPromotionBalance, 0),
  );
  const promotionCredits = await WalletTransaction.find({
    user: userId,
    type: "promotion_credit",
    promotionRemainingAmount: { $gt: 0 },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ expiresAt: 1, createdAt: 1 });

  for (const credit of promotionCredits) {
    if (remainingPromotionToSpend <= 0) {
      break;
    }

    const consumedAmount = Math.min(
      remainingPromotionToSpend,
      credit.promotionRemainingAmount,
    );
    credit.promotionRemainingAmount -= consumedAmount;
    remainingPromotionToSpend -= consumedAmount;
    await credit.save();
  }

  const promotionAmount =
    Math.min(spendAmount, Math.max(totals.walletPromotionBalance, 0)) -
    remainingPromotionToSpend;
  const realAmount = spendAmount - promotionAmount;
  const nextWalletBalance = Math.max(totals.walletBalance - realAmount, 0);
  const nextPromotionBalance = Math.max(
    totals.walletPromotionBalance - promotionAmount,
    0,
  );

  await WalletTransaction.create({
    user: userId,
    type: "spend",
    direction: "debit",
    amount: spendAmount,
    realAmount,
    promotionAmount,
    balanceAfter: nextWalletBalance,
    promotionBalanceAfter: nextPromotionBalance,
    description: options.description ?? "Thanh toán gói đăng tin",
    property: options.propertyId ?? null,
    metadata: options.metadata ?? null,
  });

  await updateUserWalletSnapshot(userId, {
    walletBalance: nextWalletBalance,
    walletPromotionBalance: nextPromotionBalance,
  });

  return {
    realAmount,
    promotionAmount,
  };
}
