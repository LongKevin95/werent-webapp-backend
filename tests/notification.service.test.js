import { beforeEach, describe, expect, it, vi } from "vitest";

const novuMocks = vi.hoisted(() => ({
  novu: {
    trigger: vi.fn(),
  },
}));

vi.mock("../src/config/novu.js", () => novuMocks);

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";
process.env.APP_BASE_URL = "https://app.werent.vn";
process.env.NOVU_WELCOME_WORKFLOW_ID = "welcome-new-account";
process.env.NOVU_LISTING_STATUS_WORKFLOW_ID = "listing-status-updated";
process.env.NOVU_ACCOUNT_KYC_WORKFLOW_ID = "account-kyc-reviewed";
process.env.NOVU_LISTING_VERIFICATION_WORKFLOW_ID =
  "listing-verification-reviewed";
process.env.NOVU_TOPUP_SUCCESS_WORKFLOW_ID = "wallet-top-up-success";
process.env.NOVU_TOPUP_FAILED_WORKFLOW_ID = "wallet-top-up-failed";
process.env.NOVU_ADMIN_WALLET_ADJUSTMENT_WORKFLOW_ID =
  "wallet-admin-adjustment";

const {
  sendAccountKycReviewNotification,
  sendAdminWalletAdjustmentNotification,
  sendListingStatusNotification,
  sendListingVerificationReviewNotification,
  sendTopUpFailedNotification,
  sendTopUpSuccessNotification,
  sendWelcomeNotification,
} = await import("../src/modules/notifications/notification.service.js");

describe("notification service", () => {
  beforeEach(() => {
    novuMocks.novu.trigger
      .mockReset()
      .mockResolvedValue({ acknowledged: true });
  });

  it("triggers Novu with the registered user as subscriber", async () => {
    await sendWelcomeNotification({
      _id: {
        toString() {
          return "welcome-user-001";
        },
      },
      fullName: "Nguyễn Văn Test",
      email: "test@example.com",
      phone: "0901234567",
    });

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "welcome-new-account",
      to: {
        subscriberId: "welcome-user-001",
        email: "test@example.com",
        phone: "0901234567",
        firstName: "Nguyễn",
        lastName: "Văn Test",
      },
      payload: {
        userId: "welcome-user-001",
        fullName: "Nguyễn Văn Test",
        email: "test@example.com",
        phone: "0901234567",
        subject: "Chào mừng bạn đến với WeRent",
        body: "Nguyễn Văn Test đã tạo tài khoản thành công trên WeRent. Bây giờ bạn có thể khám phá chỗ ở, quản lý lịch hẹn và sử dụng ví tiền ngay trong ứng dụng.",
        previewText: "Tài khoản WeRent của bạn đã sẵn sàng để sử dụng.",
        recipientName: "Nguyễn Văn Test",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Khám phá WeRent",
        ctaUrl: "https://app.werent.vn/",
      },
    });
  });

  it("triggers Novu with listing moderation content for the property owner", async () => {
    await sendListingStatusNotification({
      _id: {
        toString() {
          return "listing-001";
        },
      },
      title: "Căn hộ kiểm duyệt",
      status: "rejected",
      moderationReason: "Thiếu thông tin pháp lý.",
      rejectionReason: "Thiếu thông tin pháp lý.",
      owner: {
        _id: {
          toString() {
            return "owner-001";
          },
        },
        fullName: "Nguyễn Chủ Nhà",
        email: "owner@example.com",
        phone: "0901234567",
      },
    });

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "listing-status-updated",
      to: {
        subscriberId: "owner-001",
        email: "owner@example.com",
        phone: "0901234567",
        firstName: "Nguyễn",
        lastName: "Chủ Nhà",
      },
      payload: {
        propertyId: "listing-001",
        propertyTitle: "Căn hộ kiểm duyệt",
        status: "rejected",
        moderationReason: "Thiếu thông tin pháp lý.",
        rejectionReason: "Thiếu thông tin pháp lý.",
        subject: "Tin đăng bị từ chối",
        body: 'Tin đăng "Căn hộ kiểm duyệt" đã bị từ chối. Lý do: Thiếu thông tin pháp lý.',
        previewText: "Tin đăng bị từ chối",
        recipientName: "Nguyễn Chủ Nhà",
        email: "owner@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Mở WeRent",
        ctaUrl: "https://app.werent.vn/",
      },
    });
  });

  it("triggers Novu with account KYC rejection content for the user", async () => {
    await sendAccountKycReviewNotification(
      {
        _id: {
          toString() {
            return "kyc-user-001";
          },
        },
        fullName: "Nguyễn Người Dùng",
        email: "kyc-user@example.com",
        phone: "0901234567",
      },
      {
        _id: {
          toString() {
            return "kyc-request-001";
          },
        },
        status: "rejected",
        rejectionReason: "Thiếu ảnh selfie rõ mặt.",
        adminNote: "Vui lòng chụp ảnh sáng hơn.",
      },
    );

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "account-kyc-reviewed",
      to: {
        subscriberId: "kyc-user-001",
        email: "kyc-user@example.com",
        phone: "0901234567",
        firstName: "Nguyễn",
        lastName: "Người Dùng",
      },
      payload: {
        requestId: "kyc-request-001",
        status: "rejected",
        reason: "Thiếu ảnh selfie rõ mặt.",
        adminNote: "Vui lòng chụp ảnh sáng hơn.",
        subject: "Hồ sơ KYC bị từ chối",
        body: "Hồ sơ KYC của bạn đã bị từ chối. Lý do: Thiếu ảnh selfie rõ mặt.",
        previewText: "Hồ sơ KYC bị từ chối",
        recipientName: "Nguyễn Người Dùng",
        email: "kyc-user@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Xem hồ sơ",
        ctaUrl: "https://app.werent.vn/",
      },
    });
  });

  it("triggers Novu with listing verification review content for the user", async () => {
    await sendListingVerificationReviewNotification(
      {
        _id: {
          toString() {
            return "listing-user-001";
          },
        },
        fullName: "Nguyễn Chủ Nhà",
        email: "listing-user@example.com",
        phone: "0901234567",
      },
      {
        _id: {
          toString() {
            return "property-001";
          },
        },
        title: "Căn hộ xác thực",
      },
      {
        _id: {
          toString() {
            return "verification-request-001";
          },
        },
        status: "need_more_info",
        rejectionReason: "Thiếu ảnh sổ hồng rõ nét.",
        adminNote: "Vui lòng tải lại ảnh đủ 4 góc.",
      },
    );

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "listing-verification-reviewed",
      to: {
        subscriberId: "listing-user-001",
        email: "listing-user@example.com",
        phone: "0901234567",
        firstName: "Nguyễn",
        lastName: "Chủ Nhà",
      },
      payload: {
        requestId: "verification-request-001",
        propertyId: "property-001",
        propertyTitle: "Căn hộ xác thực",
        status: "need_more_info",
        reason: "Thiếu ảnh sổ hồng rõ nét.",
        adminNote: "Vui lòng tải lại ảnh đủ 4 góc.",
        subject: "Hồ sơ xác thực tin đăng cần bổ sung",
        body: 'Hồ sơ xác thực của tin đăng "Căn hộ xác thực" cần được bổ sung. Lý do: Thiếu ảnh sổ hồng rõ nét.',
        previewText: "Hồ sơ xác thực tin đăng cần bổ sung",
        recipientName: "Nguyễn Chủ Nhà",
        email: "listing-user@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Mở WeRent",
        ctaUrl: "https://app.werent.vn/",
      },
    });
  });

  it("triggers Novu with top-up success content for the user", async () => {
    await sendTopUpSuccessNotification(
      {
        _id: {
          toString() {
            return "wallet-user-001";
          },
        },
        fullName: "Nguyễn Nạp Tiền",
        email: "wallet-user@example.com",
        phone: "0901234567",
      },
      {
        _id: {
          toString() {
            return "topup-order-001";
          },
        },
        orderCode: "WRTP-TEST-001",
        amount: 100000,
        bonusAmount: 10000,
        totalCredit: 110000,
        balanceAfter: 250000,
      },
    );

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "wallet-top-up-success",
      to: {
        subscriberId: "wallet-user-001",
        email: "wallet-user@example.com",
        phone: "0901234567",
        firstName: "Nguyễn",
        lastName: "Nạp Tiền",
      },
      payload: {
        orderId: "topup-order-001",
        orderCode: "WRTP-TEST-001",
        amount: 100000,
        bonusAmount: 10000,
        totalCredit: 110000,
        balanceAfter: 250000,
        subject: "Nạp tiền ví thành công",
        body: "Bạn đã nạp thành công 100.000đ vào ví WeRent và nhận thêm 10.000đ ưu đãi. Tổng cộng 110.000đ đã được cộng vào tài khoản của bạn.",
        previewText: "Nạp tiền ví thành công",
        recipientName: "Nguyễn Nạp Tiền",
        email: "wallet-user@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Mở ví tiền",
        ctaUrl: "https://app.werent.vn/wallet",
      },
    });
  });

  it("triggers Novu with admin wallet adjustment content for the user", async () => {
    await sendAdminWalletAdjustmentNotification(
      {
        _id: {
          toString() {
            return "wallet-user-003";
          },
        },
        fullName: "Nguyễn Điều Chỉnh Ví",
        email: "wallet-adjustment@example.com",
        phone: "0901234569",
      },
      {
        _id: {
          toString() {
            return "wallet-adjustment-001";
          },
        },
        orderCode: "ADJ-TEST-001",
        amount: 50000,
        adjustmentReason: "Hoàn tiền hỗ trợ khách hàng.",
        balanceBefore: 100000,
        balanceAfter: 150000,
      },
      "credit",
    );

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "wallet-admin-adjustment",
      to: {
        subscriberId: "wallet-user-003",
        email: "wallet-adjustment@example.com",
        phone: "0901234569",
        firstName: "Nguyễn",
        lastName: "Điều Chỉnh Ví",
      },
      payload: {
        orderId: "wallet-adjustment-001",
        orderCode: "ADJ-TEST-001",
        amount: 50000,
        direction: "credit",
        reason: "Hoàn tiền hỗ trợ khách hàng.",
        balanceBefore: 100000,
        balanceAfter: 150000,
        subject: "Ví tiền vừa được cộng thêm số dư",
        body: "Quản trị viên đã cộng 50.000đ vào ví WeRent của bạn. Lý do: Hoàn tiền hỗ trợ khách hàng. Số dư hiện tại: 150.000đ.",
        previewText: "Ví tiền vừa được cộng thêm số dư",
        recipientName: "Nguyễn Điều Chỉnh Ví",
        email: "wallet-adjustment@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Mở ví tiền",
        ctaUrl: "https://app.werent.vn/wallet",
      },
    });
  });

  it("triggers Novu with top-up failed content for the user", async () => {
    await sendTopUpFailedNotification(
      {
        _id: {
          toString() {
            return "wallet-user-002";
          },
        },
        fullName: "Nguyễn Giao Dịch Lỗi",
        email: "wallet-failed@example.com",
        phone: "0901234568",
      },
      {
        _id: {
          toString() {
            return "topup-order-002";
          },
        },
        orderCode: "WRTP-TEST-FAILED",
        amount: 150000,
        status: "failed",
        provider: "sepay",
      },
    );

    expect(novuMocks.novu.trigger).toHaveBeenCalledOnce();
    expect(novuMocks.novu.trigger).toHaveBeenCalledWith({
      workflowId: "wallet-top-up-failed",
      to: {
        subscriberId: "wallet-user-002",
        email: "wallet-failed@example.com",
        phone: "0901234568",
        firstName: "Nguyễn",
        lastName: "Giao Dịch Lỗi",
      },
      payload: {
        orderId: "topup-order-002",
        orderCode: "WRTP-TEST-FAILED",
        amount: 150000,
        status: "failed",
        provider: "sepay",
        subject: "Nạp tiền ví không thành công",
        body: "Yêu cầu nạp 150.000đ vào ví WeRent không thành công. Vui lòng thử lại hoặc kiểm tra với ngân hàng/cổng thanh toán nếu cần.",
        previewText: "Nạp tiền ví không thành công",
        recipientName: "Nguyễn Giao Dịch Lỗi",
        email: "wallet-failed@example.com",
        appName: "WeRent",
        appUrl: "https://app.werent.vn",
        ctaLabel: "Mở ví tiền",
        ctaUrl: "https://app.werent.vn/wallet",
      },
    });
  });
});
