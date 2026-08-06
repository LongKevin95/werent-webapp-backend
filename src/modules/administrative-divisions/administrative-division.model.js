import mongoose from "mongoose";

const administrativeWardSchema = new mongoose.Schema(
  {
    code: {
      type: Number,
      required: true,
    },
    codename: {
      type: String,
      required: true,
      trim: true,
    },
    divisionType: {
      type: String,
      required: true,
      trim: true,
    },
    districtCode: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const administrativeDistrictSchema = new mongoose.Schema(
  {
    code: {
      type: Number,
      required: true,
    },
    codename: {
      type: String,
      required: true,
      trim: true,
    },
    divisionType: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provinceCode: {
      type: Number,
      required: true,
    },
    wards: {
      type: [administrativeWardSchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

const administrativeDivisionSchema = new mongoose.Schema(
  {
    code: {
      type: Number,
      required: true,
    },
    codename: {
      type: String,
      required: true,
      trim: true,
    },
    dataVersion: {
      type: String,
      default: "",
      trim: true,
    },
    districts: {
      type: [administrativeDistrictSchema],
      default: [],
    },
    divisionType: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneCode: {
      type: Number,
      default: null,
    },
    source: {
      type: String,
      default: "provinces.open-api.vn",
      trim: true,
    },
    version: {
      type: String,
      default: "v1",
      enum: ["v1"],
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

administrativeDivisionSchema.index({ version: 1, code: 1 }, { unique: true });

const AdministrativeDivision =
  mongoose.models.AdministrativeDivision ||
  mongoose.model("AdministrativeDivision", administrativeDivisionSchema);

export default AdministrativeDivision;
