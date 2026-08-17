import asyncHandler from "../../common/asyncHandler.js";
import { getSearchSuggestions } from "./search-suggestion.service.js";

export const listSearchSuggestions = asyncHandler(async (req, res) => {
  const data = await getSearchSuggestions(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});
