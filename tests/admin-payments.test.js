import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "payment-test-secret";
process.env.SEPAY_WEBHOOK_SECRET = "";
process.env.SEPAY_MERCHANT_ID = "TEST_MERCHANT";
process.env.SEPAY_SECRET_KEY = "test-sepay-secret";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: User } = await import("../src/modules/users/user.model.js");
const { default: PaymentOrder } = await import("../src/modules/payments/payment.model.js");
const { default: WalletTransaction } = await import("../src/modules/payments/wallet-transaction.model.js");

let mongoServer;
let adminToken;
let user;
let userToken;

describe("admin top-up management", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    const admin = await User.create({ fullName: "Payment Admin", email: "payment-admin@werent.vn", passwordHash: await bcrypt.hash("Password123!", 10), roles: ["admin"] });
    user = await User.create({ fullName: "Người Nạp", email: "topup@example.com", passwordHash: await bcrypt.hash("Password123!", 10) });
    adminToken = signAccessToken(admin); userToken = signAccessToken(user);
  });
  afterAll(async () => { await mongoose.disconnect(); await mongoServer?.stop(); });

  it("applies promotion, credits a webhook only once, and exposes transaction details", async () => {
    const now = Date.now();
    const promotion = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Thưởng 10%", code: "BONUS10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });
    expect(promotion.status).toBe(201);

    const order = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`).send({ amount: 100000, provider: "sepay" });
    expect(order.body.data.order).toMatchObject({
      transactionType: "topup",
      amount: 100000,
      bonusAmount: 10000,
      totalCredit: 110000,
    });

    const webhookPayload = { orderCode: order.body.data.order.orderCode, amount: 100000, transactionId: "SEPAY-UNIQUE-1", status: "paid" };
    const first = await request(app).post("/api/payments/webhook/sepay").send(webhookPayload);
    const repeated = await request(app).post("/api/payments/webhook/sepay").send(webhookPayload);
    expect(first.status).toBe(200); expect(repeated.status).toBe(200);
    user = await User.findById(user._id);
    expect(user.walletBalance).toBe(100000);
    expect(user.walletPromotionBalance).toBe(10000);

    const list = await request(app).get("/api/admin/payments/transactions")
      .set("Authorization", `Bearer ${adminToken}`).query({ status: "paid", scope: "topup" });
    expect(list.status).toBe(200);
    expect(list.body.data.summary).toMatchObject({ paid: 1, totalValue: 100000 });
    expect(list.body.data.items[0]).toMatchObject({ balanceBefore: 0, balanceAfter: 110000 });
  });

  it("keeps package payments separate and does not credit the wallet", async () => {
    const order = await request(app).post("/api/payments/orders")
      .set("Authorization", `Bearer ${userToken}`).send({ packageCode: "basic_7d" });
    expect(order.body.data.order).toMatchObject({
      transactionType: "package_payment",
      amount: 49000,
      totalCredit: 0,
    });
    const webhook = await request(app).post("/api/payments/webhook/sepay").send({
      orderCode: order.body.data.order.orderCode,
      amount: 49000,
      transactionId: "SEPAY-PACKAGE-1",
      status: "paid",
    });
    expect(webhook.status).toBe(200);
    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(0);
    expect(refreshedUser.walletPromotionBalance).toBe(0);

    const topupScope = await request(app).get("/api/admin/payments/transactions")
      .set("Authorization", `Bearer ${adminToken}`).query({ scope: "topup" });
    expect(topupScope.body.data.items).toHaveLength(0);
  });

  it("creates an auditable admin adjustment and prevents negative balances", async () => {
    const credit = await request(app).post("/api/admin/payments/adjustments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: user.id, direction: "credit", amount: 200000, reason: "Bồi hoàn giao dịch lỗi." });
    expect(credit.status).toBe(201);
    expect(credit.body.data.item).toMatchObject({ transactionType: "admin_adjustment", totalCredit: 200000, balanceBefore: 0, balanceAfter: 200000, adjustmentReason: "Bồi hoàn giao dịch lỗi." });
    expect((await User.findById(user._id)).walletBalance).toBe(200000);

    const invalidDebit = await request(app).post("/api/admin/payments/adjustments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: user.id, direction: "debit", amount: 300000, reason: "Thu hồi tiền ghi nhận sai." });
    expect(invalidDebit.status).toBe(400);
  });

  it("lists current wallet top-up promotions for the signed-in user", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Current bonus", code: "CURRENT10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 2, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Inactive bonus", code: "INACTIVE10", bonusPercent: 10, minimumAmount: 10000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), isActive: false });
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Future bonus", code: "FUTURE10", bonusPercent: 10, minimumAmount: 10000, startsAt: new Date(now + 60000), endsAt: new Date(now + 120000) });

    const response = await request(app).get("/api/payments/top-up/promotions")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      name: "Current bonus",
      code: "CURRENT10",
      bonusPercent: 10,
      minimumAmount: 10000,
      maximumBonus: 10000,
      priority: 2,
      perUserLimit: 1,
      usageCount: 0,
      remainingUses: 1,
      stackable: false,
      autoApply: false,
    });
    expect(response.body.data.autoItems).toEqual([]);
  });

  it("credits promotion money for QR checkout payments confirmed by SePay IPN", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "QR bonus 20%", code: "QR20", bonusPercent: 20, minimumAmount: 10000, maximumBonus: 30000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });

    const checkout = await request(app).post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 200000, paymentMethod: "qr" });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({
      transactionType: "topup",
      orderType: "wallet_top_up",
      amount: 200000,
      bonusAmount: 30000,
      totalCredit: 230000,
    });

    const ipn = await request(app).post("/api/payments/ipn/sepay").send({
      notification_type: "ORDER_PAID",
      order: {
        order_invoice_number: checkout.body.data.order.orderCode,
        order_amount: 200000,
        order_status: "CAPTURED",
        order_description: "QR checkout payment",
      },
      transaction: {
        transaction_id: "SEPAY-QR-IPN-1",
        transaction_amount: 200000,
        transaction_status: "APPROVED",
      },
    });

    expect(ipn.status).toBe(200);
    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(200000);
    expect(refreshedUser.walletPromotionBalance).toBe(30000);

    const order = await PaymentOrder.findById(checkout.body.data.order._id);
    const history = await WalletTransaction.find({ paymentOrder: order._id }).sort({ type: 1 });
    expect(history.map((item) => item.type)).toEqual(["promotion_credit", "top_up"]);
  });

  it("chooses the highest priority promotion before comparing bonus amounts", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Better money lower priority", code: "LOWBEST", bonusPercent: 50, minimumAmount: 10000, maximumBonus: 50000, priority: 1, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Higher priority campaign", code: "HIGH10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 10, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });

    const order = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });

    expect(order.body.data.order).toMatchObject({
      bonusAmount: 10000,
      totalCredit: 110000,
      promotionName: "Higher priority campaign",
      promotionCode: "HIGH10",
      promotionPriority: 10,
    });
  });

  it("uses the selected top-up promotion when checkout receives a promotion id", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Auto higher priority", code: "AUTO20", bonusPercent: 20, minimumAmount: 10000, maximumBonus: 20000, priority: 10, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });
    const selected = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Selected campaign", code: "SELECT10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 1, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });

    const checkout = await request(app).post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, paymentMethod: "qr", promotionIds: [selected.body.data.item._id] });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({
      promotionName: "Selected campaign",
      promotionCode: "SELECT10",
      bonusAmount: 10000,
      totalCredit: 110000,
    });
  });

  it("stacks selected top-up promotions only when every selected campaign is stackable", async () => {
    const now = Date.now();
    const first = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stack 10", code: "STACK10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 3, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5, stackable: true });
    const second = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stack 15", code: "STACK15", bonusPercent: 15, minimumAmount: 10000, maximumBonus: 15000, priority: 2, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5, stackable: true });
    const exclusive = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Exclusive 20", code: "EXCLUSIVE20", bonusPercent: 20, minimumAmount: 10000, maximumBonus: 20000, priority: 1, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5, stackable: false });

    const checkout = await request(app).post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, paymentMethod: "qr", promotionIds: [first.body.data.item._id, second.body.data.item._id] });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({
      bonusAmount: 25000,
      totalCredit: 125000,
      promotionName: "Stack 10",
      promotionCode: "STACK10",
    });
    expect(checkout.body.data.order.promotions).toHaveLength(2);
    expect(checkout.body.data.order.promotions.map((promotion) => promotion.code)).toEqual(["STACK10", "STACK15"]);

    const blocked = await request(app).post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, paymentMethod: "qr", promotionIds: [first.body.data.item._id, exclusive.body.data.item._id] });

    expect(blocked.status).toBe(400);
  });

  it("auto-applies eligible top-up promotions without exposing them as selectable campaigns", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Auto default 2M", code: "AUTO2M", bonusPercent: 5, minimumAmount: 2000000, maximumBonus: 200000, priority: 1, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5, stackable: true, autoApply: true });
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Manual campaign", code: "MANUAL10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 2, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5, stackable: true });

    const promotions = await request(app).get("/api/payments/top-up/promotions")
      .set("Authorization", `Bearer ${userToken}`);

    expect(promotions.status).toBe(200);
    expect(promotions.body.data.items.map((item) => item.code)).toEqual(["MANUAL10"]);
    expect(promotions.body.data.autoItems.map((item) => item.code)).toEqual(["AUTO2M"]);

    const checkout = await request(app).post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 2000000, paymentMethod: "qr" });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({
      bonusAmount: 100000,
      totalCredit: 2100000,
      promotionName: "Auto default 2M",
      promotionCode: "AUTO2M",
      promotionAutoApply: true,
    });
    expect(checkout.body.data.order.promotions).toHaveLength(1);
    expect(checkout.body.data.order.promotions[0]).toMatchObject({
      code: "AUTO2M",
      autoApply: true,
      bonusAmount: 100000,
    });
  });

  it("chooses the best actual bonus among promotions with the same priority", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Same priority 10%", code: "SAME10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, priority: 3, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Same priority 20%", code: "SAME20", bonusPercent: 20, minimumAmount: 10000, maximumBonus: 30000, priority: 3, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 5 });

    const order = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });

    expect(order.body.data.order).toMatchObject({
      bonusAmount: 20000,
      totalCredit: 120000,
      promotionName: "Same priority 20%",
      promotionCode: "SAME20",
      promotionPriority: 3,
    });
  });

  it("keeps a QR promotion snapshot when the promotion is edited before payment", async () => {
    const now = Date.now();
    const promotion = await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Original bonus", code: "SNAP10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });

    const order = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });
    expect(order.body.data.order).toMatchObject({
      bonusAmount: 10000,
      totalCredit: 110000,
      promotionName: "Original bonus",
      promotionCode: "SNAP10",
      promotionBonusPercent: 10,
      promotionMaximumBonus: 10000,
      promotionSnapshotLocked: true,
    });

    const update = await request(app).patch(`/api/admin/payments/promotions/${promotion.body.data.item._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Edited bonus", bonusPercent: 50, maximumBonus: 50000 });
    expect(update.status).toBe(200);

    const webhook = await request(app).post("/api/payments/webhook/sepay").send({
      orderCode: order.body.data.order.orderCode,
      amount: 100000,
      transactionId: "SEPAY-SNAPSHOT-LOCKED",
      status: "paid",
    });
    expect(webhook.status).toBe(200);

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(100000);
    expect(refreshedUser.walletPromotionBalance).toBe(10000);

    const refreshedOrder = await PaymentOrder.findById(order.body.data.order._id);
    expect(refreshedOrder).toMatchObject({
      bonusAmount: 10000,
      totalCredit: 110000,
      promotionName: "Original bonus",
      promotionCode: "SNAP10",
      promotionBonusPercent: 10,
      promotionMaximumBonus: 10000,
      promotionSnapshotLocked: true,
    });
  });

  it("reserves promotion usage only while pending QR top-up orders are valid", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Pending-safe bonus", code: "PENDING10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });

    const reservedOrder = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });
    expect(reservedOrder.body.data.order).toMatchObject({
      amount: 100000,
      bonusAmount: 10000,
      totalCredit: 110000,
    });

    const blockedOrder = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });
    expect(blockedOrder.body.data.order).toMatchObject({
      amount: 100000,
      bonusAmount: 0,
      totalCredit: 100000,
    });

    await PaymentOrder.updateOne(
      { _id: reservedOrder.body.data.order._id },
      { $set: { expiresAt: new Date(now - 1000) } },
    );

    const paidOrder = await request(app).post("/api/payments/topups")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100000, provider: "sepay" });
    expect(paidOrder.body.data.order).toMatchObject({
      amount: 100000,
      bonusAmount: 10000,
      totalCredit: 110000,
    });

    const paidWebhook = await request(app).post("/api/payments/webhook/sepay").send({
      orderCode: paidOrder.body.data.order.orderCode,
      amount: 100000,
      transactionId: "SEPAY-PENDING-SAFE-PAID",
      status: "paid",
    });
    expect(paidWebhook.status).toBe(200);

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(100000);
    expect(refreshedUser.walletPromotionBalance).toBe(10000);
  });

  it("backfills promotion money for paid QR top-ups that were credited without a bonus", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Backfill bonus", code: "BACKFILL10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 10000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });

    const paidAt = new Date();
    const order = await PaymentOrder.create({
      user: user._id,
      packageCode: "wallet_top_up",
      packageName: "Nạp tiền ví WeRent",
      amount: 10000,
      baseAmount: 10000,
      bonusAmount: 0,
      totalCredit: 10000,
      balanceBefore: 15000,
      balanceAfter: 25000,
      transactionType: "topup",
      orderType: "wallet_top_up",
      orderCode: "WRTP-BACKFILL-MISSING-BONUS",
      provider: "sepay",
      status: "paid",
      paidAt,
      confirmedAt: paidAt,
      creditedAt: paidAt,
    });
    await WalletTransaction.create({
      user: user._id,
      type: "top_up",
      direction: "credit",
      amount: 10000,
      realAmount: 10000,
      description: "Nạp tiền vào ví WeRent",
      paymentOrder: order._id,
    });

    const list = await request(app).get("/api/admin/payments/transactions")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "paid", scope: "topup" });

    expect(list.status).toBe(200);
    expect(list.body.data.items[0]).toMatchObject({
      orderCode: "WRTP-BACKFILL-MISSING-BONUS",
      bonusAmount: 1000,
      totalCredit: 11000,
      promotionName: "Backfill bonus",
      balanceBefore: 15000,
      balanceAfter: 26000,
    });

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(10000);
    expect(refreshedUser.walletPromotionBalance).toBe(1000);
    const history = await WalletTransaction.find({ paymentOrder: order._id }).sort({ type: 1 });
    expect(history.map((item) => item.type)).toEqual(["promotion_credit", "top_up"]);
  });

  it("creates a demo top-up, separates real and promotion balances, and records wallet history", async () => {
    const now = Date.now();
    await request(app).post("/api/admin/payments/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Demo bonus 10%", code: "DEMO10", bonusPercent: 10, minimumAmount: 10000, maximumBonus: 50000, startsAt: new Date(now - 60000), endsAt: new Date(now + 60000), perUserLimit: 1 });

    const quote = await request(app).get("/api/admin/payments/demo-topups/quote")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ email: user.email, amount: 500000 });

    expect(quote.status).toBe(200);
    expect(quote.body.data.quote).toMatchObject({
      amount: 500000,
      bonusAmount: 50000,
      totalCredit: 550000,
      promotion: { name: "Demo bonus 10%", code: "DEMO10", bonusPercent: 10 },
    });

    const response = await request(app).post("/api/admin/payments/demo-topups")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: user.email, amount: 500000, note: "Demo nạp tiền Sepay." });

    expect(response.status).toBe(201);
    expect(response.body.data.item).toMatchObject({
      transactionType: "topup",
      orderType: "wallet_top_up",
      packageCode: "ADMIN_DEMO_TOPUP",
      packageName: "Admin nạp tiền demo",
      provider: "admin_demo",
      amount: 500000,
      bonusAmount: 50000,
      totalCredit: 550000,
      balanceBefore: 0,
      balanceAfter: 550000,
      adjustmentReason: "Demo nạp tiền Sepay.",
    });

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.walletBalance).toBe(500000);
    expect(refreshedUser.walletPromotionBalance).toBe(50000);

    const order = await PaymentOrder.findById(response.body.data.item._id);
    const history = await WalletTransaction.find({ paymentOrder: order._id }).sort({ type: 1 });
    expect(history).toHaveLength(2);
    expect(history.map((item) => item.description)).toEqual([
      "Khuyến mãi nạp tiền demo",
      "Admin nạp tiền demo",
    ]);
  });

  it("rejects demo top-up when the target email does not exist", async () => {
    const response = await request(app).post("/api/admin/payments/demo-topups")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "missing@example.com", amount: 100000, bonusAmount: 0 });

    expect(response.status).toBe(404);
  });
});
