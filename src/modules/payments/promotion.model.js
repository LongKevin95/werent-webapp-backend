import mongoose from "mongoose";

const topupPromotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    bonusPercent: { type: Number, required: true, min: 0, max: 100 },
    minimumAmount: { type: Number, default: 0, min: 0 },
    maximumBonus: { type: Number, default: null, min: 0 },
    priority: { type: Number, default: 0, min: 0, index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    perUserLimit: { type: Number, default: 1, min: 1 },
    stackable: { type: Boolean, default: false },
    autoApply: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.models.TopupPromotion ||
  mongoose.model("TopupPromotion", topupPromotionSchema);
