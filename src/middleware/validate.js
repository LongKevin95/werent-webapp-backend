import ApiError from "../common/ApiError.js";

export default function validate(schema, target = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[target] ?? {});

    if (!parsed.success) {
      return next(
        new ApiError(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", {
          details: parsed.error.flatten(),
        }),
      );
    }

    Object.defineProperty(req, target, {
      configurable: true,
      enumerable: true,
      value: parsed.data,
      writable: true,
    });
    return next();
  };
}
