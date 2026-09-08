import ApiError from "../../common/ApiError.js";
import {
  PROPERTY_PACKAGE_TIER,
  PROPERTY_STATUS,
} from "../../common/constants.js";
import env from "../../config/env.js";
import Property from "../properties/property.model.js";

const GEMINI_INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEVELOPMENT_GEMINI_CACHE_TTL_MS = 10 * 60 * 1000;
const DEVELOPMENT_GEMINI_CACHE_MAX_SIZE = 80;
const DEVELOPMENT_GEMINI_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

const SUPPORT_CHAT_PRESET = Object.freeze({
  maxOutputTokens: env.GEMINI_CHAT_MAX_OUTPUT_TOKENS,
  temperature: 0.4,
  thinkingLevel: env.GEMINI_THINKING_LEVEL,
  timeoutMs: env.GEMINI_CHAT_TIMEOUT_MS,
});

const PROPERTY_SEARCH_PRESET = Object.freeze({
  maxOutputTokens: env.GEMINI_SEARCH_MAX_OUTPUT_TOKENS,
  temperature: 0.1,
  thinkingLevel: env.GEMINI_THINKING_LEVEL,
  timeoutMs: env.GEMINI_SEARCH_TIMEOUT_MS,
});
const CHEAP_ROOM_MAX_PRICE = 2_000_000;
const CHEAP_WHOLE_HOUSE_MAX_PRICE = 5_000_000;
const PROPERTY_SEARCH_PAGE_SIZE = 5;
const geminiResponseCache = new Map();
let geminiRateLimitedUntil = 0;

const SUPPORT_CHAT_SYSTEM_INSTRUCTION = `
Bạn là Trợ lý AI WeRent, hỗ trợ người dùng thuê nhà và chủ nhà đăng tin trên nền tảng WeRent.

Nhiệm vụ chính:
- Trả lời bằng tiếng Việt tự nhiên, rõ ràng, thân thiện và ngắn gọn.
- Hỗ trợ các chủ đề: tìm nhà/phòng/căn hộ, đăng tin cho thuê, KYC tài khoản, xác thực tin đăng, ví WeRent, thanh toán gói đăng tin, yêu thích tin, báo cáo tin sai phạm.
- Khi người dùng muốn tìm nhà, hãy hỏi các tiêu chí quan trọng như khu vực, ngân sách, loại nhà, số phòng ngủ, nội thất, ngày vào ở, tiện ích và nơi cần ở gần.
- Khi người dùng hỏi về đăng tin, nhắc rằng tài khoản cần đăng nhập và KYC được duyệt trước khi đăng tin.
- Khi người dùng hỏi KYC, hướng dẫn vào hồ sơ tài khoản, cập nhật thông tin, tải giấy tờ và chờ admin duyệt.

Nguyên tắc an toàn:
- Không yêu cầu người dùng gửi mật khẩu, API key, số thẻ ngân hàng, mã OTP hoặc ảnh giấy tờ cá nhân trong chat.
- Không khẳng định chắc chắn về pháp lý, thanh toán hoặc độ an toàn của một tin đăng nếu không có dữ liệu xác thực.
- Nếu thiếu thông tin, hãy hỏi tối đa một câu hỏi làm rõ.
- Nếu câu hỏi nằm ngoài WeRent, vẫn có thể trả lời ngắn nhưng nên kéo về nhu cầu thuê/đăng tin khi phù hợp.
`.trim();

const PROPERTY_SEARCH_SYSTEM_INSTRUCTION = `
Bạn là bộ phân tích nhu cầu tìm bất động sản cho thuê của WeRent.
Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích.

Schema:
{
  "propertyTypes": ["Căn hộ chung cư" | "Phòng trọ" | "Nhà riêng" | "Nhà mặt phố" | "Biệt thự" | "Văn phòng" | "Mặt bằng" | "Đất nền"],
  "districts": ["Quận 7"],
  "city": "TP. Hồ Chí Minh",
  "minPrice": 0,
  "maxPrice": 15000000,
  "minArea": 0,
  "maxArea": 0,
  "minBedrooms": 2,
  "minBathrooms": 0,
  "amenities": ["full nội thất", "máy lạnh"],
  "requiredAmenities": ["máy lạnh"],
  "nearbyPlaces": ["RMIT", "Lotte Mart"],
  "keywords": ["Sunrise City"]
}

Quy đổi mọi giá tiền sang VND/tháng. Ví dụ "15 triệu" là 15000000.
Nếu người dùng nói "phòng trọ giá rẻ" mà không nêu ngân sách cụ thể, hiểu là tối đa 2 triệu/tháng.
Nếu người dùng nói "nhà nguyên căn", "nhà riêng" hoặc "nhà mặt phố" kèm "giá rẻ" mà không nêu ngân sách cụ thể, hiểu là tối đa 5 triệu/tháng.
Chỉ đưa địa điểm vào nearbyPlaces khi câu có từ chỉ khoảng cách như "gần", "sát", "lân cận", "thuận tiện đến", "liền kề", "cạnh". Nếu người dùng nói "trong khu", "tại", "ở" một dự án/địa danh thì đưa vào keywords.
Tiện ích trong requiredAmenities là các tiện ích người dùng nói bắt buộc/cần/có/phải có. Tiện ích trong amenities là ưu tiên mềm.
Bỏ trống field bằng null hoặc [] nếu người dùng không nêu rõ.
`.trim();

const PROPERTY_TYPE_ALIASES = Object.freeze([
  {
    aliases: ["can ho", "can ho chung cu", "chung cu", "apartment", "2pn", "3pn"],
    value: "Căn hộ chung cư",
  },
  {
    aliases: ["phong tro", "nha tro", "phong cho thue", "tro"],
    value: "Phòng trọ",
  },
  {
    aliases: ["nha rieng", "nha nguyen can", "nguyen can"],
    value: "Nhà riêng",
  },
  {
    aliases: ["nha mat pho", "nha mat tien", "mat tien", "nha nguyen can", "nguyen can"],
    value: "Nhà mặt phố",
  },
  {
    aliases: ["biet thu", "villa"],
    value: "Biệt thự",
  },
  {
    aliases: ["van phong", "office"],
    value: "Văn phòng",
  },
  {
    aliases: ["mat bang", "shop", "cua hang", "kinh doanh"],
    value: "Mặt bằng",
  },
  {
    aliases: ["dat nen", "dat", "kho bai", "lam kho"],
    value: "Đất nền",
  },
]);

const DISTRICT_ALIASES = Object.freeze([
  { aliases: ["quan 1", "q1", "district 1"], value: "Quận 1" },
  { aliases: ["quan 2", "q2", "district 2", "thu thiem", "thao dien"], value: "TP. Thủ Đức" },
  { aliases: ["quan 3", "q3", "district 3"], value: "Quận 3" },
  { aliases: ["quan 4", "q4", "district 4"], value: "Quận 4" },
  { aliases: ["quan 5", "q5", "district 5"], value: "Quận 5" },
  { aliases: ["quan 6", "q6", "district 6"], value: "Quận 6" },
  { aliases: ["quan 7", "q7", "district 7", "phu my hung"], value: "Quận 7" },
  { aliases: ["quan 8", "q8", "district 8"], value: "Quận 8" },
  { aliases: ["quan 9", "q9", "district 9", "grand park"], value: "TP. Thủ Đức" },
  { aliases: ["quan 10", "q10", "district 10"], value: "Quận 10" },
  { aliases: ["quan 11", "q11", "district 11"], value: "Quận 11" },
  { aliases: ["quan 12", "q12", "district 12"], value: "Quận 12" },
  { aliases: ["binh thanh", "hang xanh"], value: "Quận Bình Thạnh" },
  { aliases: ["binh tan", "ten lua"], value: "Quận Bình Tân" },
  { aliases: ["go vap"], value: "Quận Gò Vấp" },
  { aliases: ["phu nhuan"], value: "Quận Phú Nhuận" },
  { aliases: ["tan binh", "san bay"], value: "Quận Tân Bình" },
  { aliases: ["tan phu"], value: "Quận Tân Phú" },
  { aliases: ["thu duc", "tp thu duc", "thanh pho thu duc"], value: "TP. Thủ Đức" },
  { aliases: ["nha be"], value: "Huyện Nhà Bè" },
  { aliases: ["binh chanh"], value: "Huyện Bình Chánh" },
  { aliases: ["hoc mon"], value: "Huyện Hóc Môn" },
  { aliases: ["cu chi"], value: "Huyện Củ Chi" },
]);

const AMENITY_ALIASES = Object.freeze([
  {
    aliases: ["full noi that", "day du noi that", "noi that day du", "noi that full"],
    queryTerms: ["full nội thất", "đầy đủ nội thất", "nội thất đầy đủ"],
    value: "full nội thất",
  },
  {
    aliases: ["noi that co ban", "co noi that"],
    queryTerms: ["nội thất cơ bản", "có nội thất"],
    value: "nội thất cơ bản",
  },
  { aliases: ["may lanh", "dieu hoa"], queryTerms: ["máy lạnh", "điều hòa"], value: "máy lạnh" },
  { aliases: ["wifi", "internet"], queryTerms: ["wifi", "internet"], value: "wifi" },
  { aliases: ["ho boi", "pool"], queryTerms: ["hồ bơi", "pool"], value: "hồ bơi" },
  { aliases: ["gym", "phong gym"], queryTerms: ["gym", "phòng gym"], value: "gym" },
  { aliases: ["bai xe", "cho de xe", "ham xe"], queryTerms: ["bãi xe", "chỗ để xe", "hầm xe"], value: "bãi xe" },
  { aliases: ["bao ve", "an ninh"], queryTerms: ["bảo vệ", "an ninh"], value: "bảo vệ" },
  {
    aliases: ["dien nuoc", "dien nuoc gia re", "dien nuoc khong mac", "gia dien nuoc"],
    queryTerms: ["điện nước", "giá điện", "giá nước"],
    value: "điện nước giá tốt",
  },
  { aliases: ["camera"], queryTerms: ["camera"], value: "camera" },
  { aliases: ["ban cong"], queryTerms: ["ban công"], value: "ban công" },
  { aliases: ["thang may"], queryTerms: ["thang máy"], value: "thang máy" },
  { aliases: ["gac lung"], queryTerms: ["gác lửng"], value: "gác lửng" },
  { aliases: ["gara", "garage"], queryTerms: ["gara", "garage"], value: "gara" },
  { aliases: ["san vuon"], queryTerms: ["sân vườn"], value: "sân vườn" },
  { aliases: ["thu cung", "pet"], queryTerms: ["thú cưng", "pet"], value: "cho nuôi thú cưng" },
  { aliases: ["view song"], queryTerms: ["view sông"], value: "view sông" },
]);

const NEARBY_PLACE_ALIASES = Object.freeze([
  { aliases: ["rmit", "dai hoc rmit"], value: "RMIT" },
  { aliases: ["hutech", "dai hoc hutech"], value: "Đại học Hutech" },
  { aliases: ["ton duc thang", "tdtu"], value: "Tôn Đức Thắng" },
  { aliases: ["lotte mart"], value: "Lotte Mart" },
  { aliases: ["crescent mall"], value: "Crescent Mall" },
  { aliases: ["aeon mall", "aeon"], value: "Aeon Mall" },
  { aliases: ["ben thanh", "cho ben thanh"], value: "Chợ Bến Thành" },
  { aliases: ["hang xanh"], value: "Hàng Xanh" },
  { aliases: ["landmark", "landmark 81"], value: "Landmark 81" },
  {
    aliases: ["kcn tan tao", "khu cong nghiep tan tao", "cong nghiep tan tao"],
    value: "KCN Tân Tạo",
  },
  { aliases: ["sala"], value: "Khu Sala" },
  { aliases: ["thao dien"], value: "Thảo Điền" },
  { aliases: ["san bay", "tan son nhat"], value: "Sân bay Tân Sơn Nhất" },
  { aliases: ["metro an phu", "an phu"], value: "Metro An Phú" },
  { aliases: ["ba chieu", "cho ba chieu"], value: "Chợ Bà Chiểu" },
  { aliases: ["phu my hung"], value: "Phú Mỹ Hưng" },
]);
const LOCATION_CONFIRMATION_DEFINITIONS = Object.freeze([
  {
    aliases: ["kcn tan tao", "khu cong nghiep tan tao", "cong nghiep tan tao"],
    city: "TP. Hồ Chí Minh",
    district: "Quận Bình Tân",
    label: "KCN Tân Tạo",
    nearbyPlace: "KCN Tân Tạo",
  },
]);
const NEARBY_PLACE_PROXIMITY_TERMS = Object.freeze([
  "gan",
  "sat",
  "lan can",
  "thuan tien den",
  "thuan tien di",
  "thuan thien den",
  "lien ke",
  "canh",
]);

function assertGeminiConfigured() {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
    throw new ApiError(
      503,
      "Trợ lý AI chưa được cấu hình. Vui lòng kiểm tra Gemini API trong backend.",
    );
  }
}

function isGeminiConfigured() {
  return Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL);
}

function isDevelopmentGeminiCacheEnabled() {
  return env.NODE_ENV === "development";
}

function buildGeminiCacheKey({
  input,
  maxOutputTokens,
  systemInstruction,
  temperature,
  thinkingLevel,
}) {
  return JSON.stringify({
    input,
    maxOutputTokens,
    model: env.GEMINI_MODEL,
    systemInstruction,
    temperature,
    thinkingLevel,
  });
}

function getCachedGeminiResponse(cacheKey) {
  if (!isDevelopmentGeminiCacheEnabled()) {
    return null;
  }

  const cachedResponse = geminiResponseCache.get(cacheKey);

  if (!cachedResponse) {
    return null;
  }

  if (cachedResponse.expiresAt <= Date.now()) {
    geminiResponseCache.delete(cacheKey);
    return null;
  }

  return {
    ...cachedResponse.value,
    cached: true,
  };
}

function setCachedGeminiResponse(cacheKey, value) {
  if (!isDevelopmentGeminiCacheEnabled()) {
    return;
  }

  if (geminiResponseCache.size >= DEVELOPMENT_GEMINI_CACHE_MAX_SIZE) {
    const oldestKey = geminiResponseCache.keys().next().value;
    geminiResponseCache.delete(oldestKey);
  }

  geminiResponseCache.set(cacheKey, {
    expiresAt: Date.now() + DEVELOPMENT_GEMINI_CACHE_TTL_MS,
    value,
  });
}

function isDevelopmentGeminiRateLimitCooldownEnabled() {
  return env.NODE_ENV === "development";
}

function getGeminiRateLimitCooldownSeconds() {
  if (geminiRateLimitedUntil <= Date.now()) {
    return 0;
  }

  return Math.ceil((geminiRateLimitedUntil - Date.now()) / 1000);
}

function createGeminiRateLimitCooldownError() {
  return new ApiError(
    429,
    "Gemini đang bị giới hạn quota hoặc tốc độ gọi API. Backend đang tạm dùng chế độ dự phòng để giảm request trong lúc test.",
    {
      details: {
        provider: "gemini",
        providerMessage:
          "Skipped Gemini request during development cooldown after provider rate limit.",
        providerStatus: 429,
        retryAfterSeconds: getGeminiRateLimitCooldownSeconds(),
      },
    },
  );
}

function assertGeminiRateLimitCooldown() {
  if (
    isDevelopmentGeminiRateLimitCooldownEnabled() &&
    geminiRateLimitedUntil > Date.now()
  ) {
    throw createGeminiRateLimitCooldownError();
  }
}

function rememberGeminiRateLimit(response) {
  if (
    isDevelopmentGeminiRateLimitCooldownEnabled() &&
    response.status === 429
  ) {
    geminiRateLimitedUntil =
      Date.now() + DEVELOPMENT_GEMINI_RATE_LIMIT_COOLDOWN_MS;
  }
}

function buildContextText(context = {}) {
  const entries = [
    ["Màn hình hiện tại", context.currentView],
    [
      "Đã đăng nhập",
      context.isAuthenticated === undefined
        ? undefined
        : context.isAuthenticated
          ? "có"
          : "không",
    ],
    ["Trạng thái KYC", context.kycStatus],
    ["Hành động nhanh", context.quickAction],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (!entries.length) {
    return "";
  }

  return [
    "Ngữ cảnh giao diện hiện tại:",
    ...entries.map(([label, value]) => `- ${label}: ${value}`),
  ].join("\n");
}

function buildHistoryText(messages = []) {
  const sanitizedHistory = messages
    .filter((item) => ["user", "assistant"].includes(item.role))
    .slice(-10)
    .map((item) => {
      const speaker = item.role === "assistant" ? "Trợ lý" : "Người dùng";
      return `${speaker}: ${item.content}`;
    });

  if (!sanitizedHistory.length) {
    return "";
  }

  return ["Lịch sử hội thoại gần đây:", ...sanitizedHistory].join("\n");
}

function buildGeminiInput({ context, message, messages }) {
  return [
    buildContextText(context),
    buildHistoryText(messages),
    `Người dùng hiện tại: ${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function readGeminiError(response) {
  const payload = await response.json().catch(() => null);

  return (
    payload?.error?.message ||
    payload?.message ||
    `Gemini API returned ${response.status}`
  );
}

function getGeminiFailureMessage(response, providerMessage) {
  if (response.status === 400) {
    return `Gemini từ chối request hiện tại. Vui lòng kiểm tra model ${env.GEMINI_MODEL} hoặc cấu hình prompt.`;
  }

  if (response.status === 401 || response.status === 403) {
    return "Gemini API key không hợp lệ, hết quyền hoặc project chưa bật Gemini API. Vui lòng kiểm tra lại cấu hình AI.";
  }

  if (response.status === 404 || /model/i.test(providerMessage)) {
    return `Không tìm thấy model ${env.GEMINI_MODEL}. Vui lòng kiểm tra lại GEMINI_MODEL trong backend.`;
  }

  if (response.status === 429) {
    return "Gemini đang bị giới hạn quota hoặc tốc độ gọi API. Vui lòng thử lại sau ít phút.";
  }

  return "Trợ lý AI đang bận. Vui lòng thử lại sau ít phút.";
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return { controller, timeout };
}

function extractTextFromInteractionStep(step) {
  if (!Array.isArray(step?.content)) {
    return [];
  }

  return step.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean);
}

function extractGeminiReply(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const modelOutputSteps = Array.isArray(payload?.steps)
    ? payload.steps.filter((step) => step?.type === "model_output")
    : [];
  const textParts = modelOutputSteps.flatMap(extractTextFromInteractionStep);

  return textParts.join("\n\n").trim();
}

async function requestGeminiInteraction({
  input,
  maxOutputTokens,
  systemInstruction,
  temperature,
  thinkingLevel,
  timeoutMs,
}) {
  assertGeminiConfigured();

  const cacheKey = buildGeminiCacheKey({
    input,
    maxOutputTokens,
    systemInstruction,
    temperature,
    thinkingLevel,
  });
  const cachedResponse = getCachedGeminiResponse(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  assertGeminiRateLimitCooldown();

  const { controller, timeout } = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      body: JSON.stringify({
        generation_config: {
          max_output_tokens: maxOutputTokens,
          temperature,
          thinking_level: thinkingLevel,
        },
        input,
        model: env.GEMINI_MODEL,
        system_instruction: systemInstruction,
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      rememberGeminiRateLimit(response);

      const providerMessage = await readGeminiError(response);
      const statusCode = response.status === 429 ? 429 : 502;

      throw new ApiError(
        statusCode,
        getGeminiFailureMessage(response, providerMessage),
        {
          details: {
            provider: "gemini",
            providerMessage,
            providerStatus: response.status,
          },
        },
      );
    }

    const result = await response.json();
    const reply = extractGeminiReply(result);

    if (!reply) {
      throw new ApiError(
        502,
        "Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.",
      );
    }

    const resultPayload = {
      model: result?.model ?? env.GEMINI_MODEL,
      provider: "gemini",
      reply,
    };

    setCachedGeminiResponse(cacheKey, resultPayload);

    return resultPayload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(504, "Trợ lý AI phản hồi quá lâu. Vui lòng thử lại.");
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      502,
      "Không thể kết nối Trợ lý AI lúc này. Vui lòng thử lại sau.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNormalizedTerm(source, term) {
  const normalizedSource = ` ${normalizeText(source)} `;
  const normalizedTerm = normalizeText(term).replace(/\s+/g, " ");

  if (!normalizedTerm) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedTerm).replace(/\s+/g, "\\s+")}($|[^a-z0-9])`,
  );

  return pattern.test(normalizedSource);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function uniqueValues(values = []) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const normalizedValue = String(value ?? "").trim();
    const key = normalizeText(normalizedValue);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalizedValue);
  });

  return result;
}

function collectAliasMatches(values, rawText, definitions) {
  const sources = [rawText, ...toArray(values)].filter(Boolean);
  const matches = [];

  definitions.forEach((definition) => {
    const terms = [definition.value, ...definition.aliases];
    const hasMatch = sources.some((source) =>
      terms.some((term) => hasNormalizedTerm(source, term)),
    );

    if (hasMatch) {
      matches.push(definition.value);
    }
  });

  return matches;
}

function hasNearbyPlaceIntent(rawText = "") {
  return NEARBY_PLACE_PROXIMITY_TERMS.some((term) =>
    hasNormalizedTerm(rawText, term),
  );
}

function collectNearbyPlaceMatches(rawText) {
  if (!hasNearbyPlaceIntent(rawText)) {
    return [];
  }

  return uniqueValues([
    ...collectAliasMatches([], rawText, NEARBY_PLACE_ALIASES),
    ...(hasNormalizedTerm(rawText, "gan cho") ? ["Chợ"] : []),
  ]);
}

function collectProjectKeywordMatches(rawText) {
  return hasNearbyPlaceIntent(rawText)
    ? []
    : collectAliasMatches([], rawText, NEARBY_PLACE_ALIASES);
}

function collectKnownLocationMatches(rawText) {
  return LOCATION_CONFIRMATION_DEFINITIONS.filter((definition) =>
    definition.aliases.some((alias) => hasNormalizedTerm(rawText, alias)),
  );
}

function collectKnownLocationDistrictMatches(rawText) {
  return collectKnownLocationMatches(rawText).map(
    (definition) => definition.district,
  );
}

function collectKnownLocationNearbyPlaceMatches(rawText) {
  if (!hasNearbyPlaceIntent(rawText)) {
    return [];
  }

  return collectKnownLocationMatches(rawText).map(
    (definition) => definition.nearbyPlace,
  );
}

function hasExplicitDistrictForKnownLocation(rawText, definition) {
  return getDefinitionTerms(definition.district, DISTRICT_ALIASES).some((term) =>
    hasNormalizedTerm(rawText, term),
  );
}

function buildLocationConfirmationPrompt(message) {
  const definition = collectKnownLocationMatches(message).find(
    (item) => !hasExplicitDistrictForKnownLocation(message, item),
  );

  if (!definition) {
    return null;
  }

  return {
    blocksSearch: true,
    kind: "location-confirmation",
    options: [
      {
        criteriaPatch: {
          city: definition.city,
          districts: [definition.district],
          nearbyPlaces: [definition.nearbyPlace],
        },
        label: "Đúng vậy",
        message: `Đúng vậy, tôi muốn tìm gần ${definition.label} thuộc ${definition.district}, ${definition.city}.`,
      },
      {
        label: "Không phải",
        message: "Không phải. Tôi muốn nhập khu vực khác.",
        resetLocation: true,
      },
    ],
    question: `Có phải bạn đang tìm nơi ở gần ${definition.label} thuộc ${definition.district}, ${definition.city} không?`,
  };
}

function isRequiredAmenityMention(rawText, definition) {
  const normalizedText = normalizeText(rawText);
  const terms = uniqueValues([
    definition.value,
    ...(definition.queryTerms ?? []),
    ...definition.aliases,
  ]).map(normalizeText);

  return terms.some((term) => {
    if (!term) {
      return false;
    }

    const requiredPattern = new RegExp(
      `(?:\\b(?:co|can|phai co|bat buoc|yeu cau)\\b[^,.]{0,40})${escapeRegExp(term)}`,
    );
    const negativePattern = new RegExp(
      `(?:\\b(?:khong can|khong co|khong bat buoc)\\b[^,.]{0,40})${escapeRegExp(term)}`,
    );

    return requiredPattern.test(normalizedText) && !negativePattern.test(normalizedText);
  });
}

function collectRequiredAmenityMatches(rawText) {
  return AMENITY_ALIASES.filter((definition) =>
    isRequiredAmenityMention(rawText, definition),
  ).map((definition) => definition.value);
}

function sanitizeFreeFormValues(values, maxItems = 6) {
  return uniqueValues(toArray(values))
    .filter((value) => value.length <= 80 && !/[{}[\]]/.test(value))
    .slice(0, maxItems);
}

function normalizeMoneyValue(value, fallbackUnit = "triệu") {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }

    return Math.round(value < 10_000 ? value * 1_000_000 : value);
  }

  const normalizedValue = normalizeText(value);
  const match = normalizedValue.match(
    /(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|ty|ti|b|nghin|k)?/,
  );

  if (!match) {
    return undefined;
  }

  return parseMoneyMatch(match[1], match[2] || fallbackUnit);
}

function parseMoneyMatch(amountText, unit = "triệu") {
  const amount = Number(String(amountText).replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  const normalizedUnit = normalizeText(unit);

  if (["ty", "ti", "b"].includes(normalizedUnit)) {
    return Math.round(amount * 1_000_000_000);
  }

  if (["nghin", "k"].includes(normalizedUnit)) {
    return Math.round(amount * 1_000);
  }

  return Math.round(amount * 1_000_000);
}

function normalizeNumberValue(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizeIntegerValue(value) {
  const number = normalizeNumberValue(value);

  return number === undefined ? undefined : Math.round(number);
}

function parsePriceCriteria(normalizedMessage) {
  const criteria = {};
  const rangeMatch = normalizedMessage.match(
    /(?:tu|khoang|tam)\s+(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|ty|ti|b)?\s*(?:den|toi|-)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|ty|ti|b)?/,
  );

  if (rangeMatch) {
    const fallbackUnit = rangeMatch[4] || rangeMatch[2] || "trieu";
    criteria.minPrice = parseMoneyMatch(rangeMatch[1], rangeMatch[2] || fallbackUnit);
    criteria.maxPrice = parseMoneyMatch(rangeMatch[3], rangeMatch[4] || fallbackUnit);
    return criteria;
  }

  const maxMatch = normalizedMessage.match(
    /(?:duoi|toi da|khong qua|nho hon|<=|<|ngan sach|budget|tam gia)\s*(?:la|khoang)?\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|ty|ti|b)?/,
  );

  if (maxMatch) {
    criteria.maxPrice = parseMoneyMatch(maxMatch[1], maxMatch[2] || "trieu");
  }

  const minMatch = normalizedMessage.match(
    /(?:tren|tu|toi thieu|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|ty|ti|b)/,
  );

  if (minMatch) {
    criteria.minPrice = parseMoneyMatch(minMatch[1], minMatch[2]);
  }

  return criteria;
}

function parseBudgetShortcutCriteria(normalizedMessage) {
  const mentionsCheap = hasNormalizedTerm(normalizedMessage, "gia re");
  if (!mentionsCheap) {
    return {};
  }

  const mentionsRoom = ["phong tro", "nha tro", "tro"].some((term) =>
    hasNormalizedTerm(normalizedMessage, term),
  );
  const mentionsWholeHouse = [
    "nha nguyen can",
    "nguyen can",
    "nha rieng",
    "nha mat pho",
    "nha mat tien",
  ].some((term) => hasNormalizedTerm(normalizedMessage, term));

  if (mentionsRoom) {
    return {
      maxPrice: CHEAP_ROOM_MAX_PRICE,
    };
  }

  if (mentionsWholeHouse) {
    return {
      maxPrice: CHEAP_WHOLE_HOUSE_MAX_PRICE,
    };
  }

  return {};
}

function parseAreaCriteria(normalizedMessage) {
  const criteria = {};
  const rangeMatch = normalizedMessage.match(
    /(?:tu|khoang)\s+(\d+(?:[.,]\d+)?)\s*(?:m2|m vuong)?\s*(?:den|toi|-)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m vuong)/,
  );

  if (rangeMatch) {
    criteria.minArea = normalizeNumberValue(rangeMatch[1]);
    criteria.maxArea = normalizeNumberValue(rangeMatch[2]);
    return criteria;
  }

  const maxMatch = normalizedMessage.match(
    /(?:duoi|toi da|khong qua)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m vuong)/,
  );

  if (maxMatch) {
    criteria.maxArea = normalizeNumberValue(maxMatch[1]);
  }

  const minMatch = normalizedMessage.match(
    /(?:tren|tu|toi thieu)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m vuong)/,
  );

  if (minMatch) {
    criteria.minArea = normalizeNumberValue(minMatch[1]);
  }

  return criteria;
}

function parseRoomCriteria(normalizedMessage) {
  const criteria = {};
  const bedroomMatch = normalizedMessage.match(
    /(\d+)\s*(?:phong ngu|phong|pn|bedroom|bed)\b/,
  );
  const bathroomMatch = normalizedMessage.match(
    /(\d+)\s*(?:phong tam|wc|toilet|bathroom)\b/,
  );

  if (bedroomMatch) {
    criteria.minBedrooms = normalizeIntegerValue(bedroomMatch[1]);
  }

  if (bathroomMatch) {
    criteria.minBathrooms = normalizeIntegerValue(bathroomMatch[1]);
  }

  return criteria;
}

function parseLocalPropertySearchCriteria(message) {
  const normalizedMessage = normalizeText(message);

  return normalizeSearchCriteria(
    {
      ...parseBudgetShortcutCriteria(normalizedMessage),
      ...parsePriceCriteria(normalizedMessage),
      ...parseAreaCriteria(normalizedMessage),
      ...parseRoomCriteria(normalizedMessage),
      amenities: collectAliasMatches([], message, AMENITY_ALIASES),
      districts: [
        ...collectAliasMatches([], message, DISTRICT_ALIASES),
        ...collectKnownLocationDistrictMatches(message),
      ],
      keywords: collectProjectKeywordMatches(message),
      nearbyPlaces: [
        ...collectNearbyPlaceMatches(message),
        ...collectKnownLocationNearbyPlaceMatches(message),
      ],
      propertyTypes: collectAliasMatches([], message, PROPERTY_TYPE_ALIASES),
      requiredAmenities: collectRequiredAmenityMatches(message),
    },
    message,
  );
}

function hasUsefulLocalPropertySearchCriteria(criteria) {
  const hasSearchSubject =
    criteria.propertyTypes.length > 0 || criteria.keywords.length > 0;
  const hasSearchConstraint = hasLocalSearchConstraint(criteria);

  return hasSearchSubject && hasSearchConstraint;
}

function hasLocalSearchConstraint(criteria) {
  return Boolean(
    criteria.districts.length ||
      criteria.keywords.length ||
      criteria.nearbyPlaces.length ||
      criteria.amenities.length ||
      criteria.requiredAmenities.length ||
      criteria.minBedrooms !== undefined ||
      criteria.minBathrooms !== undefined ||
      criteria.minPrice ||
      criteria.maxPrice ||
      criteria.minArea ||
      criteria.maxArea,
  );
}

function hasAnyLocalPropertySearchCriteria(criteria) {
  return Boolean(
    criteria.propertyTypes.length ||
      criteria.keywords.length ||
      hasLocalSearchConstraint(criteria),
  );
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeSearchCriteria(criteria = {}, rawText = "", options = {}) {
  const allowsNearbyPlaces =
    options.preserveNearbyPlaces || hasNearbyPlaceIntent(rawText);
  const rawNearbyPlaces = uniqueValues([
    ...collectAliasMatches(criteria.nearbyPlaces, "", NEARBY_PLACE_ALIASES),
    ...sanitizeFreeFormValues(criteria.nearbyPlaces, 8),
  ]).slice(0, 8);
  const propertyTypes = uniqueValues([
    ...collectAliasMatches(criteria.propertyTypes, rawText, PROPERTY_TYPE_ALIASES),
    ...sanitizeFreeFormValues(criteria.propertyTypes, 3),
  ]).slice(0, 3);
  const districts = uniqueValues([
    ...collectAliasMatches(criteria.districts, rawText, DISTRICT_ALIASES),
    ...sanitizeFreeFormValues(criteria.districts, 3),
  ]).slice(0, 3);
  const amenities = uniqueValues([
    ...collectAliasMatches(criteria.amenities, rawText, AMENITY_ALIASES),
    ...sanitizeFreeFormValues(criteria.amenities, 8),
  ]).slice(0, 8);
  const requiredAmenities = uniqueValues([
    ...collectAliasMatches(criteria.requiredAmenities, "", AMENITY_ALIASES),
    ...sanitizeFreeFormValues(criteria.requiredAmenities, 8),
  ]).slice(0, 8);
  const nearbyPlaces = allowsNearbyPlaces ? rawNearbyPlaces : [];
  const keywords = uniqueValues([
    ...sanitizeFreeFormValues(criteria.keywords, 6),
    ...(allowsNearbyPlaces ? [] : rawNearbyPlaces),
  ]).slice(0, 6);

  return {
    amenities,
    city: sanitizeFreeFormValues(criteria.city, 1)[0] ?? "",
    districts,
    keywords,
    maxArea: normalizeNumberValue(criteria.maxArea),
    maxPrice: normalizeMoneyValue(criteria.maxPrice),
    minArea: normalizeNumberValue(criteria.minArea),
    minBathrooms: normalizeIntegerValue(criteria.minBathrooms),
    minBedrooms: normalizeIntegerValue(criteria.minBedrooms),
    minPrice: normalizeMoneyValue(criteria.minPrice),
    nearbyPlaces,
    propertyTypes,
    requiredAmenities,
  };
}

function normalizePreviousSearchCriteria(criteria = {}) {
  return normalizeSearchCriteria(criteria, "", {
    preserveNearbyPlaces: true,
  });
}

function mergeSearchCriteria(previousCriteria = {}, currentCriteria = {}) {
  const previous = normalizePreviousSearchCriteria(previousCriteria);
  const current = normalizeSearchCriteria(currentCriteria, "", {
    preserveNearbyPlaces: true,
  });
  const hasCurrentLocation =
    current.districts.length || current.keywords.length || current.nearbyPlaces.length;

  return normalizeSearchCriteria(
    {
      amenities: uniqueValues([...previous.amenities, ...current.amenities]),
      city: current.city || previous.city,
      districts: current.districts.length
        ? current.districts
        : hasCurrentLocation
          ? []
          : previous.districts,
      keywords: current.keywords.length
        ? current.keywords
        : hasCurrentLocation
          ? []
          : previous.keywords,
      maxArea: current.maxArea ?? previous.maxArea,
      maxPrice: current.maxPrice ?? previous.maxPrice,
      minArea: current.minArea ?? previous.minArea,
      minBathrooms: current.minBathrooms ?? previous.minBathrooms,
      minBedrooms: current.minBedrooms ?? previous.minBedrooms,
      minPrice: current.minPrice ?? previous.minPrice,
      nearbyPlaces: current.nearbyPlaces.length
        ? current.nearbyPlaces
        : hasCurrentLocation
          ? []
          : previous.nearbyPlaces,
      propertyTypes: current.propertyTypes.length
        ? current.propertyTypes
        : previous.propertyTypes,
      requiredAmenities: uniqueValues([
        ...previous.requiredAmenities,
        ...current.requiredAmenities,
      ]),
    },
    "",
    { preserveNearbyPlaces: true },
  );
}

function hasPreviousSearchCriteria(criteria = {}) {
  const normalizedCriteria = normalizePreviousSearchCriteria(criteria);

  return Boolean(
    normalizedCriteria.amenities.length ||
      normalizedCriteria.city ||
      normalizedCriteria.districts.length ||
      normalizedCriteria.keywords.length ||
      normalizedCriteria.maxArea ||
      normalizedCriteria.maxPrice ||
      normalizedCriteria.minArea ||
      normalizedCriteria.minBathrooms ||
      normalizedCriteria.minBedrooms ||
      normalizedCriteria.minPrice ||
      normalizedCriteria.nearbyPlaces.length ||
      normalizedCriteria.propertyTypes.length ||
      normalizedCriteria.requiredAmenities.length,
  );
}

async function parsePropertySearchCriteria(message, options = {}) {
  const localCriteria = parseLocalPropertySearchCriteria(message);

  if (
    hasUsefulLocalPropertySearchCriteria(localCriteria) ||
    hasLocalSearchConstraint(localCriteria) ||
    (options.allowPartialLocalCriteria &&
      hasAnyLocalPropertySearchCriteria(localCriteria))
  ) {
    return {
      criteria: localCriteria,
      parsedBy: "local",
    };
  }

  if (!isGeminiConfigured()) {
    return {
      criteria: localCriteria,
      parsedBy: "local",
    };
  }

  try {
    const response = await requestGeminiInteraction({
      input: message,
      maxOutputTokens: PROPERTY_SEARCH_PRESET.maxOutputTokens,
      systemInstruction: PROPERTY_SEARCH_SYSTEM_INSTRUCTION,
      temperature: PROPERTY_SEARCH_PRESET.temperature,
      thinkingLevel: PROPERTY_SEARCH_PRESET.thinkingLevel,
      timeoutMs: PROPERTY_SEARCH_PRESET.timeoutMs,
    });
    const parsedJson = extractJsonObject(response.reply);

    if (!parsedJson) {
      return {
        criteria: localCriteria,
        parsedBy: "local",
      };
    }

    const criteria = normalizeSearchCriteria(
      {
        ...parsedJson,
        maxArea: localCriteria.maxArea ?? parsedJson.maxArea,
        maxPrice: localCriteria.maxPrice ?? parsedJson.maxPrice,
        minArea: localCriteria.minArea ?? parsedJson.minArea,
        minBathrooms:
          localCriteria.minBathrooms ?? parsedJson.minBathrooms,
        minBedrooms: localCriteria.minBedrooms ?? parsedJson.minBedrooms,
        minPrice: localCriteria.minPrice ?? parsedJson.minPrice,
        amenities: [
          ...toArray(parsedJson.amenities),
          ...toArray(localCriteria.amenities),
        ],
        districts: localCriteria.districts.length
          ? localCriteria.districts
          : toArray(parsedJson.districts),
        nearbyPlaces: [
          ...toArray(parsedJson.nearbyPlaces),
          ...toArray(localCriteria.nearbyPlaces),
        ],
        keywords: [
          ...toArray(parsedJson.keywords),
          ...toArray(localCriteria.keywords),
        ],
        propertyTypes: localCriteria.propertyTypes.length
          ? localCriteria.propertyTypes
          : toArray(parsedJson.propertyTypes),
        requiredAmenities: [
          ...toArray(parsedJson.requiredAmenities),
          ...toArray(localCriteria.requiredAmenities),
        ],
      },
      message,
    );

    return {
      criteria,
      parsedBy: "gemini",
    };
  } catch {
    return {
      criteria: localCriteria,
      parsedBy: "local",
    };
  }
}

function createRegexConditions(fields, values) {
  return values.flatMap((value) => {
    const pattern = escapeRegExp(value);

    return fields.map((field) => ({
      [field]: { $options: "i", $regex: pattern },
    }));
  });
}

function buildPropertySearchFilter(criteria) {
  const filters = {
    status: PROPERTY_STATUS.ACTIVE,
  };
  const andConditions = [];

  if (criteria.districts.length) {
    andConditions.push({
      $or: createRegexConditions(
        ["district", "address", "formattedAddress"],
        criteria.districts,
      ),
    });
  }

  if (criteria.city) {
    andConditions.push({
      $or: createRegexConditions(["city", "address", "formattedAddress"], [
        criteria.city,
      ]),
    });
  }

  if (criteria.propertyTypes.length) {
    andConditions.push({
      $or: createRegexConditions(["propertyType", "title"], criteria.propertyTypes),
    });
  }

  if (criteria.nearbyPlaces.length) {
    criteria.nearbyPlaces.forEach((place) => {
      andConditions.push({
        $or: createRegexConditions(
          [
            "nearbyPlaces",
            "projectName",
            "title",
            "locationNote",
            "address",
            "formattedAddress",
            "description",
          ],
          getDefinitionTerms(place, NEARBY_PLACE_ALIASES),
        ),
      });
    });
  }

  if (criteria.keywords.length) {
    criteria.keywords.forEach((keyword) => {
      andConditions.push({
        $or: createRegexConditions(
          [
            "projectName",
            "title",
            "locationNote",
            "address",
            "formattedAddress",
            "description",
          ],
          [keyword],
        ),
      });
    });
  }

  if (criteria.requiredAmenities.length) {
    criteria.requiredAmenities.forEach((amenity) => {
      andConditions.push({
        $or: createRegexConditions(
          ["amenities", "furnishing", "title", "description"],
          getDefinitionTerms(amenity, AMENITY_ALIASES),
        ),
      });
    });
  }

  if (criteria.minPrice || criteria.maxPrice) {
    filters.price = {};

    if (criteria.minPrice) {
      filters.price.$gte = criteria.minPrice;
    }

    if (criteria.maxPrice) {
      filters.price.$lte = criteria.maxPrice;
    }
  }

  if (criteria.minArea || criteria.maxArea) {
    filters.area = {};

    if (criteria.minArea) {
      filters.area.$gte = criteria.minArea;
    }

    if (criteria.maxArea) {
      filters.area.$lte = criteria.maxArea;
    }
  }

  if (criteria.minBedrooms !== undefined) {
    filters.bedrooms = { $gte: criteria.minBedrooms };
  }

  if (criteria.minBathrooms !== undefined) {
    filters.bathrooms = { $gte: criteria.minBathrooms };
  }

  if (andConditions.length) {
    filters.$and = andConditions;
  }

  return filters;
}

function getDefinitionTerms(value, definitions) {
  const normalizedValue = normalizeText(value);
  const definition = definitions.find(
    (item) =>
      normalizeText(item.value) === normalizedValue ||
      item.aliases.some((alias) => normalizeText(alias) === normalizedValue),
  );

  if (!definition) {
    return [value];
  }

  return uniqueValues([
    definition.value,
    ...(definition.queryTerms ?? []),
    ...definition.aliases,
  ]);
}

function buildSearchablePropertyText(property) {
  return normalizeText(
    [
      property.title,
      property.propertyType,
      property.description,
      property.address,
      property.formattedAddress,
      property.city,
      property.district,
      property.ward,
      property.street,
      property.projectName,
      property.locationNote,
      property.furnishing,
      ...(property.amenities ?? []),
      ...(property.nearbyPlaces ?? []),
    ].join(" "),
  );
}

function countMatches(searchableText, values, definitions = []) {
  return values.reduce((count, value) => {
    const terms = definitions.length ? getDefinitionTerms(value, definitions) : [value];
    const hasMatch = terms.some((term) => hasNormalizedTerm(searchableText, term));

    return hasMatch ? count + 1 : count;
  }, 0);
}

function getMatchedValues(searchableText, values, definitions = []) {
  return values.filter((value) => {
    const terms = definitions.length ? getDefinitionTerms(value, definitions) : [value];

    return terms.some((term) => hasNormalizedTerm(searchableText, term));
  });
}

function calculatePriceFitScore(property, criteria) {
  if (!criteria.maxPrice || !property.price) {
    return 0;
  }

  const remainingBudget = criteria.maxPrice - property.price;

  if (remainingBudget < 0) {
    return 0;
  }

  const ratio = remainingBudget / criteria.maxPrice;

  if (ratio <= 0.08) {
    return 10;
  }

  if (ratio <= 0.25) {
    return 14;
  }

  return 12;
}

function scoreProperty(property, criteria) {
  const searchableText = buildSearchablePropertyText(property);
  let score = 0;

  score += countMatches(searchableText, criteria.districts) * 28;
  score += countMatches(searchableText, criteria.propertyTypes) * 22;
  score += countMatches(searchableText, criteria.requiredAmenities, AMENITY_ALIASES) * 16;
  score += countMatches(searchableText, criteria.amenities, AMENITY_ALIASES) * 12;
  score += countMatches(searchableText, criteria.nearbyPlaces, NEARBY_PLACE_ALIASES) * 10;
  score += countMatches(searchableText, criteria.keywords) * 8;
  score += calculatePriceFitScore(property, criteria);

  if (
    criteria.minBedrooms !== undefined &&
    Number(property.bedrooms ?? 0) >= criteria.minBedrooms
  ) {
    score += 12;
  }

  if (
    criteria.minBathrooms !== undefined &&
    Number(property.bathrooms ?? 0) >= criteria.minBathrooms
  ) {
    score += 6;
  }

  if (property.isFeatured) {
    score += 4;
  }

  if (property.package?.tier === PROPERTY_PACKAGE_TIER.VIP_GOLD) {
    score += 3;
  }

  return score;
}

function formatMonthlyPrice(price) {
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
    return "Thỏa thuận";
  }

  const millionValue = Number(price) / 1_000_000;
  const formattedValue = Number.isInteger(millionValue)
    ? millionValue.toString()
    : millionValue.toFixed(1).replace(/\.0$/, "");

  return `${formattedValue} triệu/tháng`;
}

function buildLocationLabel(property) {
  return [property.district, property.city].filter(Boolean).join(", ");
}

function buildBudgetRangeLabel(criteria) {
  if (criteria.minPrice && criteria.maxPrice) {
    return `${formatMonthlyPrice(criteria.minPrice)} - ${formatMonthlyPrice(criteria.maxPrice)}`;
  }

  if (criteria.maxPrice) {
    return `dưới ${formatMonthlyPrice(criteria.maxPrice)}`;
  }

  if (criteria.minPrice) {
    return `từ ${formatMonthlyPrice(criteria.minPrice)}`;
  }

  return "";
}

function buildPropertyMatchReasons(property, criteria) {
  const searchableText = buildSearchablePropertyText(property);
  const reasons = [];
  const matchedDistricts = getMatchedValues(searchableText, criteria.districts);
  const matchedTypes = getMatchedValues(searchableText, criteria.propertyTypes);
  const matchedNearbyPlaces = getMatchedValues(
    searchableText,
    criteria.nearbyPlaces,
    NEARBY_PLACE_ALIASES,
  );
  const matchedKeywords = getMatchedValues(searchableText, criteria.keywords);
  const matchedRequiredAmenities = getMatchedValues(
    searchableText,
    criteria.requiredAmenities,
    AMENITY_ALIASES,
  );
  const matchedAmenities = getMatchedValues(
    searchableText,
    criteria.amenities,
    AMENITY_ALIASES,
  ).filter(
    (amenity) =>
      !matchedRequiredAmenities.some(
        (requiredAmenity) =>
          normalizeText(requiredAmenity) === normalizeText(amenity),
      ),
  );

  if (matchedDistricts.length) {
    reasons.push(`Đúng khu vực ${matchedDistricts.slice(0, 2).join(", ")}`);
  }

  if (matchedKeywords.length) {
    reasons.push(`Đúng địa danh/dự án ${matchedKeywords.slice(0, 2).join(", ")}`);
  }

  if (matchedNearbyPlaces.length) {
    reasons.push(`Gần ${matchedNearbyPlaces.slice(0, 2).join(", ")}`);
  }

  if (matchedTypes.length) {
    reasons.push(`Đúng loại hình ${property.propertyType}`);
  }

  if (criteria.minPrice && Number(property.price) < criteria.minPrice) {
    reasons.push(`Giá thấp hơn khoảng ${buildBudgetRangeLabel(criteria)}`);
  } else if (
    (criteria.minPrice || criteria.maxPrice) &&
    (!criteria.minPrice || Number(property.price) >= criteria.minPrice) &&
    (!criteria.maxPrice || Number(property.price) <= criteria.maxPrice)
  ) {
    reasons.push(`Giá phù hợp ${buildBudgetRangeLabel(criteria)}`);
  }

  if (matchedRequiredAmenities.length) {
    reasons.push(`Có ${matchedRequiredAmenities.slice(0, 2).join(", ")}`);
  }

  if (matchedAmenities.length) {
    reasons.push(`Có/ưu tiên ${matchedAmenities.slice(0, 2).join(", ")}`);
  }

  if (
    criteria.minBedrooms !== undefined &&
    Number(property.bedrooms ?? 0) >= criteria.minBedrooms
  ) {
    reasons.push(`Đáp ứng từ ${criteria.minBedrooms} phòng ngủ`);
  }

  if (!reasons.length && property.price) {
    reasons.push(`Giá thuê ${formatMonthlyPrice(property.price)}`);
  }

  return uniqueValues(reasons).slice(0, 4);
}

function serializeSearchProperty(property, criteria) {
  return {
    address: property.address,
    amenities: (property.amenities ?? []).slice(0, 4),
    area: property.area ?? 0,
    bathrooms: property.bathrooms ?? 0,
    bedrooms: property.bedrooms ?? 0,
    city: property.city ?? "",
    district: property.district ?? "",
    furnishing: property.furnishing ?? "",
    id: property._id.toString(),
    imageUrl: property.images?.[0]?.url ?? "",
    isFeatured: Boolean(property.isFeatured),
    location: buildLocationLabel(property),
    matchReasons: buildPropertyMatchReasons(property, criteria),
    nearbyPlaces: (property.nearbyPlaces ?? []).slice(0, 4),
    price: property.price,
    priceLabel: formatMonthlyPrice(property.price),
    projectName: property.projectName ?? "",
    propertyType: property.propertyType,
    title: property.title,
  };
}

function buildCriteriaLabels(criteria) {
  const requiredAmenityKeys = new Set(
    criteria.requiredAmenities.map((amenity) => normalizeText(amenity)),
  );
  const softAmenities = criteria.amenities.filter(
    (amenity) => !requiredAmenityKeys.has(normalizeText(amenity)),
  );
  const labels = [
    ...criteria.propertyTypes,
    ...criteria.districts,
    criteria.maxPrice ? `≤ ${formatMonthlyPrice(criteria.maxPrice)}` : "",
    criteria.minPrice ? `≥ ${formatMonthlyPrice(criteria.minPrice)}` : "",
    criteria.minBedrooms ? `≥ ${criteria.minBedrooms}PN` : "",
    criteria.minBathrooms ? `≥ ${criteria.minBathrooms}WC` : "",
    criteria.minArea ? `≥ ${criteria.minArea}m²` : "",
    criteria.maxArea ? `≤ ${criteria.maxArea}m²` : "",
    ...criteria.requiredAmenities.map((amenity) => `có ${amenity}`),
    ...softAmenities,
    ...criteria.keywords,
    ...criteria.nearbyPlaces.map((place) => `gần ${place}`),
  ].filter(Boolean);

  return uniqueValues(labels).slice(0, 8);
}

function buildRecognizedCriteria(criteria) {
  const requiredAmenityKeys = new Set(
    criteria.requiredAmenities.map((amenity) => normalizeText(amenity)),
  );
  const softAmenities = criteria.amenities.filter(
    (amenity) => !requiredAmenityKeys.has(normalizeText(amenity)),
  );
  const budgetLabel = buildBudgetRangeLabel(criteria);
  const requiredLabels = [
    ...criteria.propertyTypes,
    ...criteria.districts,
    ...criteria.keywords.map((keyword) => `Trong ${keyword}`),
    ...criteria.nearbyPlaces.map((place) => `Gần ${place}`),
    budgetLabel,
    criteria.minBedrooms ? `Từ ${criteria.minBedrooms} phòng ngủ` : "",
    criteria.minBathrooms ? `Từ ${criteria.minBathrooms} WC` : "",
    criteria.minArea ? `Từ ${criteria.minArea}m²` : "",
    criteria.maxArea ? `Dưới ${criteria.maxArea}m²` : "",
    ...criteria.requiredAmenities.map((amenity) => `Cần ${amenity}`),
  ].filter(Boolean);

  return {
    preferences: uniqueValues(softAmenities).slice(0, 6),
    required: uniqueValues(requiredLabels).slice(0, 10),
  };
}

function buildRefinementOptions(message, options) {
  const baseMessage = message.trim().replace(/[.?!]+$/, "");

  return options.map((label) => ({
    label,
    message: `${baseMessage}, ưu tiên ${label.toLowerCase()}.`,
  }));
}

function buildLocationRefinementOptions(message, options) {
  const baseMessage = message.trim().replace(/[.?!]+$/, "");

  return options.map((label) => ({
    label,
    message: `${baseMessage} ở ${label}.`,
  }));
}

function buildBudgetRefinementOptions(message) {
  const baseMessage = message.trim().replace(/[.?!]+$/, "");

  return [
    {
      label: "Dưới 5 triệu",
      message: `${baseMessage}, ngân sách dưới 5 triệu.`,
    },
    {
      label: "5-10 triệu",
      message: `${baseMessage}, ngân sách từ 5 đến 10 triệu.`,
    },
    {
      label: "10-15 triệu",
      message: `${baseMessage}, ngân sách từ 10 đến 15 triệu.`,
    },
    {
      label: "Trên 15 triệu",
      message: `${baseMessage}, ngân sách trên 15 triệu.`,
    },
  ];
}

function buildTypeRefinementOptions(message, options) {
  const baseMessage = message.trim().replace(/[.?!]+$/, "");

  return options.map((label) => ({
    label,
    message: `${baseMessage}, loại ${label.toLowerCase()}.`,
  }));
}

function hasCriteriaValue(values = [], targetValue) {
  const normalizedTargetValue = normalizeText(targetValue);

  return values.some(
    (value) => normalizeText(value) === normalizedTargetValue,
  );
}

function buildSearchFollowUpPrompt(criteria, message) {
  const baseMessage = message.trim().replace(/[.?!]+$/, "");
  const options = [];
  const allAmenities = [...criteria.amenities, ...criteria.requiredAmenities];

  if (!hasCriteriaValue(criteria.requiredAmenities, "máy lạnh")) {
    options.push({
      criteriaPatch: {
        requiredAmenities: ["máy lạnh"],
      },
      label: "Chỉ có máy lạnh",
      message: `${baseMessage}, bắt buộc có máy lạnh.`,
    });
  }

  if (!hasCriteriaValue(criteria.requiredAmenities, "bãi xe")) {
    options.push({
      criteriaPatch: {
        requiredAmenities: ["bãi xe"],
      },
      label: "Có chỗ để xe",
      message: `${baseMessage}, bắt buộc có chỗ để xe máy.`,
    });
  }

  if (!hasCriteriaValue(allAmenities, "full nội thất")) {
    options.push({
      criteriaPatch: {
        amenities: ["full nội thất"],
      },
      label: "Full nội thất",
      message: `${baseMessage}, ưu tiên full nội thất.`,
    });
  }

  if (
    !hasCriteriaValue(allAmenities, "bảo vệ") &&
    !hasCriteriaValue(allAmenities, "camera")
  ) {
    options.push({
      criteriaPatch: {
        amenities: ["bảo vệ", "camera"],
      },
      label: "An ninh tốt hơn",
      message: `${baseMessage}, ưu tiên bảo vệ hoặc camera an ninh.`,
    });
  }

  if (
    criteria.districts.length &&
    !hasCriteriaValue(criteria.nearbyPlaces, "Chợ")
  ) {
    options.push({
      criteriaPatch: {
        nearbyPlaces: ["Chợ"],
      },
      label: "Gần chợ hơn",
      message: `${baseMessage}, ưu tiên gần chợ.`,
    });
  }

  if (!options.length) {
    return null;
  }

  return {
    blocksSearch: false,
    kind: "next-search-refinement",
    options: options.slice(0, 5),
    question: "Bạn muốn lọc tiếp theo tiêu chí nào?",
  };
}

function buildSearchRefinementPrompt(criteria, message) {
  const locationConfirmationPrompt = buildLocationConfirmationPrompt(message);

  if (locationConfirmationPrompt) {
    return locationConfirmationPrompt;
  }

  if (!criteria.districts.length) {
    return {
      blocksSearch: false,
      kind: "missing-location",
      options: buildLocationRefinementOptions(message, [
        "Quận 7",
        "TP. Thủ Đức",
        "Bình Thạnh",
        "Gò Vấp",
      ]),
      question:
        "Bạn muốn tìm ở khu vực nào hoặc muốn ở gần địa điểm nào để mình lọc chính xác hơn?",
    };
  }

  if (!criteria.maxPrice && !criteria.minPrice) {
    return {
      blocksSearch: false,
      kind: "missing-budget",
      options: buildBudgetRefinementOptions(message),
      question:
        "Ngân sách thuê mỗi tháng của bạn khoảng bao nhiêu, và có giới hạn tiền cọc không?",
    };
  }

  if (!criteria.propertyTypes.length) {
    return {
      blocksSearch: true,
      kind: "missing-property-type",
      options: buildTypeRefinementOptions(message, [
        "Phòng trọ",
        "Căn hộ chung cư",
        "Nhà riêng",
        "Mặt bằng",
      ]),
      question:
        "Bạn muốn ưu tiên loại chỗ ở nào: phòng trọ, căn hộ, nhà riêng hay loại khác?",
    };
  }

  if (!criteria.amenities.length && !criteria.requiredAmenities.length) {
    return {
      blocksSearch: false,
      kind: "missing-amenities",
      options: buildRefinementOptions(message, [
        "Nội thất cơ bản",
        "Đầy đủ nội thất",
        "Máy lạnh",
        "Chỗ để xe máy",
        "Bảo vệ",
      ]),
      question:
        "Bạn có muốn ưu tiên nội thất hoặc có tiện ích nào không? Chẳng hạn nội thất cơ bản hoặc đầy đủ, máy lạnh, chỗ để xe máy, bảo vệ.",
    };
  }

  const mentionsStudent = hasNormalizedTerm(message, "sinh viên");

  if (mentionsStudent && !criteria.nearbyPlaces.length) {
    return {
      blocksSearch: false,
      kind: "student-location-detail",
      options: buildRefinementOptions(message, [
        "Gần trường học",
        "Gần trạm xe buýt",
        "Khu an ninh",
        "Giờ giấc tự do",
      ]),
      question:
        "Bạn muốn phòng gần trường/khu nào ở khu vực đó, hay ưu tiên đi lại và giờ giấc tự do hơn?",
    };
  }

  return null;
}

function buildRelaxedSearchText(relaxation) {
  if (relaxation?.type === "lower-price") {
    return ` Mình chưa thấy tin đúng khoảng ${formatMonthlyPrice(relaxation.originalMinPrice)} - ${formatMonthlyPrice(relaxation.originalMaxPrice)}; bên dưới là các tin giá thấp hơn nhưng vẫn bám các tiêu chí còn lại.`;
  }

  return " Mình đã mở rộng nhẹ tiêu chí để có thêm lựa chọn.";
}

function buildSearchReply({
  criteria,
  items,
  pagination,
  relaxed,
  refinementPrompt,
  relaxation,
}) {
  const criteriaLabels = buildCriteriaLabels(criteria);
  const criteriaText = criteriaLabels.length
    ? ` theo tiêu chí: ${criteriaLabels.join(", ")}`
    : "";
  const refinementText = refinementPrompt
    ? " Mình có thể lọc sát hơn nếu bạn bổ sung thêm một vài ưu tiên bên dưới."
    : "";

  if (refinementPrompt?.blocksSearch) {
    const recapText = criteriaLabels.length
      ? `Mình đã ghi nhận các tiêu chí: ${criteriaLabels.join(", ")}. `
      : "";

    return `${recapText}Mình cần xác nhận thêm một thông tin để lọc kết quả chính xác hơn.`;
  }

  if (items.length) {
    const relaxedText = relaxed ? buildRelaxedSearchText(relaxation) : "";
    const total = pagination?.total ?? items.length;
    const displayedCount = pagination
      ? Math.min(pagination.offset + items.length, total)
      : items.length;
    const displayText =
      total > items.length || pagination?.offset
        ? ` Mình đang hiển thị ${displayedCount}/${total} tin phù hợp nhất bên dưới.`
        : " Bạn có thể xem nhanh các tin phù hợp bên dưới.";

    return `Mình tìm thấy ${total} tin đang hoạt động trong database WeRent${criteriaText}.${relaxedText}${displayText}${refinementText}`;
  }

  return `Mình chưa tìm thấy tin đang hoạt động nào khớp${criteriaText}. Bạn thử nới ngân sách, mở rộng khu vực hoặc bỏ bớt tiện ích ưu tiên nhé.${refinementText}`;
}

function isDevelopmentGeminiRateLimitError(error) {
  return (
    env.NODE_ENV === "development" &&
    error instanceof ApiError &&
    error.statusCode === 429 &&
    error.details?.provider === "gemini"
  );
}

function buildLocalSupportFallbackReply(message = "") {
  const normalizedMessage = normalizeText(message);
  const prefix =
    "Gemini đang bị giới hạn quota/tốc độ trong môi trường test, nên mình trả lời bằng chế độ local của WeRent.";

  if (
    hasNormalizedTerm(normalizedMessage, "kyc") ||
    hasNormalizedTerm(normalizedMessage, "xac thuc")
  ) {
    return `${prefix}\n\nĐể xác thực KYC, bạn vào hồ sơ cá nhân, chọn xác thực tài khoản, điền thông tin và tải giấy tờ theo hướng dẫn. Sau khi gửi, hệ thống sẽ chờ admin duyệt và thông báo kết quả trong app.`;
  }

  if (
    hasNormalizedTerm(normalizedMessage, "dang tin") ||
    hasNormalizedTerm(normalizedMessage, "cho thue")
  ) {
    return `${prefix}\n\nĐể đăng tin cho thuê, bạn cần đăng nhập, hoàn tất KYC, sau đó vào mục Đăng tin và nhập thông tin bất động sản như địa chỉ, giá thuê, diện tích, tiện ích, ảnh và gói hiển thị.`;
  }

  if (
    hasNormalizedTerm(normalizedMessage, "vi") ||
    hasNormalizedTerm(normalizedMessage, "nap tien") ||
    hasNormalizedTerm(normalizedMessage, "thanh toan")
  ) {
    return `${prefix}\n\nVới ví WeRent, bạn có thể nạp tiền để thanh toán gói đăng tin hoặc các dịch vụ hiển thị. Nếu giao dịch chưa cập nhật, hãy kiểm tra lịch sử thanh toán hoặc thử đồng bộ lại sau vài phút.`;
  }

  if (
    hasNormalizedTerm(normalizedMessage, "tim nha") ||
    hasNormalizedTerm(normalizedMessage, "tim phong") ||
    hasNormalizedTerm(normalizedMessage, "thue nha")
  ) {
    return `${prefix}\n\nĐể tìm nhà chính xác hơn, bạn nên nhập khu vực, ngân sách, loại nhà và tiện ích cần có. Ví dụ: “Phòng trọ giá rẻ tại Thủ Đức có máy lạnh” hoặc “Nhà nguyên căn giá rẻ tại Tân Bình”.`;
  }

  return `${prefix}\n\nBạn vẫn có thể test các luồng phổ biến như tìm nhà bằng ngôn ngữ tự nhiên, KYC, đăng tin, ví/thanh toán và câu hỏi FAQ. Khi Gemini có credit trở lại, chatbot sẽ tự dùng lại phản hồi AI.`;
}

async function findSearchCandidates(criteria) {
  const filters = buildPropertySearchFilter(criteria);

  return Property.find(filters)
    .sort({ isFeatured: -1, createdAt: -1 })
    .lean();
}

function rankSearchCandidates(candidates, criteria) {
  return candidates
    .map((property) => ({
      property,
      score: scoreProperty(property, criteria),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (Number(left.property.price) !== Number(right.property.price)) {
        return Number(left.property.price) - Number(right.property.price);
      }

      return new Date(right.property.createdAt) - new Date(left.property.createdAt);
    })
    .map(({ property }) => property);
}

function paginateSearchCandidates(candidates, criteria, limit, offset) {
  const rankedProperties = rankSearchCandidates(candidates, criteria);
  const total = rankedProperties.length;
  const safeOffset = Math.min(offset, total);
  const items = rankedProperties
    .slice(safeOffset, safeOffset + limit)
    .map((property) => serializeSearchProperty(property, criteria));
  const nextOffset = safeOffset + items.length;

  return {
    items,
    pagination: {
      hasMore: nextOffset < total,
      limit,
      nextOffset,
      offset: safeOffset,
      total,
    },
  };
}

async function searchProperties(criteria, limit, offset) {
  const candidates = await findSearchCandidates(criteria);
  const result = paginateSearchCandidates(candidates, criteria, limit, offset);

  if (result.items.length || result.pagination.total) {
    return { ...result, relaxation: null, relaxed: false };
  }

  if (criteria.minPrice && criteria.maxPrice) {
    const relaxedCriteria = {
      ...criteria,
      minPrice: undefined,
    };
    const relaxedCandidates = await findSearchCandidates(relaxedCriteria);
    const relaxedResult = paginateSearchCandidates(
      relaxedCandidates,
      criteria,
      limit,
      offset,
    );

    if (relaxedResult.items.length || relaxedResult.pagination.total) {
      return {
        ...relaxedResult,
        relaxation: {
          originalMaxPrice: criteria.maxPrice,
          originalMinPrice: criteria.minPrice,
          type: "lower-price",
        },
        relaxed: true,
      };
    }
  }

  return {
    items: [],
    pagination: {
      hasMore: false,
      limit,
      nextOffset: offset,
      offset,
      total: 0,
    },
    relaxation: null,
    relaxed: false,
  };
}

export async function createSupportChatCompletion(payload) {
  try {
    const result = await requestGeminiInteraction({
      input: buildGeminiInput(payload),
      maxOutputTokens: SUPPORT_CHAT_PRESET.maxOutputTokens,
      systemInstruction: SUPPORT_CHAT_SYSTEM_INSTRUCTION,
      temperature: SUPPORT_CHAT_PRESET.temperature,
      thinkingLevel: SUPPORT_CHAT_PRESET.thinkingLevel,
      timeoutMs: SUPPORT_CHAT_PRESET.timeoutMs,
    });

    return {
      cached: Boolean(result.cached),
      model: result.model,
      provider: result.provider,
      reply: result.reply,
    };
  } catch (error) {
    if (isDevelopmentGeminiRateLimitError(error)) {
      return {
        fallback: true,
        fallbackReason: "gemini-rate-limited",
        model: null,
        provider: "local",
        reply: buildLocalSupportFallbackReply(payload.message),
        retryAfterSeconds: error.details?.retryAfterSeconds ?? null,
      };
    }

    throw error;
  }
}

export async function createPropertySearchCompletion(payload) {
  const limit = Math.min(payload.limit ?? PROPERTY_SEARCH_PAGE_SIZE, PROPERTY_SEARCH_PAGE_SIZE);
  const offset = payload.offset ?? 0;
  const hasPreviousCriteria = hasPreviousSearchCriteria(payload.previousCriteria);
  const { criteria: parsedCriteria, parsedBy } = await parsePropertySearchCriteria(
    payload.message,
    { allowPartialLocalCriteria: hasPreviousCriteria },
  );
  const criteria = hasPreviousCriteria
    ? mergeSearchCriteria(payload.previousCriteria, parsedCriteria)
    : parsedCriteria;
  const refinementPrompt = buildSearchRefinementPrompt(criteria, payload.message);
  const searchResult = refinementPrompt?.blocksSearch
    ? {
        items: [],
        pagination: {
          hasMore: false,
          limit,
          nextOffset: offset,
          offset,
          total: 0,
        },
        relaxation: null,
        relaxed: false,
      }
    : await searchProperties(criteria, limit, offset);
  const followUpPrompt =
    searchResult.items.length && !refinementPrompt?.blocksSearch && !refinementPrompt
      ? buildSearchFollowUpPrompt(criteria, payload.message)
      : null;

  return {
    criteria,
    criteriaLabels: buildCriteriaLabels(criteria),
    followUpPrompt,
    listings: searchResult.items,
    model: isGeminiConfigured() ? env.GEMINI_MODEL : null,
    parsedBy,
    provider: parsedBy === "gemini" ? "gemini" : "local",
    recognizedCriteria: buildRecognizedCriteria(criteria),
    pagination: searchResult.pagination,
    refinementPrompt,
    relaxation: searchResult.relaxation,
    relaxed: searchResult.relaxed,
    reply: buildSearchReply({
      criteria,
      items: searchResult.items,
      pagination: searchResult.pagination,
      relaxation: searchResult.relaxation,
      relaxed: searchResult.relaxed,
      refinementPrompt,
    }),
  };
}
