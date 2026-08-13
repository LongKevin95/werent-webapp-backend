import mongoose from "mongoose";

const WALLET_TRANSACTION_TYPES = [
  "top_up",
  "promotion_credit",
  "spend",
  "promotion_expired",
  "refund",
  "admin_adjustment",
];
const WALLET_TRANSACTION_DIRECTIONS = ["credit", "debit"];

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: WALLET_TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: WALLET_TRANSACTION_DIRECTIONS,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    realAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    promotionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    promotionRemainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    promotionBalanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    paymentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOrder",
      default: null,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index(
  { paymentOrder: 1, type: 1 },
  {
    partialFilterExpression: { paymentOrder: { $type: "objectId" } },
    unique: true,
  },
);

const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", walletTransactionSchema);

export default WalletTransaction;
