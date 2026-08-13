import asyncHandler from "../../common/asyncHandler.js";
import * as kycService from "./kyc.service.js";

export const submitMyAccountKyc = asyncHandler(async (req, res) => {
  const item = await kycService.submitAccountKyc(req.user._id, req.body, req.files);
  res.status(201).json({ success: true, message: "Đã gửi hồ sơ KYC để chờ duyệt.", data: { item } });
});
export const getMyAccountKyc = asyncHandler(async (req, res) => {
  const item = await kycService.getLatestAccountKyc(req.user._id);
  res.json({ success: true, message: "Lấy hồ sơ KYC thành công.", data: { item } });
});
export const submitMyListingVerification = asyncHandler(async (req, res) => {
  const item = await kycService.submitListingVerification(req.user, req.params.propertyId, req.body, req.files);
  res.status(201).json({ success: true, message: "Đã gửi hồ sơ xác thực bất động sản.", data: { item } });
});
export const getMyListingVerification = asyncHandler(async (req, res) => {
  const item = await kycService.getLatestListingVerification(req.user._id, req.params.propertyId);
  res.json({ success: true, message: "Lấy hồ sơ xác thực tin đăng thành công.", data: { item } });
});
export const getAdminAccountKycRequests = asyncHandler(async (req, res) => {
  const data = await kycService.listAccountKycRequests(req.query);
  res.json({ success: true, message: "Lấy danh sách KYC tài khoản thành công.", data });
});
export const getAdminAccountKycRequest = asyncHandler(async (req, res) => {
  const item = await kycService.getAccountKycRequest(req.params.requestId);
  res.json({ success: true, message: "Lấy chi tiết KYC tài khoản thành công.", data: { item } });
});
export const reviewAdminAccountKyc = asyncHandler(async (req, res) => {
  const item = await kycService.reviewAccountKyc(req.params.requestId, req.user._id, req.body);
  res.json({ success: true, message: "Đã cập nhật kết quả KYC tài khoản.", data: { item } });
});
export const getAdminListingVerificationRequests = asyncHandler(async (req, res) => {
  const data = await kycService.listListingVerificationRequests(req.query);
  res.json({ success: true, message: "Lấy danh sách xác thực tin đăng thành công.", data });
});
export const getAdminListingVerificationRequest = asyncHandler(async (req, res) => {
  const item = await kycService.getListingVerificationRequest(req.params.requestId);
  res.json({ success: true, message: "Lấy chi tiết xác thực tin đăng thành công.", data: { item } });
});
export const reviewAdminListingVerification = asyncHandler(async (req, res) => {
  const item = await kycService.reviewListingVerification(req.params.requestId, req.user._id, req.body);
  res.json({ success: true, message: "Đã cập nhật kết quả xác thực tin đăng.", data: { item } });
});
