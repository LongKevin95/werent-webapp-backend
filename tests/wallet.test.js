import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ORDER_STATUS } from "../src/common/constants.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";
process.env.MOMO_MOCK_ENABLED = "true";

const { default: app } = await import("../src/app.js");
const { default: PaymentOrder } = await import(
  "../src/modules/payments/payment.model.js"
);

let mongoServer;

async function registerUser() {
  return request(app).post("/api/auth/register").send({
    fullName: "Wallet Owner",
    email: "wallet-owner@example.com",
    phone: "0901234567",
    password: "Password123!",
  });
}

describe("wallet top-up and spending", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("separates real top-up money, promotion money and spends promotion first", async () => {
    const registerResponse = await registerUser();
    const userId = registerResponse.body.data.user.id;
    const token = registerResponse.body.data.accessToken;

    await PaymentOrder.create({
      user: userId,
      packageCode: "wallet_top_up",
      packageName: "Nạp tiền ví WeRent",
      amount: 10000,
      baseAmount: 10000,
      bonusAmount: 1000,
      totalCredit: 11000,
      transactionType: "topup",
      orderCode: "WRTP-TEST-10000",
      orderType: "wallet_top_up",
      status: ORDER_STATUS.PAID,
      paidAt: new Date(),
    });

    const { default: User } = await import("../src/modules/users/user.model.js");
    await User.updateOne(
      { _id: userId },
      { $set: { kycStatus: "verified", canPostListing: true, verifiedAt: new Date() } },
    );

    const walletResponse = await request(app)
      .get("/api/payments/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(walletResponse.status).toBe(200);
    expect(walletResponse.body.data.summary).toMatchObject({
      availableBalance: 10000,
      promotionBalance: 1000,
      totalDeposited: 10000,
      totalSpent: 0,
    });

    const createListingResponse = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Wallet paid listing",
        propertyType: "Studio",
        address: "15 Nguyen Co Thach",
        price: 7000000,
        package: {
          durationDays: 1,
          durationKey: "1day",
          pricePerDay: 500,
          tier: "standard",
          totalPrice: 500,
        },
      });

    expect(createListingResponse.status).toBe(201);

    const updatedWalletResponse = await request(app)
      .get("/api/payments/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(updatedWalletResponse.body.data.summary).toMatchObject({
      availableBalance: 10000,
      promotionBalance: 500,
      totalDeposited: 10000,
      totalSpent: 500,
    });

    const transactions = updatedWalletResponse.body.data.transactions;
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "top_up",
          balanceAfter: 10000,
          promotionBalanceAfter: 0,
        }),
        expect.objectContaining({
          type: "promotion_credit",
          balanceAfter: 10000,
          promotionBalanceAfter: 1000,
        }),
        expect.objectContaining({
          type: "spend",
          balanceAfter: 10000,
          promotionBalanceAfter: 500,
        }),
      ]),
    );
  });

  it("confirms a MoMo mock top-up exactly once", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const checkoutResponse = await request(app)
      .post("/api/payments/top-up/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "http://localhost:5173")
      .send({ amount: 100000, paymentMethod: "momo" });

    expect(checkoutResponse.status).toBe(201);
    expect(checkoutResponse.body.data.checkout).toMatchObject({
      method: "MOMO_MOCK",
    });
    expect(checkoutResponse.body.data.checkout.redirectUrl).toContain(
      "/wallet/top-up/momo-mock",
    );

    const orderCode = checkoutResponse.body.data.order.orderCode;
    const confirm = () =>
      request(app)
        .post("/api/payments/top-up/momo-mock/confirm")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderCode });

    const firstConfirmation = await confirm();
    const repeatedConfirmation = await confirm();
    expect(firstConfirmation.status).toBe(200);
    expect(repeatedConfirmation.status).toBe(200);

    const walletResponse = await request(app)
      .get("/api/payments/wallet")
      .set("Authorization", `Bearer ${token}`);
    expect(walletResponse.body.data.summary).toMatchObject({
      availableBalance: 100000,
      totalDeposited: 100000,
    });

    const order = await PaymentOrder.findOne({ orderCode });
    expect(order.status).toBe(ORDER_STATUS.PAID);
    expect(order.provider).toBe("momo_mock");
    expect(order.creditedAt).toBeTruthy();
  });
});
