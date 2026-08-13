import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  KYC_STATUS,
  KYC_STATUS_LIST,
  ROLE_LIST,
  ROLES,
} from "../../common/constants.js";
import { normalizeVietnamPhone } from "../../common/phone.js";

function normalizeEmail(email) {
  if (typeof email !== "string") {
    return undefined;
  }

  const trimmedEmail = email.trim().toLowerCase();
  return trimmedEmail.length > 0 ? trimmedEmail : undefined;
}

function normalizePhone(phone) {
  return normalizeVietnamPhone(phone);
}

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },
    roles: {
      type: [String],
      enum: ROLE_LIST,
      default: [ROLES.USER],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one role is required",
      },
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletPromotionBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    dateOfBirth: { type: Date, default: null },
    address: { type: String, default: "", trim: true },
    identityNumber: { type: String, default: "", trim: true },
    identityIssuedAt: { type: Date, default: null },
    kycStatus: {
      type: String,
      enum: KYC_STATUS_LIST,
      default: KYC_STATUS.UNVERIFIED,
      index: true,
    },
    canPostListing: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre("validate", function normalizeFields() {
  if (this.email) {
    this.email = normalizeEmail(this.email);
  }

  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }

  if (!this.roles || this.roles.length === 0) {
    this.roles = [ROLES.USER];
  }
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.hasRole = function hasRole(role) {
  return this.roles.includes(role);
};

userSchema.statics.findByLoginIdentifier = function findByLoginIdentifier(
  identifier,
) {
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);

  if (!normalizedEmail && !normalizedPhone) {
    return this.findOne({ _id: null });
  }

  const query = [];

  if (normalizedEmail) {
    query.push({ email: normalizedEmail });
  }

  if (normalizedPhone) {
    query.push({ phone: normalizedPhone });
  }

  return this.findOne({ $or: query }).select("+passwordHash");
};

userSchema.statics.normalizeEmail = normalizeEmail;
userSchema.statics.normalizePhone = normalizePhone;

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
