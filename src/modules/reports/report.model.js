import mongoose from "mongoose";
import { REPORT_STATUS, REPORT_STATUS_LIST } from "../../common/constants.js";

const reportSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: REPORT_STATUS_LIST,
      default: REPORT_STATUS.PENDING,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);

export default Report;
