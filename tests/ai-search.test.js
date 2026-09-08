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

  it("asks for a concrete budget with cheap whole-house ranges before searching", async () => {
    const firstResponse = await request(app).post("/api/ai/search").send({
      message: "Nhà nguyên căn giá rẻ tại Tân Bình",
    });

    expect(firstResponse.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(firstResponse.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
    });
    expect(firstResponse.body.data.criteria.maxPrice).toBeUndefined();
    expect(firstResponse.body.data.criteria.propertyTypes).toEqual(
      expect.arrayContaining(["Nhà riêng", "Nhà mặt phố"]),
    );
    expect(firstResponse.body.data.listings).toHaveLength(0);
    expect(firstResponse.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-budget",
      remainingQuestions: 2,
    });
    expect(firstResponse.body.data.refinementPrompt.options[0]).toMatchObject({
      criteriaPatch: { maxPrice: 5000000 },
      label: "Dưới 5 triệu",
    });

    const budgetOption = firstResponse.body.data.refinementPrompt.options[0];
    const secondResponse = await request(app)
      .post("/api/ai/search")
      .send({
        message: budgetOption.message,
        previousCriteria: {
          ...firstResponse.body.data.criteria,
          ...budgetOption.criteriaPatch,
        },
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.data.criteria).toMatchObject({
      districts: ["Quận Tân Bình"],
      maxPrice: 5000000,
    });
    expect(secondResponse.body.data.listings).toHaveLength(0);
    expect(secondResponse.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-amenities",
      multiSelect: true,
    });

    const skipOption = secondResponse.body.data.refinementPrompt.options.find(
      (option) => option.exclusive,
    );
    const response = await request(app)
      .post("/api/ai/search")
      .send({
        message: skipOption.message,
        previousCriteria: {
          ...secondResponse.body.data.criteria,
          ...skipOption.criteriaPatch,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.refinementPrompt).toBeNull();
    expect(response.body.data.criteriaLabels).toEqual(
      expect.arrayContaining(["≤ 5 triệu/tháng"]),
    );
    expect(response.body.data.listings.length).toBeGreaterThan(0);
    expect(
      response.body.data.listings.every((listing) => listing.price <= 5000000),
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

  it("asks for amenities (multi-select) before returning results when only preferences are missing", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message:
        "Tôi là sinh viên muốn tìm phòng trọ giá dưới 5tr/ tháng ở Thủ Đức",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-amenities",
      multiSelect: true,
      remainingQuestions: 1,
    });
    expect(response.body.data.refinementPrompt.question).toContain("tiện ích");
    expect(response.body.data.refinementPrompt.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criteriaPatch: { amenities: ["máy lạnh"] },
          label: "Máy lạnh",
          value: "máy lạnh",
        }),
        expect.objectContaining({ label: "Full nội thất" }),
        expect.objectContaining({
          criteriaPatch: { noAmenityPreference: true },
          exclusive: true,
          label: "Không yêu cầu thêm",
        }),
      ]),
    );

    const followUp = await request(app)
      .post("/api/ai/search")
      .send({
        message: `${response.body.data.refinementPrompt.messagePrefix}máy lạnh, wifi.`,
        previousCriteria: {
          ...response.body.data.criteria,
          amenities: ["máy lạnh", "wifi"],
        },
      });

    expect(followUp.status).toBe(200);
    expect(followUp.body.data.criteria.amenities).toEqual(
      expect.arrayContaining(["máy lạnh", "wifi"]),
    );
    expect(followUp.body.data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          district: "TP. Thủ Đức",
          price: expect.any(Number),
          propertyType: "Phòng trọ",
        }),
      ]),
    );
    expect(followUp.body.data.refinementPrompt).toMatchObject({
      blocksSearch: false,
      kind: "student-location-detail",
    });
  });

  it("asks for a concrete budget with cheap room ranges instead of assuming two million", async () => {
    const response = await request(app).post("/api/ai/search").send({
      message: "Tìm phòng trọ giá rẻ ở Thủ Đức",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.criteria.maxPrice).toBeUndefined();
    expect(response.body.data.listings).toHaveLength(0);
    expect(response.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-budget",
    });
    expect(response.body.data.refinementPrompt.question).toContain("giá rẻ");
    expect(response.body.data.refinementPrompt.options).toEqual([
      expect.objectContaining({
        criteriaPatch: { maxPrice: 2000000, minPrice: null },
        label: "Dưới 2 triệu",
        message: "Tìm phòng trọ giá rẻ ở Thủ Đức, ngân sách dưới 2 triệu.",
      }),
      expect.objectContaining({ label: "2 - 3 triệu" }),
      expect.objectContaining({ label: "3 - 5 triệu" }),
      expect.objectContaining({ label: "Trên 5 triệu" }),
    ]);
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

  it("walks a broad student request through location, budget and amenities before searching", async () => {
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
    expect(locationStep.body.data.criteria.maxPrice).toBeUndefined();
    expect(locationStep.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-location",
      remainingQuestions: 3,
    });
    expect(locationStep.body.data.reply).toContain("3 thông tin");
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
    const budgetStep = await request(app)
      .post("/api/ai/search")
      .send({
        message: locationOption.message,
        previousCriteria: {
          ...locationStep.body.data.criteria,
          ...locationOption.criteriaPatch,
        },
      });

    expect(budgetStep.status).toBe(200);
    expect(budgetStep.body.data.listings).toHaveLength(0);
    expect(budgetStep.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-budget",
      remainingQuestions: 2,
    });

    const budgetOption = budgetStep.body.data.refinementPrompt.options[0];
    const amenityStep = await request(app)
      .post("/api/ai/search")
      .send({
        message: budgetOption.message,
        previousCriteria: {
          ...budgetStep.body.data.criteria,
          ...budgetOption.criteriaPatch,
        },
      });

    expect(amenityStep.status).toBe(200);
    expect(amenityStep.body.data.listings).toHaveLength(0);
    expect(amenityStep.body.data.criteria).toMatchObject({
      districts: ["TP. Thủ Đức"],
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(amenityStep.body.data.refinementPrompt).toMatchObject({
      blocksSearch: true,
      kind: "missing-amenities",
      multiSelect: true,
      remainingQuestions: 1,
    });

    const amenityOption = amenityStep.body.data.refinementPrompt.options.find(
      (option) => option.value === "máy lạnh",
    );
    const resultStep = await request(app)
      .post("/api/ai/search")
      .send({
        message: amenityOption.message,
        previousCriteria: {
          ...amenityStep.body.data.criteria,
          ...amenityOption.criteriaPatch,
        },
      });

    expect(resultStep.status).toBe(200);
    expect(resultStep.body.data.criteria).toMatchObject({
      amenities: ["máy lạnh"],
      districts: ["TP. Thủ Đức"],
      maxPrice: 2000000,
      propertyTypes: ["Phòng trọ"],
    });
    expect(resultStep.body.data.refinementPrompt?.blocksSearch).not.toBe(true);
    expect(resultStep.body.data.listings.length).toBeGreaterThan(0);
    expect(resultStep.body.data.listings[0]).toMatchObject({
      district: "TP. Thủ Đức",
      title: "Phòng trọ giá rẻ Linh Xuân Thủ Đức có máy lạnh",
    });
    expect(
      resultStep.body.data.listings.every(
        (listing) => listing.price <= 2000000,
      ),
    ).toBe(true);
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
