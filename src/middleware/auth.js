import ApiError from "../common/ApiError.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import User from "../modules/users/user.model.js";

export default async function requireAuth(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return next(new ApiError(401, "Thiếu access token."));
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new ApiError(401, "Access token không hợp lệ."));
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return next(new ApiError(401, "Người dùng không tồn tại."));
    }

    if (user.isActive === false) {
      return next(new ApiError(403, "Tài khoản đã bị khóa."));
    }

    req.auth = payload;
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new ApiError(401, "Access token không hợp lệ hoặc đã hết hạn."));
    }

    return next(error);
  }
}
