import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PROPERTY_STATUS } from "../src/common/constants.js";

const notificationMocks = vi.hoisted(() => ({
  sendListingStatusNotification: vi.fn(),
  sendTopUpSuccessNotification: vi.fn(),
  sendTopUpFailedNotification: vi.fn(),
  sendAdminWalletAdjustmentNotification: vi.fn(),
}));

vi.mock(
  "../src/modules/notifications/notification.service.js",
  () => notificationMocks,
);

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "admin-property-test-secret";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: Property } =
  await import("../src/modules/properties/property.model.js");
const { default: User } = await import("../src/modules/users/user.model.js");

let mongoServer;
let adminToken;
let owner;

describe("admin property moderation", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    notificationMocks.sendListingStatusNotification
      .mockReset()
      .mockResolvedValue(null);
    const admin = await User.create({
      fullName: "Quản trị viên",
      email: "admin-properties@werent.vn",
      passwordHash: await bcrypt.hash("12345678", 10),
      roles: ["admin"],
    });
    owner = await User.create({
      fullName: "Nguyễn Chủ Nhà",
      email: "owner-properties@werent.vn",
      passwordHash: await bcrypt.hash("12345678", 10),
      roles: ["user"],
    });
    adminToken = signAccessToken(admin);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("lists and filters every listing status for admins", async () => {
    await Property.create([
      {
        title: "Căn hộ chờ duyệt",
        propertyType: "Căn hộ",
        address: "Quận 1",
        city: "TP. Hồ Chí Minh",
        price: 12000000,
        owner: owner._id,
        status: PROPERTY_STATUS.PENDING,
      },
      {
        title: "Nhà đã đăng",
        propertyType: "Nhà riêng",
        address: "Ba Đình",
        city: "Hà Nội",
        price: 18000000,
        owner: owner._id,
        status: PROPERTY_STATUS.ACTIVE,
      },
    ]);

    const response = await request(app)
      .get("/api/admin/properties")
      .query({ search: "Chủ Nhà", status: PROPERTY_STATUS.PENDING })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      title: "Căn hộ chờ duyệt",
      status: PROPERTY_STATUS.PENDING,
    });
    expect(response.body.data.items[0].owner.fullName).toBe("Nguyễn Chủ Nhà");
    expect(response.body.data.statusCounts).toMatchObject({
      active: 1,
      all: 2,
      pending: 1,
    });
  });

  it("approves listings and requires a reason when rejecting or hiding", async () => {
    const pendingProperty = await Property.create({
      title: "Tin cần kiểm duyệt",
      propertyType: "Căn hộ",
      address: "Quận 3",
      price: 9000000,
      owner: owner._id,
      status: PROPERTY_STATUS.PENDING,
    });

    const missingReasonResponse = await request(app)
      .patch(`/api/admin/properties/${pendingProperty.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: PROPERTY_STATUS.REJECTED });
    expect(missingReasonResponse.status).toBe(400);

    const rejectResponse = await request(app)
      .patch(`/api/admin/properties/${pendingProperty.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: PROPERTY_STATUS.REJECTED,
        reason: "Hình ảnh không đúng với nội dung mô tả.",
      });
    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.property).toMatchObject({
      status: PROPERTY_STATUS.REJECTED,
      moderationReason: "Hình ảnh không đúng với nội dung mô tả.",
      rejectionReason: "Hình ảnh không đúng với nội dung mô tả.",
    });
    expect(
      notificationMocks.sendListingStatusNotification,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: "Tin cần kiểm duyệt",
        status: PROPERTY_STATUS.REJECTED,
      }),
    );

    const approveResponse = await request(app)
      .patch(`/api/admin/properties/${pendingProperty.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: PROPERTY_STATUS.ACTIVE });
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.ACTIVE,
    );
    expect(approveResponse.body.data.property.publishedAt).toEqual(
      expect.any(String),
    );
    expect(
      notificationMocks.sendListingStatusNotification,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: "Tin cần kiểm duyệt",
        status: PROPERTY_STATUS.ACTIVE,
      }),
    );

    const hideResponse = await request(app)
      .patch(`/api/admin/properties/${pendingProperty.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: PROPERTY_STATUS.HIDDEN,
        reason: "Tin có dấu hiệu trùng lặp và cần xác minh.",
      });
    expect(hideResponse.status).toBe(200);
    expect(hideResponse.body.data.property).toMatchObject({
      status: PROPERTY_STATUS.HIDDEN,
      moderationReason: "Tin có dấu hiệu trùng lặp và cần xác minh.",
    });
    expect(
      notificationMocks.sendListingStatusNotification,
    ).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        title: "Tin cần kiểm duyệt",
        status: PROPERTY_STATUS.HIDDEN,
      }),
    );
  });
});
