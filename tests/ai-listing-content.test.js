import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GEMINI_MODEL = "gemini-3.8-flash";
process.env.JWT_SECRET = "integration-test-secret";

const { default: app } = await import("../src/app.js");

const listingContentPayload = {
  address: {
    addressLine: "Toà S5.03",
    city: "TP. Hồ Chí Minh",
    district: "TP. Thủ Đức",
    projectName: "Vinhomes Grand Park",
    street: "Nguyễn Xiển",
    ward: "Phường Long Thạnh Mỹ",
  },
  amenities: ["Máy lạnh", "Thang máy", "Hồ bơi"],
  property: {
    area: "69",
    bathrooms: "2",
    bedrooms: "2",
    furnishing: "Đầy đủ nội thất",
    propertyType: "Căn hộ chung cư",
    rentPrice: "12000000",
  },
  tone: "Lịch sự",
};

describe("AI listing content generation", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("returns five sanitized title suggestions from Gemini", async () => {
    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          titles: [
            "Cho thuê căn hộ 2PN full nội thất tại Vinhomes Grand Park",
            "  Căn hộ 2 phòng ngủ view đẹp gần metro Thủ Đức  ",
            "Cho thuê căn hộ 2PN full nội thất tại Vinhomes Grand Park",
            "Căn hộ cao cấp 69m² tại Vinhomes Grand Park - Giá tốt",
            "Căn hộ 2PN an ninh 24/7, hồ bơi, thang máy tại Thủ Đức",
            "Tiêu đề dư thừa thứ sáu sẽ bị cắt",
          ],
        }),
      }),
      ok: true,
      status: 200,
    });

    const response = await request(app).post("/api/ai/listing-content").send({
      ...listingContentPayload,
      mode: "title",
    });

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.body.data).toMatchObject({
      mode: "title",
      provider: "gemini",
      tone: "Lịch sự",
    });
    expect(response.body.data.titles).toHaveLength(5);
    expect(response.body.data.titles[1]).toBe(
      "Căn hộ 2 phòng ngủ view đẹp gần metro Thủ Đức",
    );
    expect(
      response.body.data.titles.every((title) => title.length <= 100),
    ).toBe(true);

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.input).toContain("Căn hộ chung cư");
    expect(requestBody.input).toContain("Vinhomes Grand Park");
    expect(requestBody.input).toContain("Lịch sự");
  });

  it("returns a generated description from Gemini", async () => {
    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: JSON.stringify({
          description:
            "Cho thuê căn hộ 2 phòng ngủ tại Vinhomes Grand Park.\n\nCăn hộ có diện tích 69m² với đầy đủ nội thất.\n\nLiên hệ ngay để xem nhà.",
        }),
      }),
      ok: true,
      status: 200,
    });

    const response = await request(app).post("/api/ai/listing-content").send({
      ...listingContentPayload,
      mode: "description",
      tone: "Nhiệt tình",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      mode: "description",
      provider: "gemini",
      tone: "Nhiệt tình",
    });
    expect(response.body.data.description).toContain("Vinhomes Grand Park");
    expect(response.body.data.titles).toBeUndefined();

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.input).toContain("Nhiệt tình");
  });

  it("rejects requests without a property type", async () => {
    const response = await request(app).post("/api/ai/listing-content").send({
      mode: "title",
      property: { area: "20" },
    });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid mode", async () => {
    const response = await request(app).post("/api/ai/listing-content").send({
      ...listingContentPayload,
      mode: "poem",
    });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("surfaces provider errors when Gemini returns malformed content", async () => {
    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        output_text: "không phải json",
      }),
      ok: true,
      status: 200,
    });

    const response = await request(app).post("/api/ai/listing-content").send({
      ...listingContentPayload,
      mode: "title",
    });

    expect(response.status).toBe(502);
  });
});
