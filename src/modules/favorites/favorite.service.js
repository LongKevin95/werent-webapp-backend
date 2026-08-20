import Favorite from "./favorite.model.js";
import Property from "../properties/property.model.js";
import ApiError from "../../common/ApiError.js";

export async function listFavorites(userId) {
  return Favorite.find({ user: userId }).populate("property").sort({ createdAt: -1 });
}

export async function addFavorite(userId, propertyId) {
  const property = await Property.findById(propertyId);
  if (!property) throw new ApiError(404, "Không tìm thấy tin đăng.");
  const existed = await Favorite.exists({ user: userId, property: propertyId });
  const favorite = await Favorite.findOneAndUpdate(
    { user: userId, property: propertyId },
    { user: userId, property: propertyId },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!existed) {
    await Property.updateOne({ _id: propertyId }, { $inc: { "metrics.favoriteCount": 1 } });
  }

  return favorite.populate("property");
}

export async function removeFavorite(userId, propertyId) {
  const removed = await Favorite.findOneAndDelete({ user: userId, property: propertyId });
  if (removed) {
    await Property.updateOne({ _id: propertyId }, { $inc: { "metrics.favoriteCount": -1 } });
  }
}
