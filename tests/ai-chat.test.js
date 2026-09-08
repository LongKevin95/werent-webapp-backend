import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GEMINI_MODEL = "gemini-3.8-flash";

const { default: app } = await import("../src/app.js");

describe("AI support chat", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        model: "gemini-3.8-flash",
        steps: [
          {
            content: [
              {
                text: "Bạn có thể tìm nhà bằng cách nhập khu vực, ngân sách và tiện ích mong muốn.",
                type: "text",
              },
            ],
            type: "model_output",
          },
        ],
      }),
      ok: true,
      status: 200,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates required message content", async () => {
    const response = await request(app).post("/api/ai/chat").send({
      message: "",
    });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls Gemini with WeRent context and returns the assistant reply", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({
        context: {
          currentView: "home",
          isAuthenticated: false,
          quickAction: "find-home",
        },
        message: "Tôi muốn tìm phòng ở Quận 7 dưới 5 triệu.",
        messages: [
          {
            role: "assistant",
            content: "Xin chào, tôi có thể hỗ trợ gì cho bạn?",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      model: "gemini-3.8-flash",
      provider: "gemini",
    });
    expect(response.body.data.reply).toContain("tìm nhà");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-goog-api-key": "test-gemini-key",
        }),
      }),
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      generation_config: {
        max_output_tokens: 1024,
        temperature: 0.4,
        thinking_level: "low",
      },
      model: "gemini-3.8-flash",
    });
    expect(requestBody.system_instruction).toContain("Trợ lý AI WeRent");
    expect(requestBody.input).toContain("Màn hình hiện tại: home");
    expect(requestBody.input).toContain("Người dùng hiện tại");
  });

  it("returns an actionable message when Gemini rejects the request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: {
          message: "API key not valid. Please pass a valid API key.",
        },
      }),
      ok: false,
      status: 403,
    });

    const response = await request(app).post("/api/ai/chat").send({
      message: "Tôi muốn tìm căn hộ 2 phòng ngủ.",
    });

    expect(response.status).toBe(502);
    expect(response.body.message).toContain("Gemini API key");
    expect(response.body.errors).toMatchObject({
      provider: "gemini",
      providerStatus: 403,
    });
  });
});
