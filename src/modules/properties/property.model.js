import mongoose from "mongoose";
import { PROPERTY_STATUS, PROPERTY_STATUS_LIST } from "../../common/constants.js";

const propertyImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    area: {
      type: Number,
      default: 0,
      min: 0,
    },
    bedrooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    bathrooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: {
      type: [propertyImageSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PROPERTY_STATUS_LIST,
      default: PROPERTY_STATUS.DRAFT,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    approvedBy: {
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

propertySchema.index({ status: 1, createdAt: -1 });
propertySchema.index({ owner: 1, status: 1 });

const Property =
  mongoose.models.Property || mongoose.model("Property", propertySchema);

export default Property;
