import { describe, expect, it } from "vitest";
import { getSearchSuggestions } from "../src/modules/search/search-suggestion.service.js";

describe("search suggestions", () => {
  it("suggests HCMC street placements without requiring listings", async () => {
    const result = await getSearchSuggestions({
      keyword: "lê thị riêng",
      limit: 10,
    });

    expect(result.items.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Mua bán BĐS tại Đường Lê Thị Riêng, Quận 1, Hồ Chí Minh",
        "Thuê BĐS tại Đường Lê Thị Riêng, Quận 1, Hồ Chí Minh",
        "Mua bán BĐS tại Đường Lê Thị Riêng, Quận 10, Hồ Chí Minh",
      ]),
    );
  });

  it("normalizes street prefixes and accents", async () => {
    const result = await getSearchSuggestions({
      keyword: "duong truong chinh",
      limit: 6,
    });

    expect(result.items.map((item) => item.label)).toContain(
      "Mua bán BĐS tại Đường Trường Chinh, Quận Tân Bình, Hồ Chí Minh",
    );
  });

  it("prioritizes explicit street queries over similar ward names", async () => {
    const result = await getSearchSuggestions({
      keyword: "đường tân quý",
      limit: 10,
    });
    const labels = result.items.map((item) => item.label);

    expect(labels).toEqual([
      "Mua bán BĐS tại Đường Tân Quý, Huyện Bình Chánh, Hồ Chí Minh",
      "Mua bán BĐS tại Đường Tân Quý, Quận Tân Phú, Hồ Chí Minh",
      "Thuê BĐS tại Đường Tân Quý, Huyện Bình Chánh, Hồ Chí Minh",
      "Thuê BĐS tại Đường Tân Quý, Quận Tân Phú, Hồ Chí Minh",
      "Mua bán đất tại Đường Tân Quý, Huyện Bình Chánh, Hồ Chí Minh",
      "Mua bán đất tại Đường Tân Quý, Quận Tân Phú, Hồ Chí Minh",
      "Mua bán BĐS tại Đường Tân Kỳ Tân Quý, Quận Tân Phú, Hồ Chí Minh",
      "Mua bán BĐS tại Đường Tân Kỳ Tân Quý, Quận Bình Tân, Hồ Chí Minh",
      "Mua bán BĐS tại Đường Nguyễn Quý Yêm, Quận Bình Tân, Hồ Chí Minh",
      "Mua bán BĐS tại Đường Phạm Quý Thích, Quận Tân Phú, Hồ Chí Minh",
    ]);
    expect(labels.some((label) => label.includes("Phường Tân Quy"))).toBe(false);
  });
});
