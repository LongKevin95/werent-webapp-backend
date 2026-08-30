const SUPPORTED_VIETNAM_MOBILE_PREFIXES = Object.freeze([
  "032",
  "033",
  "034",
  "035",
  "036",
  "037",
  "038",
  "039",
  "070",
  "076",
  "077",
  "078",
  "079",
  "081",
  "082",
  "083",
  "084",
  "085",
  "086",
  "088",
  "089",
  "090",
  "091",
  "093",
  "094",
  "096",
  "097",
  "098",
]);

export const INVALID_PHONE_MESSAGE = "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.";

export function getVietnamPhoneValidationError(phone) {
  if (typeof phone !== "string" && typeof phone !== "number") {
    return "Vui lòng nhập số điện thoại.";
  }

  const rawPhone = String(phone).trim();

  if (!rawPhone) {
    return "Vui lòng nhập số điện thoại.";
  }

  if (!/^\+?\d+$/.test(rawPhone)) {
    return "Số điện thoại chỉ được gồm chữ số và có thể bắt đầu bằng +84.";
  }

  let digits = rawPhone.startsWith("+") ? rawPhone.slice(1) : rawPhone;

  if (digits.startsWith("84")) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }

  if (digits.length < 9 || digits.length > 10) {
    return "Số điện thoại phải có 9 hoặc 10 chữ số.";
  }

  if (!digits.startsWith("0") || digits.length !== 10) {
    return "Số điện thoại phải bắt đầu bằng 0 hoặc dùng định dạng +84.";
  }

  if (!SUPPORTED_VIETNAM_MOBILE_PREFIXES.includes(digits.slice(0, 3))) {
    return "Vui lòng nhập đúng đầu số nhà mạng Việt Nam.";
  }

  return "";
}

export function normalizeVietnamPhone(phone) {
  if (typeof phone !== "string" && typeof phone !== "number") {
    return undefined;
  }

  const rawPhone = String(phone).trim();

  if (!rawPhone || !/^\+?\d+$/.test(rawPhone)) {
    return undefined;
  }

  let digits = rawPhone.startsWith("+") ? rawPhone.slice(1) : rawPhone;

  if (digits.length < 9 || digits.length > 11) {
    return undefined;
  }

  if (digits.startsWith("84")) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }

  if (!digits.startsWith("0") || digits.length !== 10) {
    return undefined;
  }

  if (!SUPPORTED_VIETNAM_MOBILE_PREFIXES.includes(digits.slice(0, 3))) {
    return undefined;
  }

  return digits;
}

export function isValidVietnamPhone(phone) {
  return normalizeVietnamPhone(phone) !== undefined;
}
