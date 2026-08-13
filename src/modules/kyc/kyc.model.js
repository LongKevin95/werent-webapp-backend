import mongoose from "mongoose";
import {
  KYC_STATUS,
  KYC_STATUS_LIST,
  LISTING_VERIFICATION_STATUS,
  LISTING_VERIFICATION_STATUS_LIST,
  VERIFICATION_DOCUMENT_TYPES,
} from "../../common/constants.js";

const uploadedDocumentSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
    mimeType: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const kycRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    identityNumber: { type: String, required: true, trim: true },
    identityIssuedAt: { type: Date, required: true },
    documents: { type: [uploadedDocumentSchema], required: true },
    status: { type: String, enum: KYC_STATUS_LIST, default: KYC_STATUS.PENDING, index: true },
    rejectionReason: { type: String, default: null, trim: true },
    adminNote: { type: String, default: null, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
kycRequestSchema.index({ user: 1, createdAt: -1 });

const listingVerificationRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    documentType: { type: String, enum: VERIFICATION_DOCUMENT_TYPES, required: true },
    documents: { type: [uploadedDocumentSchema], required: true },
    note: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: LISTING_VERIFICATION_STATUS_LIST,
      default: LISTING_VERIFICATION_STATUS.PENDING,
      index: true,
    },
    rejectionReason: { type: String, default: null, trim: true },
    adminNote: { type: String, default: null, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
listingVerificationRequestSchema.index({ property: 1, createdAt: -1 });

export const KYCRequest = mongoose.models.KYCRequest ||
  mongoose.model("KYCRequest", kycRequestSchema);
export const ListingVerificationRequest =
  mongoose.models.ListingVerificationRequest ||
  mongoose.model("ListingVerificationRequest", listingVerificationRequestSchema);
