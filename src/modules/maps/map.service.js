import ApiError from "../../common/ApiError.js";
import env from "../../config/env.js";

const GEOAPIFY_GEOCODE_BASE_URL = "https://api.geoapify.com/v1/geocode";
const GEOAPIFY_PLACES_BASE_URL = "https://api.geoapify.com/v2";
const DEFAULT_SEARCH_BIAS = { lat: 10.7721, lng: 106.6983 };
const VIETNAM_BOUNDING_BOX = "rect:102.1,8.2,109.6,23.4";
const HIGH_CONFIDENCE_SCORE = 95;
const AUTOCOMPLETE_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTOCOMPLETE_CACHE_LIMIT = 300;
const AUTOCOMPLETE_CACHE_COORDINATE_PRECISION = 2;
const PLACE_NAME_CATEGORIES = [
  "commercial",
  "commercial.shopping_mall",
  "building.commercial",
  "tourism",
  "entertainment",
  "leisure",
  "catering",
  "education",
  "healthcare",
  "accommodation",
  "activity",
  "airport",
  "beach",
].join(",");

const LEADING_LOCATION_WORDS = [
  "dac khu",
  "dao",
  "hon",
  "quan dao",
  "thanh pho",
  "tp",
  "tinh",
  "huyen",
  "quan",
  "phuong",
  "xa",
  "thi tran",
  "thi xa",
];

const ADMINISTRATIVE_QUERY_PREFIXES = [
  { prefix: "thanh pho", type: "city" },
  { prefix: "tp", type: "city" },
  { prefix: "tinh", type: "state" },
  { prefix: "dac khu", type: "locality" },
  { prefix: "quan", type: "locality" },
  { prefix: "huyen", type: "locality" },
  { prefix: "phuong", type: "locality" },
  { prefix: "xa", type: "locality" },
  { prefix: "thi tran", type: "locality" },
  { prefix: "thi xa", type: "locality" },
];

const ADMINISTRATIVE_RESULT_TYPES = new Set([
  "city",
  "county",
  "district",
  "locality",
  "state",
  "suburb",
]);
const autocompleteCache = new Map();

function ensureGeoapifyApiKey() {
  if (!env.GEOAPIFY_API_KEY) {
    throw new ApiError(503, "Chua cau hinh GEOAPIFY_API_KEY cho dich vu ban do.");
  }
}

function buildGeoapifyUrl(baseUrl, path, params) {
  const url = new URL(`${baseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("apiKey", env.GEOAPIFY_API_KEY);
  return url;
}

async function requestGeoapify(url) {
  ensureGeoapifyApiKey();

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message || "Khong the ket noi dich vu ban do.",
    );
  }

  return payload;
}

function toSearchKey(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingLocationWords(value) {
  let nextValue = value;
  let didStrip = true;

  while (didStrip) {
    didStrip = false;

    for (const word of LEADING_LOCATION_WORDS) {
      if (nextValue === word) {
        return "";
      }

      if (nextValue.startsWith(`${word} `)) {
        nextValue = nextValue.slice(word.length).trim();
        didStrip = true;
        break;
      }
    }
  }

  return nextValue;
}

function getAdministrativeQuery(query) {
  const normalizedQuery = toSearchKey(query);

  for (const { prefix, type } of ADMINISTRATIVE_QUERY_PREFIXES) {
    if (normalizedQuery === prefix) {
      return null;
    }

    if (normalizedQuery.startsWith(`${prefix} `)) {
      const searchText = normalizedQuery.slice(prefix.length).trim();

      if (searchText.length >= 2) {
        return {
          searchText,
          type,
        };
      }
    }
  }

  return null;
}

function createQueryVariants(query) {
  const trimmedQuery = query.trim();
  const normalizedQuery = toSearchKey(trimmedQuery);
  const strippedQuery = stripLeadingLocationWords(normalizedQuery);
  const variants = new Set([trimmedQuery, normalizedQuery, strippedQuery]);

  if (normalizedQuery.includes("trung tam thuong mai")) {
    variants.add(normalizedQuery.replace(/trung tam thuong mai/g, "mall"));
  }

  if (normalizedQuery.includes("mall")) {
    variants.add(normalizedQuery.replace(/\bmall\b/g, "trung tam thuong mai"));
    variants.add(normalizedQuery.replace(/\bmall\b/g, "").trim());
  }

  if (normalizedQuery.startsWith("cho ")) {
    variants.add(normalizedQuery.replace(/^cho\s+/, "").trim());
  }

  return [...variants].filter((variant) => variant.length >= 3).slice(0, 6);
}

function isLikelyPlaceNameQuery(query) {
  return /\b(mall|plaza|center|centre|market|hotel|resort|airport|landmark|vincom|lotte|aeon|cho|cong vien|benh vien|truong|dai hoc|trung tam|san bay|cau|chua|nha tho|bao tang)\b/.test(
    toSearchKey(query),
  );
}

function pickGeoapifyProperties(result) {
  return result?.properties ?? result ?? {};
}

function pickCoordinates(result, properties) {
  const coordinates = result?.geometry?.coordinates;
  const lat = Number(properties.lat ?? coordinates?.[1]);
  const lng = Number(properties.lon ?? properties.lng ?? coordinates?.[0]);

  return { lat, lng };
}

function pickDisplayName(properties) {
  return (
    properties.name ||
    properties.address_line1 ||
    properties.street ||
    properties.city ||
    properties.county ||
    properties.state ||
    properties.formatted ||
    "Vi tri da chon"
  );
}

function normalizeGeoapifyResult(result, source = "geocode") {
  const properties = pickGeoapifyProperties(result);
  const { lat, lng } = pickCoordinates(result, properties);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    addressComponents: properties,
    categories: properties.categories ?? [],
    displayName: pickDisplayName(properties),
    distance: properties.distance ?? null,
    formattedAddress:
      properties.formatted ||
      [properties.address_line1, properties.address_line2]
        .filter(Boolean)
        .join(", "),
    lat,
    lng,
    mapProvider: "geoapify",
    placeId: properties.place_id || `${lat},${lng}`,
    rank: properties.rank ?? {},
    resultType: properties.result_type ?? source,
    source,
  };
}

function getTokenOverlapScore(queryVariant, text) {
  const tokens = queryVariant.split(" ").filter((token) => token.length > 1);

  if (tokens.length === 0) {
    return 0;
  }

  const matchedTokens = tokens.filter((token) => text.includes(token)).length;
  return (matchedTokens / tokens.length) * 35;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSearchPhrase(text, phrase) {
  if (!phrase) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegex(phrase)}(\\s|$)`).test(text);
}

function getNumberTokens(value) {
  return toSearchKey(value).match(/\d+/g) ?? [];
}

function isStrongAdministrativeMatch(place, administrativeQuery) {
  if (!administrativeQuery) {
    return false;
  }

  const searchText = toSearchKey(administrativeQuery.searchText);
  const displayName = toSearchKey(place.displayName);

  return (
    ADMINISTRATIVE_RESULT_TYPES.has(place.resultType) &&
    containsSearchPhrase(displayName, searchText)
  );
}

function getResultScore(place, queryVariants, options = {}) {
  const displayName = toSearchKey(place.displayName);
  const formattedAddress = toSearchKey(place.formattedAddress);
  const searchableText = `${displayName} ${formattedAddress}`;
  const categories = place.categories ?? [];
  let score = Number(place.rank?.confidence ?? 0) * 25;
  const displayNameNumbers = getNumberTokens(displayName);

  for (const variant of queryVariants) {
    const normalizedVariant = toSearchKey(variant);
    const queryNumbers = getNumberTokens(normalizedVariant);

    if (!normalizedVariant) {
      continue;
    }

    if (displayName === normalizedVariant) {
      score += 130;
    } else if (containsSearchPhrase(displayName, normalizedVariant)) {
      score += 105;
    } else if (
      containsSearchPhrase(normalizedVariant, displayName) &&
      displayName.length >= 5
    ) {
      score += 85;
    } else if (containsSearchPhrase(formattedAddress, normalizedVariant)) {
      score += 65;
    }

    score += getTokenOverlapScore(normalizedVariant, searchableText);

    if (queryNumbers.length > 0 && displayNameNumbers.length > 0) {
      const hasExactNumberMatch = queryNumbers.every((number) =>
        displayNameNumbers.includes(number),
      );

      score += hasExactNumberMatch ? 35 : -110;
    }

    if (
      /\bmall\b|trung tam thuong mai/.test(normalizedVariant) &&
      categories.some((category) => category.includes("shopping_mall"))
    ) {
      score += 45;
    }
  }

  if (place.addressComponents?.country_code === "vn") {
    score += 20;
  }

  if (["amenity", "locality", "city", "district"].includes(place.resultType)) {
    score += 18;
  }

  if (options.isAdministrativeQuery) {
    if (ADMINISTRATIVE_RESULT_TYPES.has(place.resultType)) {
      score += 130;
    } else if (place.resultType === "amenity" || place.source === "places") {
      score -= 220;
    }
  }

  if (place.source === "places") {
    score += 12;
  }

  if (Number.isFinite(Number(place.distance))) {
    score += Math.max(0, 16 - Number(place.distance) / 5000);
  }

  return score;
}

function getPlaceKey(place) {
  return `${place.lat.toFixed(3)},${place.lng.toFixed(3)}:${toSearchKey(
    place.displayName,
  )}`;
}

function mergeAndRankPlaces(placeGroups, queryVariants, limit, options = {}) {
  const placesByKey = new Map();

  for (const place of placeGroups.flat()) {
    if (!place) {
      continue;
    }

    const key = getPlaceKey(place);
    const nextScore = getResultScore(place, queryVariants, options);
    const currentPlace = placesByKey.get(key);

    if (!currentPlace || nextScore > currentPlace.searchScore) {
      placesByKey.set(key, {
        ...place,
        searchScore: nextScore,
      });
    }
  }

  return [...placesByKey.values()]
    .sort((left, right) => right.searchScore - left.searchScore)
    .slice(0, limit);
}

function hasHighConfidenceResult(places, queryVariants, options = {}) {
  return places.some(
    (place) =>
      getResultScore(place, queryVariants, options) >= HIGH_CONFIDENCE_SCORE,
  );
}

function formatAutocompleteCacheCoordinate(value) {
  const coordinate = Number(value);

  return Number.isFinite(coordinate)
    ? coordinate.toFixed(AUTOCOMPLETE_CACHE_COORDINATE_PRECISION)
    : "";
}

function buildAutocompleteCacheKey(query) {
  return [
    toSearchKey(query.query),
    formatAutocompleteCacheCoordinate(query.lat ?? DEFAULT_SEARCH_BIAS.lat),
    formatAutocompleteCacheCoordinate(query.lng ?? DEFAULT_SEARCH_BIAS.lng),
    query.limit ?? 5,
  ].join("|");
}

function getCachedAutocompletePlaces(cacheKey) {
  const cachedResult = autocompleteCache.get(cacheKey);

  if (!cachedResult) {
    return null;
  }

  if (cachedResult.expiresAt <= Date.now()) {
    autocompleteCache.delete(cacheKey);
    return null;
  }

  autocompleteCache.delete(cacheKey);
  autocompleteCache.set(cacheKey, cachedResult);
  return cachedResult.places;
}

function rememberAutocompletePlaces(cacheKey, places) {
  autocompleteCache.set(cacheKey, {
    expiresAt: Date.now() + AUTOCOMPLETE_CACHE_TTL_MS,
    places,
  });

  while (autocompleteCache.size > AUTOCOMPLETE_CACHE_LIMIT) {
    const oldestKey = autocompleteCache.keys().next().value;
    autocompleteCache.delete(oldestKey);
  }

  return places;
}

async function fetchGeoapifyAutocomplete(text, biasLat, biasLng, limit) {
  const url = buildGeoapifyUrl(GEOAPIFY_GEOCODE_BASE_URL, "/autocomplete", {
    bias: `proximity:${biasLng},${biasLat}`,
    filter: "countrycode:vn",
    format: "json",
    lang: "vi",
    limit,
    text,
  });
  const payload = await requestGeoapify(url);

  return (payload.results ?? [])
    .map((result) => normalizeGeoapifyResult(result, "autocomplete"))
    .filter(Boolean);
}

async function fetchGeoapifySearch(text, biasLat, biasLng, limit) {
  const url = buildGeoapifyUrl(GEOAPIFY_GEOCODE_BASE_URL, "/search", {
    bias: `proximity:${biasLng},${biasLat}`,
    filter: "countrycode:vn",
    format: "json",
    lang: "vi",
    limit,
    text,
  });
  const payload = await requestGeoapify(url);

  return (payload.results ?? [])
    .map((result) => normalizeGeoapifyResult(result, "search"))
    .filter(Boolean);
}

async function fetchGeoapifyTypedGeocode(text, type, biasLat, biasLng, limit) {
  const url = buildGeoapifyUrl(GEOAPIFY_GEOCODE_BASE_URL, "/search", {
    bias: `proximity:${biasLng},${biasLat}`,
    filter: "countrycode:vn",
    format: "json",
    lang: "vi",
    limit,
    text,
    type,
  });
  const payload = await requestGeoapify(url);

  return (payload.results ?? [])
    .map((result) => normalizeGeoapifyResult(result, "typed-geocode"))
    .filter(Boolean);
}

async function fetchGeoapifyPlacesByName(text, biasLat, biasLng, limit) {
  const url = buildGeoapifyUrl(GEOAPIFY_PLACES_BASE_URL, "/places", {
    bias: `proximity:${biasLng},${biasLat}`,
    categories: PLACE_NAME_CATEGORIES,
    filter: VIETNAM_BOUNDING_BOX,
    lang: "vi",
    limit,
    name: text,
  });
  const payload = await requestGeoapify(url);

  return (payload.features ?? [])
    .map((feature) => normalizeGeoapifyResult(feature, "places"))
    .filter(Boolean);
}

export async function autocompletePlaces(query) {
  const biasLat = query.lat ?? DEFAULT_SEARCH_BIAS.lat;
  const biasLng = query.lng ?? DEFAULT_SEARCH_BIAS.lng;
  const limit = query.limit;
  const cacheKey = buildAutocompleteCacheKey(query);
  const cachedPlaces = getCachedAutocompletePlaces(cacheKey);

  if (cachedPlaces) {
    return cachedPlaces;
  }

  const queryVariants = createQueryVariants(query.query);
  const administrativeQuery = getAdministrativeQuery(query.query);
  const searchOptions = {
    isAdministrativeQuery: Boolean(administrativeQuery),
  };
  const primaryPlaces = await fetchGeoapifyAutocomplete(
    query.query,
    biasLat,
    biasLng,
    Math.max(limit, 5),
  );

  if (
    !administrativeQuery &&
    hasHighConfidenceResult(primaryPlaces, queryVariants, searchOptions)
  ) {
    return rememberAutocompletePlaces(
      cacheKey,
      mergeAndRankPlaces(
        [primaryPlaces],
        queryVariants,
        limit,
        searchOptions,
      ),
    );
  }

  const fallbackQueries = queryVariants
    .filter((variant) => toSearchKey(variant) !== toSearchKey(query.query))
    .slice(0, 2);
  const placeNameQueries = isLikelyPlaceNameQuery(query.query)
    ? [query.query, ...fallbackQueries]
    : [];
  const fallbackRequests = [
    fetchGeoapifySearch(query.query, biasLat, biasLng, 5),
    ...(administrativeQuery
      ? [
          fetchGeoapifyTypedGeocode(
            administrativeQuery.searchText,
            administrativeQuery.type,
            biasLat,
            biasLng,
            5,
          ),
          fetchGeoapifyAutocomplete(
            administrativeQuery.searchText,
            biasLat,
            biasLng,
            5,
          ),
          fetchGeoapifySearch(administrativeQuery.searchText, biasLat, biasLng, 5),
        ]
      : []),
    ...fallbackQueries.map((variant) =>
      fetchGeoapifyAutocomplete(variant, biasLat, biasLng, 5),
    ),
    ...fallbackQueries.map((variant) =>
      fetchGeoapifySearch(variant, biasLat, biasLng, 5),
    ),
    ...placeNameQueries.map((variant) =>
      fetchGeoapifyPlacesByName(variant, biasLat, biasLng, 5),
    ),
  ];
  const settledResults = await Promise.allSettled(fallbackRequests);
  const fallbackPlaces = settledResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const rankedPlaces = mergeAndRankPlaces(
    [primaryPlaces, fallbackPlaces],
    queryVariants,
    limit,
    searchOptions,
  );

  if (administrativeQuery) {
    const administrativePlaces = rankedPlaces.filter((place) =>
      isStrongAdministrativeMatch(place, administrativeQuery),
    );

    if (administrativePlaces.length > 0) {
      return rememberAutocompletePlaces(
        cacheKey,
        administrativePlaces.slice(0, limit),
      );
    }
  }

  return rememberAutocompletePlaces(cacheKey, rankedPlaces);
}

export async function reverseGeocodeLocation(query) {
  const url = buildGeoapifyUrl(GEOAPIFY_GEOCODE_BASE_URL, "/reverse", {
    format: "json",
    lang: "vi",
    lat: query.lat,
    lon: query.lng,
  });
  const payload = await requestGeoapify(url);
  const place = (payload.results ?? [])
    .map((result) => normalizeGeoapifyResult(result, "reverse"))
    .find(Boolean);

  if (!place) {
    throw new ApiError(404, "Khong tim thay dia chi gan vi tri nay.");
  }

  return place;
}
