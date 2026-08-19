import {
  KYC_STATUS,
  LISTING_VERIFICATION_STATUS,
  ORDER_STATUS,
  PROPERTY_STATUS,
} from "../../common/constants.js";
import env from "../../config/env.js";
import { novu } from "../../config/novu.js";

function splitFullName(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

function formatCurrency(amount) {
  return `${Number(amount ?? 0).toLocaleString("vi-VN")}đ`;
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue).toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getAppBaseUrl() {
  return (
    normalizeBaseUrl(env.APP_BASE_URL) ||
    normalizeBaseUrl(env.CORS_ORIGIN?.split(",")[0]) ||
    "http://localhost:5173"
  );
}

function buildAppUrl(pathname = "/") {
  return new URL(pathname, `${getAppBaseUrl()}/`).toString();
}

function buildNotificationPayload(user, payload, content, options = {}) {
  const appUrl = getAppBaseUrl();

  return {
    ...payload,
    subject: content.subject,
    body: content.body,
    previewText: options.previewText ?? content.subject,
    recipientName: user.fullName ?? "bạn",
    email: user.email ?? null,
    appName: "WeRent",
    appUrl,
    ctaLabel: options.ctaLabel ?? "Mở WeRent",
    ctaUrl: options.ctaUrl ?? appUrl,
  };
}

function mapSubscriber(user) {
  return {
    subscriberId: user._id.toString(),
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    ...splitFullName(user.fullName),
  };
}

async function triggerNotification(workflowId, user, payload, errorLabel) {
  if (!novu) {
    return null;
  }

  try {
    return await novu.trigger({
      workflowId,
      to: mapSubscriber(user),
      payload,
    });
  } catch (error) {
    console.error(errorLabel, error);
    return null;
  }
}

function buildWelcomeNotification(user) {
  return {
    subject: "Chào mừng bạn đến với WeRent",
    body: `${user.fullName ?? "Bạn"} đã tạo tài khoản thành công trên WeRent. Bây giờ bạn có thể khám phá chỗ ở, quản lý lịch hẹn và sử dụng ví tiền ngay trong ứng dụng.`,
  };
}

function buildListingStatusNotification(property) {
  if (property.status === PROPERTY_STATUS.ACTIVE) {
    return {
      subject: "Tin đăng đã được duyệt",
      body: `Tin đăng \"${property.title}\" đã được duyệt và đang hiển thị trên WeRent.`,
    };
  }

  if (property.status === PROPERTY_STATUS.REJECTED) {
    return {
      subject: "Tin đăng bị từ chối",
      body: `Tin đăng \"${property.title}\" đã bị từ chối. Lý do: ${property.rejectionReason ?? property.moderationReason ?? "Không có"}`,
    };
  }

  return {
    subject: "Tin đăng bị ẩn",
    body: `Tin đăng \"${property.title}\" đã bị ẩn. Lý do: ${property.moderationReason ?? "Không có"}`,
  };
}

function buildAccountKycNotification(item) {
  if (item.status === KYC_STATUS.VERIFIED) {
    return {
      subject: "Tài khoản đã được xác thực",
      body: "Hồ sơ KYC của bạn đã được duyệt. Bạn có thể đăng tin trên WeRent.",
    };
  }

  return {
    subject: "Hồ sơ KYC bị từ chối",
    body: `Hồ sơ KYC của bạn đã bị từ chối. Lý do: ${item.rejectionReason ?? item.adminNote ?? "Không có"}`,
  };
}

function buildListingVerificationNotification(property, item) {
  if (item.status === LISTING_VERIFICATION_STATUS.VERIFIED_OWNER) {
    return {
      subject: "Tin đăng đã được xác thực chính chủ",
      body: `Tin đăng "${property.title}" đã được xác thực chính chủ và nhận badge Xác thực trên WeRent.`,
    };
  }

  if (item.status === LISTING_VERIFICATION_STATUS.VERIFIED_AUTHORIZED) {
    return {
      subject: "Tin đăng đã được xác thực ủy quyền",
      body: `Tin đăng "${property.title}" đã được xác thực theo giấy tờ ủy quyền và nhận badge Xác thực trên WeRent.`,
    };
  }

  if (item.status === LISTING_VERIFICATION_STATUS.NEED_MORE_INFO) {
    return {
      subject: "Hồ sơ xác thực tin đăng cần bổ sung",
      body: `Hồ sơ xác thực của tin đăng "${property.title}" cần được bổ sung. Lý do: ${item.rejectionReason ?? item.adminNote ?? "Không có"}`,
    };
  }

  return {
    subject: "Hồ sơ xác thực tin đăng bị từ chối",
    body: `Hồ sơ xác thực của tin đăng "${property.title}" đã bị từ chối. Lý do: ${item.rejectionReason ?? item.adminNote ?? "Không có"}`,
  };
}

function buildTopUpSuccessNotification(order) {
  const baseAmount = Number(order.amount ?? 0);
  const bonusAmount = Math.max(Number(order.bonusAmount ?? 0), 0);
  const totalCredit = Number(order.totalCredit || baseAmount + bonusAmount);

  if (bonusAmount > 0) {
    return {
      subject: "Nạp tiền ví thành công",
      body: `Bạn đã nạp thành công ${formatCurrency(baseAmount)} vào ví WeRent và nhận thêm ${formatCurrency(bonusAmount)} ưu đãi. Tổng cộng ${formatCurrency(totalCredit)} đã được cộng vào tài khoản của bạn.`,
    };
  }

  return {
    subject: "Nạp tiền ví thành công",
    body: `Bạn đã nạp thành công ${formatCurrency(baseAmount)} vào ví WeRent. Số dư đã được cập nhật trên tài khoản của bạn.`,
  };
}

function buildTopUpFailedNotification(order) {
  const baseAmount = Number(order.amount ?? 0);

  if (order.status === ORDER_STATUS.CANCELED) {
    return {
      subject: "Giao dịch nạp tiền đã bị hủy",
      body: `Yêu cầu nạp ${formatCurrency(baseAmount)} vào ví WeRent đã bị hủy. Bạn có thể tạo lại giao dịch mới bất cứ lúc nào.`,
    };
  }

  return {
    subject: "Nạp tiền ví không thành công",
    body: `Yêu cầu nạp ${formatCurrency(baseAmount)} vào ví WeRent không thành công. Vui lòng thử lại hoặc kiểm tra với ngân hàng/cổng thanh toán nếu cần.`,
  };
}

function buildAdminWalletAdjustmentNotification(order, direction) {
  const amount = Math.abs(Number(order.amount ?? 0));
  const balanceAfter = Number(order.balanceAfter ?? 0);
  const reason = order.adjustmentReason ?? "Không có";

  if (direction === "credit") {
    return {
      subject: "Ví tiền vừa được cộng thêm số dư",
      body: `Quản trị viên đã cộng ${formatCurrency(amount)} vào ví WeRent của bạn. Lý do: ${reason} Số dư hiện tại: ${formatCurrency(balanceAfter)}.`,
    };
  }

  return {
    subject: "Ví tiền vừa được điều chỉnh giảm",
    body: `Quản trị viên đã điều chỉnh giảm ${formatCurrency(amount)} khỏi ví WeRent của bạn. Lý do: ${reason} Số dư hiện tại: ${formatCurrency(balanceAfter)}.`,
  };
}

export function sendWelcomeNotification(user) {
  const content = buildWelcomeNotification(user);

  return triggerNotification(
    env.NOVU_WELCOME_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        userId: user._id.toString(),
        fullName: user.fullName,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      content,
      {
        previewText: "Tài khoản WeRent của bạn đã sẵn sàng để sử dụng.",
        ctaLabel: "Khám phá WeRent",
        ctaUrl: buildAppUrl("/"),
      },
    ),
    "Novu welcome notification failed:",
  );
}

export function sendListingStatusNotification(property) {
  const owner = property.owner;

  if (!owner?._id) {
    return null;
  }

  const content = buildListingStatusNotification(property);

  return triggerNotification(
    env.NOVU_LISTING_STATUS_WORKFLOW_ID,
    owner,
    buildNotificationPayload(
      owner,
      {
        propertyId: property._id.toString(),
        propertyTitle: property.title,
        status: property.status,
        moderationReason: property.moderationReason ?? null,
        rejectionReason: property.rejectionReason ?? null,
      },
      content,
      {
        ctaLabel: "Mở WeRent",
        ctaUrl: buildAppUrl("/"),
      },
    ),
    "Novu listing status notification failed:",
  );
}

export function sendAccountKycReviewNotification(user, item) {
  if (!user?._id) {
    return null;
  }

  const content = buildAccountKycNotification(item);

  return triggerNotification(
    env.NOVU_ACCOUNT_KYC_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        requestId: item._id.toString(),
        status: item.status,
        reason: item.rejectionReason ?? null,
        adminNote: item.adminNote ?? null,
      },
      content,
      {
        ctaLabel:
          item.status === KYC_STATUS.VERIFIED ? "Mở WeRent" : "Xem hồ sơ",
        ctaUrl: buildAppUrl("/"),
      },
    ),
    "Novu account KYC notification failed:",
  );
}

export function sendListingVerificationReviewNotification(
  user,
  property,
  item,
) {
  if (!user?._id || !property?._id) {
    return null;
  }

  const content = buildListingVerificationNotification(property, item);

  return triggerNotification(
    env.NOVU_LISTING_VERIFICATION_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        requestId: item._id.toString(),
        propertyId: property._id.toString(),
        propertyTitle: property.title,
        status: item.status,
        reason: item.rejectionReason ?? null,
        adminNote: item.adminNote ?? null,
      },
      content,
      {
        ctaLabel: "Mở WeRent",
        ctaUrl: buildAppUrl("/"),
      },
    ),
    "Novu listing verification notification failed:",
  );
}

export function sendTopUpSuccessNotification(user, order) {
  if (!user?._id || !order?._id) {
    return null;
  }

  const content = buildTopUpSuccessNotification(order);

  return triggerNotification(
    env.NOVU_TOPUP_SUCCESS_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        amount: Number(order.amount ?? 0),
        bonusAmount: Number(order.bonusAmount ?? 0),
        totalCredit: Number(order.totalCredit ?? order.amount ?? 0),
        balanceAfter: Number(order.balanceAfter ?? 0),
      },
      content,
      {
        ctaLabel: "Mở ví tiền",
        ctaUrl: buildAppUrl("/wallet"),
      },
    ),
    "Novu top-up success notification failed:",
  );
}

export function sendTopUpFailedNotification(user, order) {
  if (!user?._id || !order?._id) {
    return null;
  }

  const content = buildTopUpFailedNotification(order);

  return triggerNotification(
    env.NOVU_TOPUP_FAILED_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        amount: Number(order.amount ?? 0),
        status: order.status,
        provider: order.provider ?? null,
      },
      content,
      {
        ctaLabel: "Mở ví tiền",
        ctaUrl: buildAppUrl("/wallet"),
      },
    ),
    "Novu top-up failed notification failed:",
  );
}

export function sendAdminWalletAdjustmentNotification(user, order, direction) {
  if (!user?._id || !order?._id) {
    return null;
  }

  const content = buildAdminWalletAdjustmentNotification(order, direction);

  return triggerNotification(
    env.NOVU_ADMIN_WALLET_ADJUSTMENT_WORKFLOW_ID,
    user,
    buildNotificationPayload(
      user,
      {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        amount: Math.abs(Number(order.amount ?? 0)),
        direction,
        reason: order.adjustmentReason ?? null,
        balanceBefore: Number(order.balanceBefore ?? 0),
        balanceAfter: Number(order.balanceAfter ?? 0),
      },
      content,
      {
        ctaLabel: "Mở ví tiền",
        ctaUrl: buildAppUrl("/wallet"),
      },
    ),
    "Novu admin wallet adjustment notification failed:",
  );
}
