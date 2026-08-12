import mongoose from "mongoose";
import { ORDER_STATUS, ORDER_STATUS_LIST } from "../../common/constants.js";

const paymentOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageCode: {
      type: String,
      required: true,
      trim: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderType: {
      type: String,
      enum: ["package", "wallet_top_up"],
      default: "package",
      index: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    paymentMethod: {
      type: String,
      default: "BANK_TRANSFER",
      trim: true,
    },
    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      default: "sepay",
      trim: true,
    },
    providerTransactionId: {
      type: String,
      default: null,
    },
    providerOrderId: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_LIST,
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    rawWebhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const PaymentOrder =
  mongoose.models.PaymentOrder || mongoose.model("PaymentOrder", paymentOrderSchema);

export default PaymentOrder;
