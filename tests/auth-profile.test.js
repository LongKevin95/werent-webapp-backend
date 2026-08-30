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

const cloudinaryMocks = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  uploadFiles: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
  sendWelcomeNotification: vi.fn(),
  sendTopUpSuccessNotification: vi.fn(),
  sendTopUpFailedNotification: vi.fn(),
  sendAdminWalletAdjustmentNotification: vi.fn(),
}));

const googleAuthMocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("../src/services/cloudinary.service.js", () => cloudinaryMocks);
vi.mock(
  "../src/modules/notifications/notification.service.js",
  () => notificationMocks,
);
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(function OAuth2Client() {
    return {
    verifyIdToken: googleAuthMocks.verifyIdToken,
    };
  }),
}));

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
process.env.GOOGLE_AUTH_ALLOWED_EMAILS =
  "allowed@gmail.com,existing-google@gmail.com";

const { default: app } = await import("../src/app.js");

let mongoServer;

async function registerUser(overrides = {}) {
  const payload = {
    fullName: "Nguyễn Văn Test",
    email: "test@example.com",
    phone: "0901234567",
    password: "Password123!",
    ...overrides,
  };

  return request(app).post("/api/auth/register").send(payload);
}

function mockGooglePayload(overrides = {}) {
  googleAuthMocks.verifyIdToken.mockResolvedValueOnce({
    getPayload: () => ({
      sub: "google-sub-123",
      email: "allowed@gmail.com",
      email_verified: true,
      name: "Allowed Google User",
      picture: "https://example.com/google-avatar.png",
      ...overrides,
    }),
  });
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
    notificationMocks.sendWelcomeNotification
      .mockReset()
      .mockResolvedValue(null);
    googleAuthMocks.verifyIdToken.mockReset();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("registers with email and Vietnamese mobile number then logs in using normalized variants", async () => {
    const registerResponse = await registerUser({
      phone: "0901234567",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.email).toBe("test@example.com");
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

  it("returns Vietnamese required-field messages for an empty login", async () => {
    const response = await request(app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Mật khẩu là bắt buộc");
    expect(response.body.errors.fieldErrors.password).toContain(
      "Mật khẩu là bắt buộc",
    );
  });

  it("triggers a welcome notification after successful registration", async () => {
    const registerResponse = await registerUser();

    expect(registerResponse.status).toBe(201);
    expect(notificationMocks.sendWelcomeNotification).toHaveBeenCalledOnce();
    expect(notificationMocks.sendWelcomeNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Nguyễn Văn Test",
        email: "test@example.com",
        phone: "0901234567",
      }),
    );
  });

  it("keeps registration successful when Novu delivery fails", async () => {
    notificationMocks.sendWelcomeNotification.mockRejectedValueOnce(
      new Error("Novu is unavailable"),
    );

    const registerResponse = await registerUser({
      email: "fallback@example.com",
      phone: "0907654321",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.email).toBe("fallback@example.com");
    expect(notificationMocks.sendWelcomeNotification).toHaveBeenCalledOnce();
  });

  it("creates an account from a whitelisted Google email", async () => {
    mockGooglePayload();

    const response = await request(app).post("/api/auth/google").send({
      credential: "valid-google-id-token",
    });

    expect(response.status).toBe(200);
    expect(googleAuthMocks.verifyIdToken).toHaveBeenCalledWith({
      idToken: "valid-google-id-token",
      audience: "test-google-client-id.apps.googleusercontent.com",
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      fullName: "Allowed Google User",
      email: "allowed@gmail.com",
      phone: null,
      avatarUrl: "https://example.com/google-avatar.png",
      roles: ["user"],
    });
    expect(notificationMocks.sendWelcomeNotification).toHaveBeenCalledOnce();

    const passwordLoginResponse = await request(app).post("/api/auth/login").send({
      identifier: "allowed@gmail.com",
      password: "Password123!",
    });
    expect(passwordLoginResponse.status).toBe(401);
  });

  it("links Google login to an existing whitelisted email account", async () => {
    const registerResponse = await registerUser({
      email: "existing-google@gmail.com",
      phone: "0901111222",
    });
    notificationMocks.sendWelcomeNotification.mockClear();
    mockGooglePayload({
      sub: "google-existing-sub",
      email: "existing-google@gmail.com",
      name: "Existing Google User",
    });

    const response = await request(app).post("/api/auth/google").send({
      credential: "valid-google-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(registerResponse.body.data.user.id);
    expect(response.body.data.user.email).toBe("existing-google@gmail.com");
    expect(response.body.data.user.phone).toBe("0901111222");
    expect(notificationMocks.sendWelcomeNotification).not.toHaveBeenCalled();
  });

  it("rejects Google login when the email is not whitelisted", async () => {
    mockGooglePayload({
      sub: "google-blocked-sub",
      email: "blocked@gmail.com",
    });

    const response = await request(app).post("/api/auth/google").send({
      credential: "valid-google-id-token",
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("chưa nằm trong danh sách");
  });

  it("requires both email and phone during registration", async () => {
    const missingEmailResponse = await registerUser({ email: undefined });
    expect(missingEmailResponse.status).toBe(400);

    const missingPhoneResponse = await registerUser({ phone: undefined });
    expect(missingPhoneResponse.status).toBe(400);
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
        dateOfBirth: "1991-05-12",
        address: "12 Lê Lợi, Quận 1",
        identityNumber: "079091001234",
        passportNumber: "P7654321",
        taxCode: "0311111111",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      fullName: "Nguyễn Văn Mới",
      email: "test@example.com",
      address: "12 Lê Lợi, Quận 1",
      identityNumber: "079091001234",
      passportNumber: "P7654321",
      taxCode: "0311111111",
    });
    expect(response.body.data.user.dateOfBirth).toEqual(expect.any(String));
  });

  it("prevents users from changing email or phone through profile updates", async () => {
    const registerResponse = await registerUser({
      phone: "0901234567",
    });
    const token = registerResponse.body.data.accessToken;

    const emailResponse = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new-email@example.com" });
    expect(emailResponse.status).toBe(403);

    const phoneResponse = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "0901111111" });
    expect(phoneResponse.status).toBe(403);
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

    const oldPasswordResponse = await request(app)
      .post("/api/auth/login")
      .send({
        identifier: "test@example.com",
        password: "Password123!",
      });
    expect(oldPasswordResponse.status).toBe(401);

    const newPasswordResponse = await request(app)
      .post("/api/auth/login")
      .send({
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
