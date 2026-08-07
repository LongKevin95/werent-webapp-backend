import mongoose from "mongoose";
import {
  PROPERTY_PACKAGE_TIER,
  PROPERTY_PACKAGE_TIER_LIST,
  PROPERTY_STATUS,
  PROPERTY_STATUS_LIST,
} from "../../common/constants.js";

const propertyImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const propertyCoordinatesSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const propertyPackageSchema = new mongoose.Schema(
  {
    tier: {
      type: String,
      enum: PROPERTY_PACKAGE_TIER_LIST,
      default: PROPERTY_PACKAGE_TIER.STANDARD,
    },
    durationKey: {
      type: String,
      default: "custom",
      trim: true,
    },
    durationDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    pricePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const propertyMetricsSchema = new mongoose.Schema(
  {
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    contactCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    appointmentCount: {
      type: Number,
      default: 0,
      min: 0,
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
    propertyType: {
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
    city: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    ward: {
      type: String,
      default: "",
      trim: true,
    },
    street: {
      type: String,
      default: "",
      trim: true,
    },
    addressLine: {
      type: String,
      default: "",
      trim: true,
    },
    projectName: {
      type: String,
      default: "",
      trim: true,
    },
    locationNote: {
      type: String,
      default: "",
      trim: true,
    },
    formattedAddress: {
      type: String,
      default: "",
      trim: true,
    },
    placeId: {
      type: String,
      default: null,
      trim: true,
    },
    mapProvider: {
      type: String,
      default: "",
      trim: true,
    },
    isPinAdjusted: {
      type: Boolean,
      default: false,
    },
    addressComponents: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    coordinates: {
      type: propertyCoordinatesSchema,
      default: () => ({ lat: null, lng: null }),
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      default: 0,
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
    furnishing: {
      type: String,
      default: "",
      trim: true,
    },
    orientation: {
      type: String,
      default: "",
      trim: true,
    },
    floor: {
      type: String,
      default: "",
      trim: true,
    },
    totalFloors: {
      type: Number,
      default: 0,
      min: 0,
    },
    frontage: {
      type: Number,
      default: 0,
      min: 0,
    },
    accessRoad: {
      type: Number,
      default: 0,
      min: 0,
    },
    moveInDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    waterPrice: {
      type: String,
      default: "",
      trim: true,
    },
    electricityPrice: {
      type: String,
      default: "",
      trim: true,
    },
    internetPrice: {
      type: String,
      default: "",
      trim: true,
    },
    availableFrom: {
      type: Date,
      default: null,
    },
    minimumStayMonths: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxOccupants: {
      type: Number,
      default: 0,
      min: 0,
    },
    amenities: {
      type: [String],
      default: [],
    },
    nearbyPlaces: {
      type: [String],
      default: [],
    },
    houseRules: {
      type: [String],
      default: [],
    },
    package: {
      type: propertyPackageSchema,
      default: () => ({}),
    },
    images: {
      type: [propertyImageSchema],
      default: [],
    },
    videoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    contactName: {
      type: String,
      default: "",
      trim: true,
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: PROPERTY_STATUS_LIST,
      default: PROPERTY_STATUS.ACTIVE,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    metrics: {
      type: propertyMetricsSchema,
      default: () => ({}),
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    moderationReason: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

propertySchema.index({ status: 1, createdAt: -1 });
propertySchema.index({ owner: 1, status: 1 });
propertySchema.index({ "package.tier": 1, status: 1, createdAt: -1 });

const Property =
  mongoose.models.Property || mongoose.model("Property", propertySchema);

export default Property;
