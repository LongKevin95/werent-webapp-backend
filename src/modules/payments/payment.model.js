import mongoose from "mongoose";
import { ORDER_STATUS, ORDER_STATUS_LIST } from "../../common/constants.js";

const paymentOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    packageCode: { type: String, required: true, trim: true },
    packageName: { type: String, required: true, trim: true },
    transactionType: {
      type: String,
      enum: ["topup", "package_payment", "promotion_bonus", "admin_adjustment", "refund"],
      default: "topup",
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    baseAmount: { type: Number, default: 0, min: 0 },
    bonusAmount: { type: Number, default: 0, min: 0 },
    totalCredit: { type: Number, default: 0 },
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    orderType: {
      type: String,
      enum: ["package", "wallet_top_up", "admin_adjustment"],
      default: "package",
      index: true,
    },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    paymentMethod: { type: String, default: "BANK_TRANSFER", trim: true },
    orderCode: { type: String, required: true, unique: true, index: true },
    provider: { type: String, default: "sepay", trim: true },
    providerTransactionId: { type: String, default: null },
    providerOrderId: { type: String, default: null },
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: "TopupPromotion", default: null },
    promotionName: { type: String, default: null, trim: true },
    adminActor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    adjustmentReason: { type: String, default: null, trim: true },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    status: { type: String, enum: ORDER_STATUS_LIST, default: ORDER_STATUS.PENDING, index: true },
    rawWebhookPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false },
);

paymentOrderSchema.index(
  { providerTransactionId: 1 },
  { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string" } } },
);

const PaymentOrder = mongoose.models.PaymentOrder || mongoose.model("PaymentOrder", paymentOrderSchema);

export default PaymentOrder;
