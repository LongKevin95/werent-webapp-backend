import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  deleteAsset: vi.fn().mockResolvedValue({ result: "ok" }),
  uploadFiles: vi.fn(async (files) => files.map((file, index) => ({
    publicId: `verification/${Date.now()}-${index}-${file.originalname}`,
    secureUrl: `https://example.com/${file.originalname}`,
  }))),
}));
vi.mock("../src/services/cloudinary.service.js", () => uploadMocks);

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "kyc-test-secret";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: User } = await import("../src/modules/users/user.model.js");
const { default: Notification } = await import("../src/modules/notifications/notification.model.js");

let mongoServer;
let adminToken;

describe("KYC account and listing verification", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    const admin = await User.create({
      fullName: "KYC Admin",
      email: "kyc-admin@werent.vn",
      passwordHash: await bcrypt.hash("Password123!", 10),
      roles: ["admin"],
    });
    adminToken = signAccessToken(admin);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("blocks posting until account KYC is approved and verifies a listing", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      fullName: "Nguyễn Chủ Nhà",
      email: "owner-kyc@example.com",
      phone: "0901234567",
      password: "Password123!",
    });
    const token = registerResponse.body.data.accessToken;

    const blocked = await request(app).post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Căn hộ chưa KYC", propertyType: "Căn hộ", address: "Quận 1", price: 9000000 });
    expect(blocked.status).toBe(403);

    const submit = await request(app).post("/api/kyc/account")
      .set("Authorization", `Bearer ${token}`)
      .field("fullName", "Nguyễn Chủ Nhà")
      .field("dateOfBirth", "1990-01-02")
      .field("email", "owner-kyc@example.com")
      .field("phone", "0901234567")
      .field("address", "123 Nguyễn Huệ, Quận 1")
      .field("identityNumber", "079090001234")
      .field("identityIssuedAt", "2021-03-04")
      .attach("identityFront", Buffer.from("front"), { filename: "front.png", contentType: "image/png" })
      .attach("identityBack", Buffer.from("back"), { filename: "back.png", contentType: "image/png" })
      .attach("selfie", Buffer.from("selfie"), { filename: "selfie.png", contentType: "image/png" });
    expect(submit.status).toBe(201);
    expect(submit.body.data.item.status).toBe("pending");

    const approve = await request(app)
      .patch(`/api/admin/kyc/accounts/${submit.body.data.item._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "verified" });
    expect(approve.status).toBe(200);

    const profile = await request(app).get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(profile.body.data.user).toMatchObject({ kycStatus: "verified", canPostListing: true });

    const create = await request(app).post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Căn hộ đã KYC", propertyType: "Căn hộ", address: "123 Nguyễn Huệ, Quận 1", area: 65, price: 9000000 });
    expect(create.status).toBe(201);

    const listingKyc = await request(app)
      .post(`/api/kyc/listings/${create.body.data.property._id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("documentType", "ownership_certificate")
      .attach("documents", Buffer.from("certificate"), { filename: "so-hong.pdf", contentType: "application/pdf" });
    expect(listingKyc.status).toBe(201);

    const listingApprove = await request(app)
      .patch(`/api/admin/kyc/listings/${listingKyc.body.data.item._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "verified_owner" });
    expect(listingApprove.status).toBe(200);

    const detail = await request(app).get(`/api/properties/${create.body.data.property._id}`);
    expect(detail.body.data.property).toMatchObject({
      verificationStatus: "verified_owner",
      qualityScore: 15,
    });
    expect(detail.body.data.property.verifiedAt).toEqual(expect.any(String));
    expect(await Notification.countDocuments({ user: profile.body.data.user.id })).toBe(2);
  });

  it("revokes posting permission when verified identity data changes", async () => {
    const user = await User.create({
      fullName: "Người Đã Xác Thực",
      email: "verified-change@example.com",
      phone: "0906666666",
      passwordHash: await bcrypt.hash("Password123!", 10),
      kycStatus: "verified",
      canPostListing: true,
      verifiedAt: new Date(),
    });
    const token = signAccessToken(user);
    const response = await request(app).patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Tên Đã Thay Đổi" });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      fullName: "Tên Đã Thay Đổi",
      kycStatus: "unverified",
      canPostListing: false,
      verifiedAt: null,
    });
  });

  it("requires a concrete reason and permits resubmission after rejection", async () => {
    const user = await User.create({
      fullName: "Người Nộp KYC",
      email: "retry@example.com",
      phone: "0907777777",
      passwordHash: await bcrypt.hash("Password123!", 10),
    });
    const token = signAccessToken(user);
    const submitKyc = () => request(app).post("/api/kyc/account")
      .set("Authorization", `Bearer ${token}`)
      .field("fullName", "Người Nộp KYC").field("dateOfBirth", "1992-01-01")
      .field("email", "retry@example.com").field("phone", "0907777777")
      .field("address", "123 Địa chỉ hợp lệ").field("identityNumber", "123456789012")
      .field("identityIssuedAt", "2020-01-01")
      .attach("identityFront", Buffer.from("a"), { filename: "a.png", contentType: "image/png" })
      .attach("identityBack", Buffer.from("b"), { filename: "b.png", contentType: "image/png" })
      .attach("selfie", Buffer.from("c"), { filename: "c.png", contentType: "image/png" });
    const first = await submitKyc();
    const noReason = await request(app).patch(`/api/admin/kyc/accounts/${first.body.data.item._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "rejected" });
    expect(noReason.status).toBe(400);
    const rejected = await request(app).patch(`/api/admin/kyc/accounts/${first.body.data.item._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "rejected", reason: "Ảnh CCCD bị mờ." });
    expect(rejected.status).toBe(200);
    const second = await submitKyc();
    expect(second.status).toBe(201);
  });
});
