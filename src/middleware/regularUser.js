import ApiError from "../common/ApiError.js";
import { ROLES } from "../common/constants.js";

export default function requireRegularUser(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, "Bạn chưa đăng nhập."));
  }

  if (Array.isArray(req.user.roles) && req.user.roles.includes(ROLES.ADMIN)) {
    return next(
      new ApiError(
        403,
        "Tài khoản admin không được sử dụng tính năng dành cho người dùng thường.",
      ),
    );
  }

  return next();
}
