import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import ApiError from "../../common/ApiError.js";
import { PROPERTY_STATUS_LIST } from "../../common/constants.js";
import { serializeUser } from "../auth/auth.service.js";
import PaymentOrder from "../payments/payment.model.js";
import Property from "../properties/property.model.js";
import Report from "../reports/report.model.js";
import User from "../users/user.model.js";

export async function getDashboardSummary() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [
    totalUsers,
    activeUsers,
    adminUsers,
    newUsersThisMonth,
    totalProperties,
    totalPayments,
    totalReports,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ roles: "admin" }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Property.countDocuments(),
    PaymentOrder.countDocuments(),
    Report.countDocuments(),
  ]);

  return {
    totalUsers,
    activeUsers,
    adminUsers,
    newUsersThisMonth,
    totalProperties,
    totalPayments,
    totalReports,
  };
}

function assertValidUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureUniqueContact({ email, phone, excludeUserId }) {
  const normalizedEmail = User.normalizeEmail(email);
  const normalizedPhone = User.normalizePhone(phone);
  const conditions = [];

  if (normalizedEmail) {
    conditions.push({ email: normalizedEmail });
  }

  if (normalizedPhone) {
    conditions.push({ phone: normalizedPhone });
  }

  if (conditions.length === 0) {
    return;
  }

  const duplicate = await User.findOne({
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    $or: conditions,
  });

  if (!duplicate) {
    return;
  }

  if (normalizedEmail && duplicate.email === normalizedEmail) {
    throw new ApiError(409, "Email đã được sử dụng.");
  }

  throw new ApiError(409, "Số điện thoại đã được sử dụng.");
}

export async function listUsers(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
  }

  if (["admin", "user"].includes(query.role)) {
    filter.roles = query.role;
  }

  if (query.status === "active") {
    filter.isActive = true;
  } else if (query.status === "inactive") {
    filter.isActive = false;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: users.map(serializeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function listPropertiesForAdmin(query = {}) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";

  if (query.status) filter.status = query.status;
  if (query.propertyType) filter.propertyType = query.propertyType;
  if (query.city) filter.city = query.city;

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = query.dateFrom;
    if (query.dateTo) {
      const endOfDay = new Date(query.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endOfDay;
    }
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    const owners = await User.find({
      $or: [{ fullName: pattern }, { email: pattern }, { phone: pattern }],
    }).select("_id");

    filter.$or = [
      { title: pattern },
      { description: pattern },
      { address: pattern },
      { projectName: pattern },
      { owner: { $in: owners.map((owner) => owner._id) } },
    ];
  }

  const [items, total, statusCountEntries, propertyTypes, cities] =
    await Promise.all([
      Property.find(filter)
        .populate("owner", "fullName email phone avatarUrl roles")
        .populate("reviewedBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Property.countDocuments(filter),
      Promise.all(
        PROPERTY_STATUS_LIST.map(async (status) => [
          status,
          await Property.countDocuments({ status }),
        ]),
      ),
      Property.distinct("propertyType"),
      Property.distinct("city"),
    ]);

  const statusCounts = Object.fromEntries(statusCountEntries);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    statusCounts: {
      all: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      ...statusCounts,
    },
    filters: {
      propertyTypes: propertyTypes.filter(Boolean).sort(),
      cities: cities.filter(Boolean).sort(),
    },
  };
}

export async function getUserById(userId) {
  assertValidUserId(userId);
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  return serializeUser(user);
}

export async function createUser(payload) {
  const email = User.normalizeEmail(payload.email);
  const phone = User.normalizePhone(payload.phone);

  if (!email && !phone) {
    throw new ApiError(400, "Cần cung cấp email hoặc số điện thoại.");
  }

  await ensureUniqueContact({ email, phone });
  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await User.create({
    fullName: payload.fullName.trim(),
    email,
    phone,
    passwordHash,
    roles: payload.roles,
    isActive: payload.isActive,
  });

  return serializeUser(user);
}

export async function updateUser(userId, actorId, payload) {
  assertValidUserId(userId);
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  const isSelf = user._id.equals(actorId);
  if (isSelf && payload.isActive === false) {
    throw new ApiError(400, "Bạn không thể tự khóa tài khoản quản trị của mình.");
  }

  if (isSelf && payload.roles && !payload.roles.includes("admin")) {
    throw new ApiError(400, "Bạn không thể tự gỡ quyền quản trị của mình.");
  }

  const email =
    payload.email !== undefined ? User.normalizeEmail(payload.email) : user.email;
  const phone =
    payload.phone !== undefined ? User.normalizePhone(payload.phone) : user.phone;

  if (!email && !phone) {
    throw new ApiError(400, "Tài khoản phải có ít nhất một email hoặc số điện thoại.");
  }

  await ensureUniqueContact({ email, phone, excludeUserId: userId });

  const identityChanged =
    user.kycStatus === "verified" &&
    ((payload.fullName !== undefined && payload.fullName.trim() !== user.fullName) ||
      (payload.email !== undefined && email !== user.email) ||
      (payload.phone !== undefined && phone !== user.phone));

  if (payload.fullName !== undefined) user.fullName = payload.fullName.trim();
  if (payload.email !== undefined) user.email = email;
  if (payload.phone !== undefined) user.phone = phone;
  if (payload.roles !== undefined) user.roles = payload.roles;
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  if (payload.password !== undefined) {
    user.passwordHash = await bcrypt.hash(payload.password, 10);
  }
  if (identityChanged) {
    user.kycStatus = "unverified";
    user.canPostListing = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
  }

  await user.save();
  return serializeUser(user);
}

export async function deleteUser(userId, actorId) {
  assertValidUserId(userId);

  if (String(userId) === String(actorId)) {
    throw new ApiError(400, "Bạn không thể tự xóa tài khoản quản trị của mình.");
  }

  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  return serializeUser(user);
}
