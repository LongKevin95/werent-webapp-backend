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

process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GEMINI_MODEL = "gemini-3.8-flash";
process.env.JWT_SECRET = "integration-test-secret";

const { default: app } = await import("../src/app.js");
const { default: Property } =
  await import("../src/modules/properties/property.model.js");
const { default: User } = await import("../src/modules/users/user.model.js");

let mongoServer;

async function seedSearchListings() {
  const owner = await User.create({
    email: "ai-search-owner@example.com",
    fullName: "AI Search Owner",
    phone: "0901111222",
  });

  await Property.create([
    {
      address: "River Panorama, Hoàng Quốc Việt, Quận 7",
      amenities: ["full nội thất", "hồ bơi", "gym"],
      area: 75,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận 7",
      furnishing: "Đầy đủ nội thất",
      images: [
        {
          publicId: null,
          url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
        },
      ],
      isFeatured: true,
      nearbyPlaces: ["Đại học RMIT", "Phú Mỹ Hưng"],
      owner: owner._id,
      price: 13500000,
      projectName: "River Panorama",
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
    },
    {
      address: "Sunrise City, Nguyễn Hữu Thọ, Quận 7",
      amenities: ["hồ bơi", "gym"],
      area: 76,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận 7",
      furnishing: "Nội thất cơ bản",
      owner: owner._id,
      price: 16000000,
      projectName: "Sunrise City",
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ Sunrise City gần Nguyễn Hữu Thọ Quận 7",
    },
    {
      address: "Nguyễn Văn Linh, Quận 7",
      amenities: ["wifi", "camera"],
      area: 24,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận 7",
      owner: owner._id,
      price: 4800000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ sinh viên gần Đại học RMIT",
    },
    {
      address: "Quốc Hương, TP. Thủ Đức",
      amenities: ["wifi", "camera"],
      area: 25,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "TP. Thủ Đức",
      furnishing: "Nội thất cơ bản",
      nearbyPlaces: ["Thảo Điền", "Metro An Phú"],
      owner: owner._id,
      price: 4900000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ sinh viên Thủ Đức dưới 5 triệu",
    },
    {
      address: "Hẻm 120 Cộng Hòa, Quận Tân Bình",
      amenities: ["máy lạnh", "bếp", "sân để xe"],
      area: 62,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Tân Bình",
      furnishing: "Nội thất cơ bản",
      owner: owner._id,
      price: 10500000,
      propertyType: "Nhà riêng",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà nguyên căn Tân Bình 2 phòng ngủ có máy lạnh",
    },
    {
      address: "Hẻm 96 Cộng Hòa, Quận Tân Bình",
      amenities: ["bếp", "sân để xe", "camera"],
      area: 55,
      bathrooms: 1,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Tân Bình",
      furnishing: "Nội thất cơ bản",
      nearbyPlaces: ["Etown"],
      owner: owner._id,
      price: 9800000,
      propertyType: "Nhà riêng",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà riêng Tân Bình gần Etown tầm 10 triệu",
    },
    {
      address: "Hẻm 41 Trường Chinh, Quận Tân Bình",
      amenities: ["bếp", "chỗ để xe máy", "camera"],
      area: 28,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận Tân Bình",
      furnishing: "Nội thất cơ bản",
      nearbyPlaces: ["Etown"],
      owner: owner._id,
      price: 4800000,
      propertyType: "Nhà riêng",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà riêng Tân Bình nhỏ gọn dưới 5 triệu",
    },
    {
      address: "Botanica Premier, Hồng Hà, Quận Tân Bình",
      amenities: ["máy lạnh", "bãi xe", "bảo vệ"],
      area: 38,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận Tân Bình",
      furnishing: "Đầy đủ nội thất",
      owner: owner._id,
      price: 8500000,
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Studio Botanica Premier Tân Bình gần sân bay",
    },
    {
      address: "15 Nguyễn Cơ Thạch, TP. Thủ Đức",
      amenities: ["máy lạnh", "wifi", "dọn phòng"],
      area: 32,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "TP. Thủ Đức",
      furnishing: "Đầy đủ nội thất",
      owner: owner._id,
      price: 7200000,
      propertyType: "Căn hộ dịch vụ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ dịch vụ Nguyễn Cơ Thạch Thủ Đức",
    },
    {
      address: "Xa lộ Hà Nội, Phường Thảo Điền, Thành phố Thủ Đức",
      amenities: ["máy lạnh", "wifi", "bãi xe"],
      area: 45,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Thành phố Thủ Đức",
      furnishing: "Đầy đủ nội thất",
      owner: owner._id,
      price: 18000000,
      propertyType: "Căn hộ dịch vụ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Test Đăng Tin Account GG",
    },
    {
      address: "Landmark 81, Vinhomes Central Park, Quận Bình Thạnh",
      amenities: ["full nội thất", "hồ bơi", "gym", "bảo vệ"],
      area: 82,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Bình Thạnh",
      furnishing: "Đầy đủ nội thất",
      nearbyPlaces: ["Landmark 81", "Vinhomes Central Park", "Cầu Sài Gòn"],
      owner: owner._id,
      price: 28000000,
      projectName: "Vinhomes Central Park",
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ Landmark 81 Vinhomes Central Park",
    },
    {
      address: "Saigon Pearl, Nguyễn Hữu Cảnh, Quận Bình Thạnh",
      amenities: ["full nội thất", "hồ bơi", "gym"],
      area: 72,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Bình Thạnh",
      furnishing: "Đầy đủ nội thất",
      nearbyPlaces: ["Landmark 81", "Saigon Pearl", "Cầu Sài Gòn"],
      owner: owner._id,
      price: 21000000,
      projectName: "Saigon Pearl",
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ Saigon Pearl Bình Thạnh view sông",
    },
    {
      address: "Pearl Plaza, Điện Biên Phủ, Quận Bình Thạnh",
      amenities: ["hồ bơi", "gym", "bảo vệ"],
      area: 70,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Bình Thạnh",
      furnishing: "Đầy đủ nội thất",
      nearbyPlaces: ["Pearl Plaza", "Hàng Xanh"],
      owner: owner._id,
      price: 18000000,
      projectName: "Pearl Plaza Residence",
      propertyType: "Căn hộ chung cư",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Căn hộ 2 phòng ngủ Pearl Plaza Bình Thạnh",
    },
    {
      address: "Số 29 Út Tịch, Quận Tân Bình",
      amenities: ["máy lạnh", "mặt tiền", "bếp"],
      area: 58,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận Tân Bình",
      furnishing: "Nội thất cơ bản",
      owner: owner._id,
      price: 12000000,
      propertyType: "Nhà mặt phố",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà mặt phố Tân Bình nguyên căn có máy lạnh",
    },
    {
      address: "Dãy trọ 12, Đường số 7, Phường Tân Tạo A, Quận Bình Tân",
      amenities: [
        "wifi",
        "máy lạnh",
        "bảo vệ",
        "chỗ để xe máy",
        "điện nước giá tốt",
      ],
      area: 22,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận Bình Tân",
      furnishing: "Nội thất cơ bản",
      locationNote: "Gần KCN Tân Tạo, chợ Tân Tạo, điện nước giá tốt",
      nearbyPlaces: ["KCN Tân Tạo", "Chợ Tân Tạo"],
      owner: owner._id,
      price: 4800000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ an ninh gần KCN Tân Tạo Bình Tân có máy lạnh",
    },
    {
      address: "Hẻm 86, Tỉnh Lộ 10, Phường Tân Tạo, Quận Bình Tân",
      amenities: ["wifi", "camera", "chỗ để xe máy", "điện nước giá tốt"],
      area: 18,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận Bình Tân",
      furnishing: "Nội thất cơ bản",
      locationNote:
        "Phòng trọ gần KCN Tân Tạo và chợ khu vực, điện nước giá tốt",
      nearbyPlaces: ["KCN Tân Tạo", "Chợ Tân Tạo"],
      owner: owner._id,
      price: 3900000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ tiết kiệm gần KCN Tân Tạo có chỗ để xe",
    },
    {
      address: "Đường số 6, Linh Trung, TP. Thủ Đức",
      amenities: ["wifi", "chỗ để xe máy", "camera"],
      area: 16,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "TP. Thủ Đức",
      nearbyPlaces: ["Đại học Quốc gia TP.HCM"],
      owner: owner._id,
      price: 1800000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
    },
    {
      address: "Hẻm 64 Đường số 11, Linh Xuân, TP. Thủ Đức",
      amenities: ["máy lạnh", "wifi", "chỗ để xe máy", "camera"],
      area: 18,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "TP. Thủ Đức",
      furnishing: "Nội thất cơ bản",
      nearbyPlaces: ["Đại học Quốc gia TP.HCM"],
      owner: owner._id,
      price: 1900000,
      propertyType: "Phòng trọ",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Phòng trọ giá rẻ Linh Xuân Thủ Đức có máy lạnh",
    },
    {
      address: "Số 28 Nguyễn Trãi, Phường Bến Thành, Quận 1",
      amenities: ["máy lạnh", "bếp"],
      area: 42,
      bathrooms: 1,
      bedrooms: 1,
      city: "TP. Hồ Chí Minh",
      district: "Quận 1",
      furnishing: "Nội thất cơ bản",
      owner: owner._id,
      price: 9800000,
      propertyType: "Nhà riêng",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà riêng Quận 1 dưới 10 triệu gần Bến Thành",
    },
    {
      address: "Số 36 Hà Huy Giáp, Phường Thạnh Xuân, Quận 12",
      amenities: ["sân để xe", "bếp", "ban công", "camera"],
      area: 70,
      bathrooms: 2,
      bedrooms: 2,
      city: "TP. Hồ Chí Minh",
      district: "Quận 12",
      owner: owner._id,
      price: 9500000,
      propertyType: "Nhà riêng",
      status: PROPERTY_STATUS.ACTIVE,
      title: "Nhà riêng Quận 12 2 phòng ngủ có sân để xe",
    },
  ]);
}

describe("AI natural language property search", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await seedSearchListings();
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          amenities: ["full nội thất"],
          districts: ["Quận 7"],
          maxPrice: 15000000,
          minBedrooms: 2,
          propertyTypes: ["Căn hộ chung cư"],
        }),
      }),
      ok: true,
      status: 200,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("returns active WeRent listings from a locally parsed specific search request", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "Tôi muốn tìm căn hộ 2 phòng ngủ ở Quận 7 dưới 15 triệu, ưu tiên full nội thất.",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      parsedBy: "local",
      provider: "local",
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["Căn hộ chung cư", "Quận 7"]),
    );
    expect(response.body.data.reply).toContain("Mình tìm thấy 1 tin đang hoạt động");
    expect(response.body.data.reply).not.toContain("database WeRent");
    expect(response.body.data.listings).toHaveLength(1);
    expect(response.body.data.listings[0]).toMatchObject({
      bedrooms: 2,
      district: "Quận 7",
      price: 13500000,
      title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
    });
    expect(
      response.body.data.recognizedCriteria.required.length,
    ).toBeGreaterThan(0);
    expect(response.body.data.listings[0].matchReasons.length).toBeGreaterThan(
      0,
    );
  });

  it("uses Gemini parsing when local search criteria are not specific enough", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Gợi ý căn hộ phù hợp cho gia đình nhỏ.",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      parsedBy: "gemini",
      provider: "gemini",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.body.data.listings[0]).toMatchObject({
      bedrooms: 2,
      district: "Quận 7",
      price: 13500000,
      title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
    });
  });

  it("recognizes serviced apartment intent without turning it into condominium intent", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "tôi muốn tìm căn hộ dịch vụ",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria.propertyTypes).toEqual([
      "Căn hộ dịch vụ",
    ]);
    expect(response.body.data.criteria.propertyTypes).not.toContain(
      "Căn hộ chung cư",
    );
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
      remainingQuestions: 2,
    });
  });

  it("returns only serviced apartments when the user asks for serviced apartments", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tôi muốn tìm căn hộ dịch vụ ở Thủ Đức dưới 8 triệu",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 8000000,
      propertyTypes: ["Căn hộ dịch vụ"],
    });
    expect(response.body.data.criteria.propertyTypes).not.toContain(
      "Căn hộ chung cư",
    );
    expect(response.body.data.listings).toEqual([
      expect.objectContaining({
        district: "TP. Thủ Đức",
        price: 7200000,
        propertyType: "Căn hộ dịch vụ",
        title: "Căn hộ dịch vụ Nguyễn Cơ Thạch Thủ Đức",
      }),
    ]);
  });

  it("matches serviced apartments in Thu Duc district variants above a minimum budget", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "căn hộ dịch vụ tại thủ đức trên 15 triệu",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      minPrice: 15000000,
      propertyTypes: ["Căn hộ dịch vụ"],
    });
    expect(response.body.data.criteria.propertyTypes).not.toContain(
      "Căn hộ chung cư",
    );
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "Thành phố Thủ Đức",
          price: 18000000,
          propertyType: "Căn hộ dịch vụ",
          title: "Test Đăng Tin Account GG",
        }),
      ]),
    );
    expect(
      response.body.data.listings.every(
        (listing) =>
          listing.propertyType === "Căn hộ dịch vụ" &&
          listing.price >= 15000000,
      ),
    ).toBe(true);
  });

  it("does not return condominium listings for studio or mini apartment intent", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm studio ở Tân Bình dưới 9 triệu",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
      maxPrice: 9000000,
      propertyTypes: ["Căn hộ dịch vụ"],
    });
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyType: "Căn hộ chung cư",
          title: "Studio Botanica Premier Tân Bình gần sân bay",
        }),
      ]),
    );
  });

  it("returns five chatbot listings at a time with pagination metadata", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          propertyTypes: ["C\u0103n h\u1ed9 chung c\u01b0"],
        }),
      }),
      ok: true,
      status: 200,
    });

    const firstResponse = await request(app)
      .post("/api/ai/search")
      .send({
        limit: 5,
        message: "G\u1ee3i \u00fd c\u0103n h\u1ed9 ph\u00f9 h\u1ee3p",
        previousCriteria: {
          districts: ["Quận 7", "Quận Bình Thạnh", "Quận Tân Bình"],
          maxPrice: 30000000,
          noAmenityPreference: true,
        },
      });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.data.listings).toHaveLength(5);
    expect(firstResponse.body.data.pagination).toMatchObject({
      hasMore: true,
      limit: 5,
      nextOffset: 5,
      offset: 0,
      total: 6,
    });
    expect(firstResponse.body.data.reply).toContain("5/6");

    const nextResponse = await request(app).post("/api/ai/search").send({
      limit: 5,
      message: "G\u1ee3i \u00fd c\u0103n h\u1ed9 ph\u00f9 h\u1ee3p",
      offset: firstResponse.body.data.pagination.nextOffset,
      previousCriteria: firstResponse.body.data.criteria,
    });

    expect(nextResponse.status).toBe(200);
    expect(nextResponse.body.data.listings).toHaveLength(1);
    expect(nextResponse.body.data.pagination).toMatchObject({
      hasMore: false,
      limit: 5,
      nextOffset: 6,
      offset: 5,
      total: 6,
    });
    expect(nextResponse.body.data.reply).toContain("6/6");
  });

  it("does not report more chatbot listings when five or fewer listings match", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "T\u00ecm ph\u00f2ng tr\u1ecd \u1edf B\u00ecnh T\u00e2n",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.listings.length).toBeLessThanOrEqual(5);
    expect(response.body.data.pagination).toMatchObject({
      hasMore: false,
      nextOffset: response.body.data.listings.length,
      offset: 0,
      total: response.body.data.listings.length,
    });
  });

  it("keeps project or landmark search results constrained to that location", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "tôi muốn thuê căn hộ trong khu landmark 81, ngân sách dưới 30 triệu, không yêu cầu tiện ích đặc biệt",
      limit: 4,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      parsedBy: "local",
      provider: "local",
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      keywords: ["Landmark 81"],
      nearbyPlaces: [],
      propertyTypes: ["Căn hộ chung cư"],
    });
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["Landmark 81"]),
    );
    expect(response.body.data.listings).toHaveLength(1);
    expect(response.body.data.listings[0]).toMatchObject({
      nearbyPlaces: expect.arrayContaining(["Landmark 81"]),
      projectName: "Vinhomes Central Park",
      title: "Căn hộ Landmark 81 Vinhomes Central Park",
    });
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
        }),
        expect.objectContaining({
          title: "Căn hộ 2 phòng ngủ Pearl Plaza Bình Thạnh",
        }),
        expect.objectContaining({
          title: "Căn hộ Saigon Pearl Bình Thạnh view sông",
        }),
      ]),
    );
  });

  it("uses nearbyPlaces only when the user asks for proximity", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "tôi muốn thuê căn hộ gần landmark 81, ngân sách dưới 30 triệu, không yêu cầu tiện ích đặc biệt",
      limit: 4,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      parsedBy: "local",
      provider: "local",
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      keywords: [],
      nearbyPlaces: ["Landmark 81"],
      propertyTypes: ["Căn hộ chung cư"],
    });
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["gần Landmark 81"]),
    );
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Căn hộ Landmark 81 Vinhomes Central Park",
        }),
        expect.objectContaining({
          title: "Căn hộ Saigon Pearl Bình Thạnh view sông",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
        }),
      ]),
    );
  });

  it("falls back to local parsing when Gemini cannot parse search intent", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Gemini is unavailable"));

    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm căn hộ 2PN Quận 7 dưới 15 triệu full nội thất",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.parsedBy).toBe("local");
    expect(response.body.data.listings[0]).toMatchObject({
      district: "Quận 7",
      title: "Căn hộ 2PN River Panorama Quận 7 full nội thất",
    });
  });

  it("keeps explicit whole-house intent instead of relaxing to studios", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          amenities: ["máy lạnh"],
          districts: ["Quận Tân Bình"],
          maxPrice: 12000000,
          minPrice: 8000000,
          propertyTypes: ["Căn hộ chung cư"],
        }),
      }),
      ok: true,
      status: 200,
    });

    const response = await request(app).post("/api/ai/search").send({
      message:
        "nhà nguyên căn từ 8 triệu đến 12 triệu đồng tại Tân Bình, ưu tiên máy lạnh.",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.criteria).toMatchObject({
      amenities: ["máy lạnh"],
      districts: ["Quận Tân Bình"],
      maxPrice: 12000000,
      minPrice: 8000000,
    });
    expect(response.body.data.criteria.propertyTypes).toEqual(
      expect.arrayContaining(["Nhà riêng", "Nhà mặt phố"]),
    );
    expect(response.body.data.listings[0]).toMatchObject({
      amenities: expect.arrayContaining(["máy lạnh"]),
      price: 10500000,
      propertyType: "Nhà riêng",
      title: "Nhà nguyên căn Tân Bình 2 phòng ngủ có máy lạnh",
    });
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyType: "Nhà mặt phố",
          title: "Nhà mặt phố Tân Bình nguyên căn có máy lạnh",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Studio Botanica Premier Tân Bình gần sân bay",
        }),
      ]),
    );
    expect(response.body.data.followUpPrompt).toMatchObject({
      kind: "next-search-refinement",
    });
    expect(response.body.data.followUpPrompt.options.length).toBeGreaterThan(0);
    expect(response.body.data.listings[0].matchReasons.length).toBeGreaterThan(
      0,
    );
  });

  it("does not include listings above the explicit maximum budget", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          districts: ["Quận Tân Bình"],
          maxPrice: 10000000,
          minPrice: 5000000,
          propertyTypes: ["Nhà riêng"],
        }),
      }),
      ok: true,
      status: 200,
    });

    const response = await request(app).post("/api/ai/search").send({
      message:
        "Nhà riêng tại tân bình giá rẻ, ngân sách từ 5 đến 10 triệu, không yêu cầu tiện ích đặc biệt.",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
      maxPrice: 10000000,
      minPrice: 5000000,
      propertyTypes: ["Nhà riêng"],
    });
    expect(response.body.data.listings.length).toBeGreaterThan(0);
    expect(
      response.body.data.listings.every((listing) => listing.price <= 10000000),
    ).toBe(true);
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          price: 9800000,
          title: "Nhà riêng Tân Bình gần Etown tầm 10 triệu",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Nhà nguyên căn Tân Bình 2 phòng ngủ có máy lạnh",
        }),
      ]),
    );
  });

  it("treats cheap whole-house intent as under five million", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Nhà nguyên căn giá rẻ tại Tân Bình",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
      maxPrice: 5000000,
    });
    expect(response.body.data.criteria.propertyTypes).toEqual(
      expect.arrayContaining(["Nhà riêng", "Nhà mặt phố"]),
    );
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["≤ 5 triệu/tháng"]),
    );
    expect(response.body.data.listings.length).toBeGreaterThan(0);
    expect(
      response.body.data.listings.every(
        (listing) => listing.price <= 5000000,
      ),
    ).toBe(true);
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          price: 4800000,
          title: "Nhà riêng Tân Bình nhỏ gọn dưới 5 triệu",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Nhà riêng Tân Bình gần Etown tầm 10 triệu",
        }),
      ]),
    );
  });

  it("returns results without requiring amenities when basic criteria are ready", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "Tôi là sinh viên muốn tìm phòng trọ giá dưới 5tr/ tháng ở Thủ Đức",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "TP. Thủ Đức",
          price: expect.any(Number),
          propertyType: "Phòng trọ",
        }),
      ]),
    );
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: false,
      kind: "student-location-detail",
    });
  });

  it("keeps prior location and budget when the user adds a room type later", async () => {
    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: "tìm nhà trọ hoặc phòng trọ giúp tôi",
        previousCriteria: {
          districts: ["TP. Thủ Đức"],
          maxPrice: 5000000,
          minPrice: 3000000,
        },
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 5000000,
      minPrice: 3000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.followUpPrompt).toBeNull();
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "TP. Thủ Đức",
          price: 4900000,
          propertyType: "Phòng trọ",
          title: "Phòng trọ sinh viên Thủ Đức dưới 5 triệu",
        }),
      ]),
    );
  });

  it("treats cheap street-front house intent as under ten million", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Nhà phố giá rẻ tại Tân Bình",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
      maxPrice: 10000000,
      propertyTypes: ["Nhà mặt phố"],
    });
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["Nhà mặt phố", "≤ 10 triệu/tháng"]),
    );
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(
      response.body.data.listings.every((listing) => listing.price <= 10000000),
    ).toBe(true);
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Nhà mặt phố Tân Bình nguyên căn có máy lạnh",
        }),
      ]),
    );
  });

  it("does not confuse District 1 with District 12 when location is added later", async () => {
    const firstResponse = await request(app).post("/api/ai/search").send({
      message: "tìm nhà nguyên căn dưới 10 triệu",
    });

    expect(firstResponse.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(firstResponse.body.data.criteria).toMatchObject({
      maxPrice: 10000000,
    });
    expect(firstResponse.body.data.criteria.propertyTypes).toEqual(
      expect.arrayContaining(["Nhà riêng"]),
    );
    expect(firstResponse.body.data.listings).toHaveLength(0);
    expect(firstResponse.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
    });

    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: "quận 1",
        previousCriteria: firstResponse.body.data.criteria,
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận 1"],
      maxPrice: 10000000,
      propertyTypes: expect.arrayContaining(["Nhà riêng"]),
    });
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "Quận 1",
          price: 9800000,
          title: "Nhà riêng Quận 1 dưới 10 triệu gần Bến Thành",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "Quận 12",
          title: "Nhà riêng Quận 12 2 phòng ngủ có sân để xe",
        }),
      ]),
    );
  });

  it("replaces the previous district when the user enters a new one", async () => {
    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: "quận 1",
        previousCriteria: {
          districts: ["Quận 12"],
          maxPrice: 10000000,
          propertyTypes: ["Nhà riêng"],
        },
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria.districts).toEqual(["Quận 1"]);
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "Quận 1",
          title: "Nhà riêng Quận 1 dưới 10 triệu gần Bến Thành",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "Quận 12",
        }),
      ]),
    );
  });

  it("treats cheap room intent as under two million", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm phòng trọ giá rẻ ở Thủ Đức",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.listings.length).toBeGreaterThan(0);
    expect(
      response.body.data.listings.every((listing) => listing.price <= 2000000),
    ).toBe(true);
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
        }),
        expect.objectContaining({
          title: "Phòng trọ giá rẻ Linh Xuân Thủ Đức có máy lạnh",
        }),
      ]),
    );
  });

  it("accepts a bare budget answer typed by the user during the intake flow", async () => {
    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: "2 triệu",
        previousCriteria: {
          districts: ["TP. Thủ Đức"],
          noAmenityPreference: true,
          propertyTypes: ["Phòng trọ"],
        },
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 2000000,
      noAmenityPreference: true,
    });
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.listings[0]).toMatchObject({
      price: 1800000,
      title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
    });
  });

  it("requires amenities when the user says the listing must have them", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Phòng trọ tại Thủ Đức dưới 2 triệu có máy lạnh",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      maxPrice: 2000000,
      requiredAmenities: ["máy lạnh"],
    });
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["có máy lạnh"]),
    );
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amenities: expect.arrayContaining(["máy lạnh"]),
          price: 1900000,
          title: "Phòng trọ giá rẻ Linh Xuân Thủ Đức có máy lạnh",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
        }),
      ]),
    );
  });

  it("always asks for location first before any other refinement question", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm phòng trọ dưới 2 triệu có máy lạnh",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
    });
    expect(response.body.data.refinementPrompt.question).toContain(
      "quan trọng nhất",
    );
  });

  it("accepts a free-form location answer while waiting for the location question", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Gemini is unavailable"));

    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: "Ở Linh Trung",
        previousCriteria: {
          maxPrice: 2000000,
          noAmenityPreference: true,
          propertyTypes: ["Phòng trọ"],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Linh Trung"],
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
        }),
      ]),
    );
  });

  it("walks a broad student request through location before searching", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          maxPrice: 2000000,
          propertyTypes: ["Phòng trọ"],
        }),
      }),
      ok: true,
      status: 200,
    });

    const locationStep = await request(app).post("/api/ai/search").send({
      message: "Tôi muốn tìm phòng trọ giá rẻ cho sinh viên",
    });

    expect(locationStep.status).toBe(200);
    expect(locationStep.body.data.listings).toHaveLength(0);
    expect(locationStep.body.data.criteria.maxPrice).toBe(2000000);
    expect(locationStep.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
      remainingQuestions: 1,
    });
    expect(locationStep.body.data.refinementPrompt.question).toContain(
      "khu vực",
    );
    expect(locationStep.body.data.refinementPrompt.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criteriaPatch: { districts: ["TP. Thủ Đức"] },
          label: "TP. Thủ Đức",
          message: "Tôi muốn tìm phòng trọ giá rẻ cho sinh viên ở TP. Thủ Đức.",
        }),
      ]),
    );

    const locationOption = locationStep.body.data.refinementPrompt.options.find(
      (option) => option.label === "TP. Thủ Đức",
    );
    const resultStep = await request(app)
      .post("/api/ai/search")
      .send({
        message: locationOption.message,
        previousCriteria: {
          ...locationStep.body.data.criteria,
          ...locationOption.criteriaPatch,
        },
      });

    expect(resultStep.status).toBe(200);
    expect(resultStep.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(resultStep.body.data.refinementPrompt?.blocksSearch).not.toBe(true);
    expect(resultStep.body.data.listings.length).toBeGreaterThan(0);
    expect(resultStep.body.data.listings[0]).toMatchObject({
      district: "TP. Thủ Đức",
      title: "Phòng trọ giá rẻ Linh Trung Thủ Đức gần làng đại học",
    });
    expect(
      resultStep.body.data.listings.every(
        (listing) => listing.price <= 2000000,
      ),
    ).toBe(true);
  });

  it("returns an unsupported message for villa searches", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm biệt thự ở Quận 7 dưới 30 triệu",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận 7"],
      maxPrice: 30000000,
      propertyTypes: ["Biệt thự"],
    });
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.pagination).toMatchObject({
      hasMore: false,
      total: 0,
    });
    expect(response.body.data.reply).toContain(
      "biệt thự hiện chưa được hỗ trợ",
    );
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "unsupported-property-type",
    });
    expect(response.body.data.refinementPrompt.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Phòng trọ" }),
        expect.objectContaining({ label: "Nhà mặt phố" }),
      ]),
    );
  });

  it("does not ask Gemini or infer a location for unsupported cheap villa requests", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tôi muốn tìm biệt thự giá rẻ",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: [],
      propertyTypes: ["Biệt thự"],
    });
    expect(response.body.data.criteria.maxPrice).toBeUndefined();
    expect(response.body.data.reply).toContain(
      "biệt thự hiện chưa được hỗ trợ",
    );
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "unsupported-property-type",
    });
  });

  it("replaces unsupported villa context when the user selects a supported type", async () => {
    const firstResponse = await request(app).post("/api/ai/search").send({
      message: "Tôi muốn tìm biệt thự giá rẻ",
    });
    const roomOption = firstResponse.body.data.refinementPrompt.options.find(
      (option) => option.label === "Phòng trọ",
    );

    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: roomOption.message,
        previousCriteria: {
          ...firstResponse.body.data.criteria,
          propertyTypes: ["Biệt thự", "Phòng trọ"],
        },
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(response.body.data.criteria.propertyTypes).not.toContain("Biệt thự");
    expect(response.body.data.reply).not.toContain("chưa được hỗ trợ");
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
    });
  });

  it("asks for confirmation when a known place is missing its district", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "Tôi đang cần thuê nhà gần khu công nghiệp Tân Tạo giá từ 5-7 triệu, an ninh, gần chợ, điện nước không mắc.",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Bình Tân"],
      maxPrice: 7000000,
      minPrice: 5000000,
      nearbyPlaces: expect.arrayContaining(["KCN Tân Tạo", "Chợ"]),
    });
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "location-confirmation",
      question:
        "Có phải bạn đang tìm nơi ở gần KCN Tân Tạo thuộc Quận Bình Tân, TP. Hồ Chí Minh không?",
    });
    expect(response.body.data.refinementPrompt.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criteriaPatch: expect.objectContaining({
            districts: ["Quận Bình Tân"],
            nearbyPlaces: ["KCN Tân Tạo"],
          }),
          label: "Đúng vậy",
        }),
        expect.objectContaining({
          label: "Không phải",
          resetLocation: true,
        }),
      ]),
    );
  });

  it("keeps prior search context and suggests lower-priced listings when the requested range is empty", async () => {
    const response = await request(app)
      .post("/api/ai/search")
      .send({
        limit: 4,
        message: "Tôi muốn kiếm phòng trọ",
        previousCriteria: {
          amenities: ["bảo vệ", "điện nước giá tốt"],
          districts: ["Quận Bình Tân"],
          maxPrice: 7000000,
          minPrice: 5000000,
          nearbyPlaces: ["KCN Tân Tạo", "Chợ"],
        },
      });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.criteria).toMatchObject({
      districts: ["Quận Bình Tân"],
      maxPrice: 7000000,
      minPrice: 5000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(response.body.data).toMatchObject({
      relaxed: true,
      relaxation: {
        originalMaxPrice: 7000000,
        originalMinPrice: 5000000,
        type: "lower-price",
      },
    });
    expect(response.body.data.reply).toContain("chưa thấy tin đúng khoảng");
    expect(response.body.data.listings.length).toBeGreaterThan(0);
    expect(
      response.body.data.recognizedCriteria.required.length,
    ).toBeGreaterThan(0);
    expect(response.body.data.listings[0].matchReasons.length).toBeGreaterThan(
      0,
    );
    expect(
      response.body.data.listings.every(
        (listing) =>
          listing.district === "Quận Bình Tân" &&
          listing.propertyType === "Phòng trọ" &&
          listing.price < 5000000,
      ),
    ).toBe(true);
    expect(response.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Phòng trọ an ninh gần KCN Tân Tạo Bình Tân có máy lạnh",
        }),
      ]),
    );
    expect(response.body.data.listings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Phòng trọ giá rẻ Bình Tân gần bến xe Miền Tây",
        }),
      ]),
    );
  });

  it("validates required search content", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "",
    });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
