import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "admin-integration-test-secret";

const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/modules/auth/auth.service.js");
const { default: User } = await import("../src/modules/users/user.model.js");

let mongoServer;
let admin;
let adminToken;

describe("admin user CRUD", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    admin = await User.create({
      fullName: "Quản trị viên",
      email: "admin@werent.vn",
      passwordHash: await bcrypt.hash("12345678", 10),
      roles: ["admin"],
      isActive: true,
    });
    adminToken = signAccessToken(admin);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("creates, reads, filters, updates and deletes a user", async () => {
    const createResponse = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "Nguyễn Minh Anh",
        email: "minhanh@example.com",
        phone: "+84901234567",
        password: "12345678",
        roles: ["user"],
        isActive: true,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.user).toMatchObject({
      fullName: "Nguyễn Minh Anh",
      email: "minhanh@example.com",
      phone: "0901234567",
      roles: ["user"],
      isActive: true,
    });

    const userId = createResponse.body.data.user.id;
    const detailResponse = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.user.id).toBe(userId);

    const listResponse = await request(app)
      .get("/api/admin/users?search=Minh%20Anh&role=user&status=active")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(1);
    expect(listResponse.body.data.pagination.total).toBe(1);

    const updateResponse = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "Nguyễn Minh Anh Mới",
        roles: ["admin"],
        isActive: false,
        password: "87654321",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.user).toMatchObject({
      fullName: "Nguyễn Minh Anh Mới",
      roles: ["admin"],
      isActive: false,
    });

    const deleteResponse = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(await User.findById(userId)).toBeNull();
  });

  it("does not let an admin lock, demote or delete their own account", async () => {
    const lockResponse = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(lockResponse.status).toBe(400);

    const demoteResponse = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roles: ["user"] });
    expect(demoteResponse.status).toBe(400);

    const deleteResponse = await request(app)
      .delete(`/api/admin/users/${admin.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(400);
  });

  it("rejects duplicate contact information", async () => {
    await User.create({
      fullName: "Người dùng có sẵn",
      email: "existing@example.com",
      passwordHash: await bcrypt.hash("12345678", 10),
      roles: ["user"],
    });

    const response = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "Người dùng trùng",
        email: "existing@example.com",
        password: "12345678",
        roles: ["user"],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("Email");
  });
});
