import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("health endpoints", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("WeRent API is running");
  });

  it("returns root status", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("WeRent Modular Monolith API");
  });
});
