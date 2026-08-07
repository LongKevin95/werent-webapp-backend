import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PROPERTY_STATUS } from "../src/common/constants.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";

const { default: app } = await import("../src/app.js");
const { default: Property } = await import(
  "../src/modules/properties/property.model.js"
);

let mongoServer;
const tinyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function registerUser(email = "owner@example.com") {
  return request(app).post("/api/auth/register").send({
    fullName: "Property Owner",
    email,
    password: "Password123!",
  });
}

describe("property publishing workflow", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await rm(path.join(process.cwd(), "uploads"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await rm(path.join(process.cwd(), "uploads"), {
      force: true,
      recursive: true,
    });
    await mongoServer?.stop();
  });

  it("sends new listings to admin review before public display", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const createResponse = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Riverside studio for rent",
        propertyType: "Studio",
        address: "15 Nguyen Co Thach, Thu Duc",
        city: "TP. Ho Chi Minh",
        district: "Thu Duc",
        price: 7200000,
        status: PROPERTY_STATUS.PENDING,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.PENDING,
    );
    expect(createResponse.body.data.property.publishedAt).toBeNull();

    await Property.create({
      title: "Hidden draft studio",
      propertyType: "Studio",
      address: "Hidden address",
      price: 5000000,
      owner: createResponse.body.data.property.owner,
      status: PROPERTY_STATUS.DRAFT,
    });

    const searchResponse = await request(app)
      .get("/api/properties")
      .query({ keyword: "studio" });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.items).toHaveLength(0);

    const draftSearchResponse = await request(app)
      .get("/api/properties")
      .query({ keyword: "studio", status: PROPERTY_STATUS.DRAFT });

    expect(draftSearchResponse.status).toBe(200);
    expect(draftSearchResponse.body.data.items).toHaveLength(0);
  });

  it("stores new listings as drafts when the wizard requests draft status", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const createResponse = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Draft apartment for later",
        propertyType: "Apartment",
        address: "22 Nguyen Trai, District 1",
        city: "TP. Ho Chi Minh",
        district: "District 1",
        ward: "Ben Thanh",
        price: 9200000,
        status: PROPERTY_STATUS.DRAFT,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.DRAFT,
    );
    expect(createResponse.body.data.property.publishedAt).toBeNull();

    const searchResponse = await request(app)
      .get("/api/properties")
      .query({ keyword: "Draft apartment" });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.items).toHaveLength(0);
  });

  it("accepts multipart payloads from the post listing wizard", async () => {
    const registerResponse = await registerUser();
    const token = registerResponse.body.data.accessToken;

    const createResponse = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "API connected apartment")
      .field("propertyType", "Căn hộ chung cư")
      .field("description", "Tin đăng được gửi từ FormData.")
      .field("address", "15 Nguyễn Cơ Thạch, TP. Thủ Đức")
      .field("city", "TP. Hồ Chí Minh")
      .field("district", "TP. Thủ Đức")
      .field("price", "12000000")
      .field("amenities", JSON.stringify(["wifi", "camera"]))
      .field(
        "coordinates",
        JSON.stringify({ lat: 10.7721, lng: 106.6983 }),
      )
      .field("addressComponents", JSON.stringify([{ kind: "city" }]))
      .field(
        "package",
        JSON.stringify({
          durationDays: 10,
          durationKey: "10days",
          pricePerDay: 2980,
          tier: "standard",
          totalPrice: 29800,
        }),
      )
      .field("expiresAt", "2026-08-16")
      .attach("images", tinyPngBuffer, {
        contentType: "image/png",
        filename: "room.png",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.PENDING,
    );
    expect(createResponse.body.data.property.amenities).toEqual([
      "wifi",
      "camera",
    ]);
    expect(createResponse.body.data.property.coordinates).toMatchObject({
      lat: 10.7721,
      lng: 106.6983,
    });
    expect(createResponse.body.data.property.package).toMatchObject({
      durationDays: 10,
      durationKey: "10days",
      pricePerDay: 2980,
      tier: "standard",
      totalPrice: 29800,
    });
    expect(createResponse.body.data.property.expiresAt).toEqual(
      expect.any(String),
    );
    expect(createResponse.body.data.property.images[0]).toMatchObject({
      publicId: expect.stringMatching(/^local\/werent\/properties\//),
      url: expect.stringMatching(/^\/api\/uploads\/werent\/properties\//),
    });

    const imageResponse = await request(app).get(
      createResponse.body.data.property.images[0].url,
    );

    expect(imageResponse.status).toBe(200);
  });

  it("returns only the authenticated owner's listings with pagination", async () => {
    const ownerResponse = await registerUser();
    const otherOwnerResponse = await registerUser("other-owner@example.com");
    const ownerId = ownerResponse.body.data.user.id;
    const otherOwnerId = otherOwnerResponse.body.data.user.id;
    const token = ownerResponse.body.data.accessToken;

    await Property.create(
      Array.from({ length: 7 }, (_, index) => ({
        title: `Owner listing ${index + 1}`,
        propertyType: "Studio",
        address: `${index + 1} Nguyen Co Thach`,
        price: 7000000 + index,
        owner: ownerId,
        status: index < 6 ? PROPERTY_STATUS.ACTIVE : PROPERTY_STATUS.HIDDEN,
      })),
    );
    await Property.create({
      title: "Other owner listing",
      propertyType: "Studio",
      address: "Other address",
      price: 5000000,
      owner: otherOwnerId,
      status: PROPERTY_STATUS.ACTIVE,
    });

    const pageOneResponse = await request(app)
      .get("/api/properties/my-listings")
      .set("Authorization", `Bearer ${token}`)
      .query({ limit: 5, page: 1 });

    expect(pageOneResponse.status).toBe(200);
    expect(pageOneResponse.body.data.items).toHaveLength(5);
    expect(pageOneResponse.body.data.pagination).toMatchObject({
      limit: 5,
      page: 1,
      total: 7,
      totalPages: 2,
    });
    expect(pageOneResponse.body.data.statusCounts).toMatchObject({
      active: 6,
      all: 7,
      hidden: 1,
    });
    expect(
      pageOneResponse.body.data.items.every(
        (listing) => (listing.owner.id ?? listing.owner._id) === ownerId,
      ),
    ).toBe(true);

    const hiddenResponse = await request(app)
      .get("/api/properties/my-listings")
      .set("Authorization", `Bearer ${token}`)
      .query({ limit: 10, page: 1, status: PROPERTY_STATUS.HIDDEN });

    expect(hiddenResponse.status).toBe(200);
    expect(hiddenResponse.body.data.items).toHaveLength(1);
    expect(hiddenResponse.body.data.items[0].status).toBe(
      PROPERTY_STATUS.HIDDEN,
    );
  });

  it("allows owners to update their listings and replace the image order", async () => {
    const ownerResponse = await registerUser();
    const ownerId = ownerResponse.body.data.user.id;
    const token = ownerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Listing before update",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      city: "Old city",
      district: "Old district",
      images: [
        {
          publicId: "local/werent/properties/old-cover.png",
          url: "/api/uploads/werent/properties/old-cover.png",
        },
        {
          publicId: "local/werent/properties/kept-image.png",
          url: "/api/uploads/werent/properties/kept-image.png",
        },
      ],
      owner: ownerId,
      status: PROPERTY_STATUS.ACTIVE,
    });

    const updateResponse = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Listing after update")
      .field("description", "")
      .field("city", "Thành phố Hồ Chí Minh")
      .field("district", "Quận 1")
      .field(
        "existingImages",
        JSON.stringify([
          {
            publicId: "local/werent/properties/kept-image.png",
            url: "/api/uploads/werent/properties/kept-image.png",
          },
        ]),
      )
      .field(
        "imageOrder",
        JSON.stringify([
          {
            publicId: "local/werent/properties/kept-image.png",
            source: "existing",
            url: "/api/uploads/werent/properties/kept-image.png",
          },
          {
            fileIndex: 0,
            source: "new",
          },
        ]),
      )
      .attach("images", tinyPngBuffer, {
        contentType: "image/png",
        filename: "new-room.png",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.property).toMatchObject({
      title: "Listing after update",
      city: "Thành phố Hồ Chí Minh",
      district: "Quận 1",
      description: "",
      status: PROPERTY_STATUS.PENDING,
    });
    expect(updateResponse.body.data.property.images).toHaveLength(2);
    expect(updateResponse.body.data.property.images[0]).toMatchObject({
      publicId: "local/werent/properties/kept-image.png",
      url: "/api/uploads/werent/properties/kept-image.png",
    });
    expect(updateResponse.body.data.property.images[1]).toMatchObject({
      publicId: expect.stringMatching(/^local\/werent\/properties\//),
      url: expect.stringMatching(/^\/api\/uploads\/werent\/properties\//),
    });
    expect(
      updateResponse.body.data.property.images.some(
        (image) => image.publicId === "local/werent/properties/old-cover.png",
      ),
    ).toBe(false);
  });

  it("allows owners to hide and show their active listings", async () => {
    const ownerResponse = await registerUser();
    const ownerId = ownerResponse.body.data.user.id;
    const token = ownerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Toggle visibility listing",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      owner: ownerId,
      status: PROPERTY_STATUS.ACTIVE,
      publishedAt: new Date(),
    });

    const hideResponse = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: PROPERTY_STATUS.HIDDEN });

    expect(hideResponse.status).toBe(200);
    expect(hideResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.HIDDEN,
    );

    const hiddenSearchResponse = await request(app)
      .get("/api/properties")
      .query({ keyword: "Toggle visibility" });

    expect(hiddenSearchResponse.status).toBe(200);
    expect(hiddenSearchResponse.body.data.items).toHaveLength(0);

    const showResponse = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: PROPERTY_STATUS.ACTIVE });

    expect(showResponse.status).toBe(200);
    expect(showResponse.body.data.property.status).toBe(
      PROPERTY_STATUS.ACTIVE,
    );
    expect(showResponse.body.data.property.publishedAt).toEqual(
      expect.any(String),
    );
  });

  it("prevents owners from bypassing admin review", async () => {
    const ownerResponse = await registerUser();
    const ownerId = ownerResponse.body.data.user.id;
    const token = ownerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Pending admin decision",
      propertyType: "Apartment",
      address: "District 1",
      price: 8000000,
      owner: ownerId,
      status: PROPERTY_STATUS.PENDING,
    });

    const response = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: PROPERTY_STATUS.ACTIVE });

    expect(response.status).toBe(400);
    await expect(Property.findById(property._id).lean()).resolves.toMatchObject({
      status: PROPERTY_STATUS.PENDING,
    });
  });

  it("prevents users from updating another owner's listing", async () => {
    const ownerResponse = await registerUser();
    const otherOwnerResponse = await registerUser("other-update@example.com");
    const ownerId = ownerResponse.body.data.user.id;
    const otherToken = otherOwnerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Protected update listing",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      owner: ownerId,
      status: PROPERTY_STATUS.ACTIVE,
    });

    const updateResponse = await request(app)
      .patch(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "Should not update" });

    expect(updateResponse.status).toBe(403);
    await expect(Property.findById(property._id).lean()).resolves.toMatchObject({
      title: "Protected update listing",
    });
  });

  it("allows owners to delete their own listings", async () => {
    const ownerResponse = await registerUser();
    const ownerId = ownerResponse.body.data.user.id;
    const token = ownerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Listing to delete",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      owner: ownerId,
      status: PROPERTY_STATUS.ACTIVE,
    });

    const deleteResponse = await request(app)
      .delete(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.message).toBe("Xóa tin đăng thành công.");
    await expect(Property.findById(property._id)).resolves.toBeNull();

    const searchResponse = await request(app)
      .get("/api/properties")
      .query({ keyword: "Listing to delete" });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.items).toHaveLength(0);
  });

  it("prevents users from deleting another owner's listing", async () => {
    const ownerResponse = await registerUser();
    const otherOwnerResponse = await registerUser("other-delete@example.com");
    const ownerId = ownerResponse.body.data.user.id;
    const otherToken = otherOwnerResponse.body.data.accessToken;
    const property = await Property.create({
      title: "Protected listing",
      propertyType: "Studio",
      address: "15 Nguyen Co Thach",
      price: 7000000,
      owner: ownerId,
      status: PROPERTY_STATUS.ACTIVE,
    });

    const deleteResponse = await request(app)
      .delete(`/api/properties/${property._id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(deleteResponse.status).toBe(403);
    await expect(Property.findById(property._id)).resolves.toBeTruthy();
  });
});
