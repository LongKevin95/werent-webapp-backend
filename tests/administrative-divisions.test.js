import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";

const { default: app } = await import("../src/app.js");
const { default: AdministrativeDivision } = await import(
  "../src/modules/administrative-divisions/administrative-division.model.js"
);

let mongoServer;

describe("administrative divisions", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60_000);

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  it("returns seeded provinces with districts and wards", async () => {
    await AdministrativeDivision.create({
      code: 79,
      codename: "thanh_pho_ho_chi_minh",
      dataVersion: "test-version",
      districts: [
        {
          code: 769,
          codename: "quan_2",
          divisionType: "quận",
          name: "Quận 2",
          provinceCode: 79,
          wards: [
            {
              code: 26734,
              codename: "phuong_an_khanh",
              districtCode: 769,
              divisionType: "phường",
              name: "Phường An Khánh",
            },
          ],
        },
      ],
      divisionType: "thành phố trung ương",
      name: "Thành phố Hồ Chí Minh",
      phoneCode: 28,
      source: "provinces.open-api.vn",
      version: "v1",
    });

    const response = await request(app).get("/api/administrative-divisions");

    expect(response.status).toBe(200);
    expect(response.body.data.metadata).toMatchObject({
      districts: 1,
      isSeeded: true,
      provinces: 1,
      version: "v1",
      wards: 1,
    });
    expect(response.body.data.provinces[0]).toMatchObject({
      code: 79,
      name: "Thành phố Hồ Chí Minh",
      districts: [
        {
          code: 769,
          name: "Quận 2",
          wards: [
            {
              code: 26734,
              name: "Phường An Khánh",
            },
          ],
        },
      ],
    });
  });
});
