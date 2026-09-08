import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "admin-regular-feature-secret";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: Property } = await import(
  "../src/modules/properties/property.model.js"
);
const { default: User } = await import("../src/modules/users/user.model.js");

let mongoServer;
let adminToken;
let property;

describe("admin access to regular user features", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();

    const [admin, owner] = await User.create([
      {
        fullName: "Admin Account",
        email: "admin-regular@werent.vn",
        passwordHash: await bcrypt.hash("Password123!", 10),
        roles: ["admin"],
        kycStatus: "verified",
        canPostListing: true,
      },
      {
        fullName: "Regular Owner",
        email: "owner-regular@example.com",
        phone: "0901234567",
        passwordHash: await bcrypt.hash("Password123!", 10),
        roles: ["user"],
        kycStatus: "verified",
        canPostListing: true,
      },
    ]);

    adminToken = signAccessToken(admin);
    property = await Property.create({
      title: "Regular user listing",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      owner: owner._id,
      status: "active",
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("blocks admins from user-only listing, favorite, KYC, report and payment endpoints", async () => {
    const requests = [
      request(app)
        .get("/api/properties/my-listings")
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Admin should not post",
          propertyType: "Studio",
          address: "Admin address",
          price: 7000000,
        }),
      request(app)
        .patch(`/api/properties/${property._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Admin should not edit here" }),
      request(app)
        .delete(`/api/properties/${property._id}`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .get("/api/favorites")
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post("/api/favorites")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ propertyId: String(property._id) }),
      request(app)
        .post("/api/kyc/account")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({}),
      request(app)
        .post(`/api/kyc/listings/${property._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ documentType: "ownership_certificate" }),
      request(app)
        .post("/api/payments/top-up/checkout")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: 100000, paymentMethod: "qr" }),
      request(app)
        .post("/api/payments/orders")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ packageCode: "basic_7d" }),
      request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ propertyId: String(property._id), reason: "other" }),
    ];

    const responses = await Promise.all(requests);

    responses.forEach((response) => {
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("admin");
    });

    await expect(Property.findById(property._id).lean()).resolves.toMatchObject(
      {
        title: "Regular user listing",
      },
    );
  });
});
