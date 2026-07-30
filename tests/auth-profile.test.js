import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cloudinaryMocks = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  uploadFiles: vi.fn(),
}));

vi.mock("../src/services/cloudinary.service.js", () => cloudinaryMocks);

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";

const { default: app } = await import("../src/app.js");

let mongoServer;

async function registerUser(overrides = {}) {
  const payload = {
    fullName: "Nguyễn Văn Test",
    email: "test@example.com",
    password: "Password123!",
    ...overrides,
  };

  return request(app).post("/api/auth/register").send(payload);
}

describe("authentication and profile backlog", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    cloudinaryMocks.deleteAsset.mockReset().mockResolvedValue({ result: "ok" });
    cloudinaryMocks.uploadFiles.mockReset().mockResolvedValue([
      {
        publicId: "werent/users/avatar/test-avatar",
        secureUrl: "https://example.com/test-avatar.png",
        width: 512,
        height: 512,
        bytes: 128,
        format: "png",
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("registers with a Vietnamese mobile number and logs in using normalized variants", async () => {
    const registerResponse = await registerUser({
      email: undefined,
      phone: "0901234567",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.phone).toBe("0901234567");
    expect(registerResponse.body.data.user.roles).toEqual(["user"]);
    expect(registerResponse.body.data.accessToken).toEqual(expect.any(String));

    const loginResponse = await request(app).post("/api/auth/login").send({
      identifier: "+84901234567",
      password: "Password123!",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.phone).toBe("0901234567");
  });

  it("protects the current-user endpoint with JWT", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const anonymousResponse = await request(app).get("/api/auth/me");
    expect(anonymousResponse.status).toBe(401);

    const authenticatedResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(authenticatedResponse.status).toBe(200);
    expect(authenticatedResponse.body.data.user.email).toBe("test@example.com");
  });

  it("prevents a regular user from accessing admin routes", async () => {
    const registerResponse = await registerUser();

    const response = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${registerResponse.body.data.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("updates personal profile information", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Nguyễn Văn Mới",
        phone: "901111111",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      fullName: "Nguyễn Văn Mới",
      email: "test@example.com",
      phone: "0901111111",
    });
  });

  it("changes the password and accepts only the new password afterward", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const changeResponse = await request(app)
      .patch("/api/users/me/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: "Password123!",
        newPassword: "NewPassword456!",
      });

    expect(changeResponse.status).toBe(200);

    const oldPasswordResponse = await request(app).post("/api/auth/login").send({
      identifier: "test@example.com",
      password: "Password123!",
    });
    expect(oldPasswordResponse.status).toBe(401);

    const newPasswordResponse = await request(app).post("/api/auth/login").send({
      identifier: "test@example.com",
      password: "NewPassword456!",
    });
    expect(newPasswordResponse.status).toBe(200);
  });

  it("uploads an image avatar and rejects unsupported file types", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const uploadResponse = await request(app)
      .patch("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", Buffer.from("png-data"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.data.user.avatarUrl).toBe(
      "https://example.com/test-avatar.png",
    );
    expect(cloudinaryMocks.uploadFiles).toHaveBeenCalledOnce();

    const invalidResponse = await request(app)
      .patch("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", Buffer.from("not-an-image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(invalidResponse.status).toBe(415);
  });

  it("returns 429 after too many authentication attempts", async () => {
    let lastResponse;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      lastResponse = await request(app).post("/api/auth/login").send({
        identifier: "missing@example.com",
        password: "wrong-password",
      });

      if (lastResponse.status === 429) {
        break;
      }
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.message).toContain("quá nhiều");
  });
});
