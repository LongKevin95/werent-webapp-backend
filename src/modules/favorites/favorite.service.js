import Favorite from "./favorite.model.js";

export async function listFavorites(userId) {
  return Favorite.find({ user: userId }).populate("property").sort({ createdAt: -1 });
}

export async function addFavorite(userId, propertyId) {
  const favorite = await Favorite.findOneAndUpdate(
    { user: userId, property: propertyId },
    { user: userId, property: propertyId },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return favorite.populate("property");
}

export async function removeFavorite(userId, propertyId) {
  await Favorite.findOneAndDelete({ user: userId, property: propertyId });
}
