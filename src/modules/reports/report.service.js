import Report from "./report.model.js";

export async function createReport(reporterId, payload) {
  return Report.create({
    property: payload.propertyId,
    reporter: reporterId,
    reason: payload.reason,
    details: payload.details ?? "",
  });
}

export async function listReports() {
  return Report.find()
    .populate("property")
    .populate("reporter", "fullName email phone roles")
    .sort({ createdAt: -1 });
}
