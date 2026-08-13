import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "payment-test-secret";
process.env.SEPAY_WEBHOOK_SECRET = "";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: User } = await import("../src/modules/users/user.model.js");

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
});
