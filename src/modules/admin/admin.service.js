import PaymentOrder from "../payments/payment.model.js";
import Property from "../properties/property.model.js";
import Report from "../reports/report.model.js";
import User from "../users/user.model.js";

export async function getDashboardSummary() {
  const [totalUsers, totalProperties, totalPayments, totalReports] = await Promise.all([
    User.countDocuments(),
    Property.countDocuments(),
    PaymentOrder.countDocuments(),
    Report.countDocuments(),
  ]);

  return {
    totalUsers,
    totalProperties,
    totalPayments,
    totalReports,
  };
}

export async function listUsers() {
  return User.find().sort({ createdAt: -1 });
}
