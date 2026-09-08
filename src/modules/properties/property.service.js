import ApiError from "../../common/ApiError.js";
import {
  PROPERTY_STATUS,
  PROPERTY_STATUS_LIST,
  ROLES,
} from "../../common/constants.js";
import { deleteAsset, uploadFiles } from "../../services/cloudinary.service.js";
import {
  assertWalletCanSpend,
  spendWalletForListing,
} from "../payments/wallet.service.js";
import { sendListingStatusNotification } from "../notifications/notification.service.js";
import Property from "./property.model.js";
import User from "../users/user.model.js";

function serializePropertyImage(image) {
  return {
    publicId: image.publicId ?? null,
    url: image.url,
  };
}

function getPropertyImageKey(image) {
  if (image.publicId) {
    return `public:${image.publicId}`;
  }

  return image.url ? `url:${image.url}` : "";
}

function getExistingImageFromMap(imageMap, image) {
  const candidates = [
    image.publicId ? `public:${image.publicId}` : "",
    image.url ? `url:${image.url}` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const existingImage = imageMap.get(candidate);

    if (existingImage) {
      return existingImage;
    }
  }

  return null;
}

function mapUploadedImage(image) {
  return {
    url: image.secureUrl,
    publicId: image.publicId,
  };
}

const PUBLIC_SEARCH_STOP_WORDS = new Set([
  "ban",
  "can",
  "cho",
  "co",
  "duong",
  "gan",
  "hem",
  "khu",
  "khuvuc",
  "o",
  "phuong",
  "pho",
  "quan",
  "tai",
  "thanh",
  "thue",
  "tim",
  "tin",
  "tp",
  "va",
  "xa",
]);

const PUBLIC_PROPERTY_TYPE_ALIASES = Object.freeze([
  {
    aliases: ["can ho", "can ho chung cu", "chung cu", "apartment"],
    value: "C\u0103n h\u1ed9 chung c\u01b0",
  },
  {
    aliases: [
      "can ho dich vu",
      "chung cu mini",
      "studio",
      "can ho mini",
      "Chung c\u01b0 mini",
      "C\u0103n h\u1ed9 mini",
    ],
    value: "C\u0103n h\u1ed9 d\u1ecbch v\u1ee5",
  },
  {
    aliases: ["phong tro", "nha tro", "phong cho thue", "phong thue", "tro"],
    value: "Ph\u00f2ng tr\u1ecd",
  },
  {
    aliases: [
      "nha rieng",
      "nha nguyen can",
      "nguyen can",
      "Nh\u00e0 nguy\u00ean c\u0103n",
    ],
    value: "Nh\u00e0 ri\u00eang",
  },
  {
    aliases: [
      "nha mat pho",
      "nha mat tien",
      "mat tien",
      "nha pho",
      "Nh\u00e0 m\u1eb7t ti\u1ec1n",
      "Nh\u00e0 ph\u1ed1",
    ],
    value: "Nh\u00e0 m\u1eb7t ph\u1ed1",
  },
  {
    aliases: [
      "mat bang",
      "mat bang kinh doanh",
      "kiot",
      "shophouse",
      "M\u1eb7t b\u1eb1ng",
    ],
    value: "M\u1eb7t b\u1eb1ng kinh doanh",
  },
  {
    aliases: ["biet thu", "villa"],
    value: "Bi\u1ec7t th\u1ef1",
  },
  {
    aliases: ["van phong", "office"],
    value: "V\u0103n ph\u00f2ng",
  },
  {
    aliases: ["dat nen", "dat", "kho bai", "lam kho"],
    value: "\u0110\u1ea5t n\u1ec1n",
  },
]);

const PUBLIC_DISTRICT_ALIASES = Object.freeze([
  { aliases: ["quan 1", "q1", "district 1"], value: "Qu\u1eadn 1" },
  { aliases: ["quan 2", "q2", "district 2"], value: "Qu\u1eadn 2" },
  { aliases: ["quan 3", "q3", "district 3"], value: "Qu\u1eadn 3" },
  { aliases: ["quan 4", "q4", "district 4"], value: "Qu\u1eadn 4" },
  { aliases: ["quan 5", "q5", "district 5"], value: "Qu\u1eadn 5" },
  { aliases: ["quan 6", "q6", "district 6"], value: "Qu\u1eadn 6" },
  { aliases: ["quan 7", "q7", "district 7"], value: "Qu\u1eadn 7" },
  { aliases: ["quan 8", "q8", "district 8"], value: "Qu\u1eadn 8" },
  { aliases: ["quan 9", "q9", "district 9"], value: "Qu\u1eadn 9" },
  { aliases: ["quan 10", "q10", "district 10"], value: "Qu\u1eadn 10" },
  { aliases: ["quan 11", "q11", "district 11"], value: "Qu\u1eadn 11" },
  { aliases: ["quan 12", "q12", "district 12"], value: "Qu\u1eadn 12" },
  {
    aliases: ["binh tan", "quan binh tan", "q binh tan", "ten lua"],
    value: "Qu\u1eadn B\u00ecnh T\u00e2n",
  },
  {
    aliases: ["binh thanh", "quan binh thanh", "q binh thanh", "hang xanh"],
    value: "Qu\u1eadn B\u00ecnh Th\u1ea1nh",
  },
  {
    aliases: ["go vap", "quan go vap", "q go vap"],
    value: "Qu\u1eadn G\u00f2 V\u1ea5p",
  },
  {
    aliases: ["phu nhuan", "quan phu nhuan", "q phu nhuan"],
    value: "Qu\u1eadn Ph\u00fa Nhu\u1eadn",
  },
  {
    aliases: ["tan binh", "quan tan binh", "q tan binh", "san bay"],
    value: "Qu\u1eadn T\u00e2n B\u00ecnh",
  },
  {
    aliases: ["tan phu", "quan tan phu", "q tan phu"],
    value: "Qu\u1eadn T\u00e2n Ph\u00fa",
  },
  {
    aliases: [
      "thu duc",
      "tp thu duc",
      "thanh pho thu duc",
      "Th\u00e0nh ph\u1ed1 Th\u1ee7 \u0110\u1ee9c",
    ],
    value: "TP. Th\u1ee7 \u0110\u1ee9c",
  },
  {
    aliases: ["nha be", "huyen nha be"],
    value: "Huy\u1ec7n Nh\u00e0 B\u00e8",
  },
  {
    aliases: ["binh chanh", "huyen binh chanh"],
    value: "Huy\u1ec7n B\u00ecnh Ch\u00e1nh",
  },
  {
    aliases: ["hoc mon", "huyen hoc mon"],
    value: "Huy\u1ec7n H\u00f3c M\u00f4n",
  },
  {
    aliases: ["cu chi", "huyen cu chi"],
    value: "Huy\u1ec7n C\u1ee7 Chi",
  },
  {
    aliases: ["can gio", "huyen can gio"],
    value: "Huy\u1ec7n C\u1ea7n Gi\u1edd",
  },
]);

const PUBLIC_CITY_ALIASES = Object.freeze([
  {
    aliases: [
      "H\u1ed3 Ch\u00ed Minh",
      "Th\u00e0nh ph\u1ed1 H\u1ed3 Ch\u00ed Minh",
      "S\u00e0i G\u00f2n",
      "tp ho chi minh",
      "thanh pho ho chi minh",
      "ho chi minh",
      "tp hcm",
      "tphcm",
      "hcm",
      "sai gon",
      "saigon",
    ],
    value: "TP. H\u1ed3 Ch\u00ed Minh",
  },
  {
    aliases: [
      "Th\u00e0nh ph\u1ed1 H\u00e0 N\u1ed9i",
      "TP. H\u00e0 N\u1ed9i",
      "ha noi",
      "thanh pho ha noi",
      "tp ha noi",
      "hanoi",
    ],
    value: "H\u00e0 N\u1ed9i",
  },
  {
    aliases: [
      "Th\u00e0nh ph\u1ed1 \u0110\u00e0 N\u1eb5ng",
      "TP. \u0110\u00e0 N\u1eb5ng",
      "da nang",
      "thanh pho da nang",
      "tp da nang",
      "danang",
    ],
    value: "\u0110\u00e0 N\u1eb5ng",
  },
  {
    aliases: [
      "Th\u00e0nh ph\u1ed1 C\u1ea7n Th\u01a1",
      "TP. C\u1ea7n Th\u01a1",
      "can tho",
      "thanh pho can tho",
      "tp can tho",
    ],
    value: "C\u1ea7n Th\u01a1",
  },
  {
    aliases: [
      "Th\u00e0nh ph\u1ed1 H\u1ea3i Ph\u00f2ng",
      "TP. H\u1ea3i Ph\u00f2ng",
      "hai phong",
      "thanh pho hai phong",
      "tp hai phong",
    ],
    value: "H\u1ea3i Ph\u00f2ng",
  },
]);

const PUBLIC_BROAD_SEARCH_TERMS = Object.freeze([
  "bds",
  "bat dong san",
  "nha dat",
  "cho thue",
  "thue",
  "mua ban",
]);

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    const key = normalizeSearchText(normalizedValue);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalizedValue);
  });

  return result;
}

function uniqueRawValues(values = []) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const normalizedValue = String(value ?? "").trim();
    const key = normalizedValue.toLowerCase();

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalizedValue);
  });

  return result;
}

function includesSearchPhrase(source, phrase) {
  const normalizedSource = normalizeSearchText(source);
  const normalizedPhrase = normalizeSearchText(phrase);

  if (!normalizedSource || !normalizedPhrase) {
    return false;
  }

  const phrasePattern = new RegExp(
    `(^|\\s)${escapeRegExp(normalizedPhrase).replace(/\s+/g, "\\s+")}(?=\\s|$)`,
  );

  return phrasePattern.test(normalizedSource);
}

function getAliasTerms(value, definitions) {
  const normalizedValue = normalizeSearchText(value);
  const definition = definitions.find(
    (item) =>
      normalizeSearchText(item.value) === normalizedValue ||
      item.aliases.some(
        (alias) => normalizeSearchText(alias) === normalizedValue,
      ),
  );

  if (!definition) {
    return [value];
  }

  return uniqueRawValues([definition.value, ...definition.aliases]);
}

function collectAliasValues(value, definitions) {
  const values = toArray(value).filter(Boolean);

  return uniqueValues(
    definitions
      .filter((definition) =>
        values.some((item) =>
          [definition.value, ...definition.aliases].some((term) =>
            includesSearchPhrase(item, term),
          ),
        ),
      )
      .map((definition) => definition.value),
  );
}

function collectMatchedAliasTerms(value, definitions) {
  const values = toArray(value).filter(Boolean);

  return uniqueRawValues(
    definitions.flatMap((definition) => {
      const terms = [definition.value, ...definition.aliases];
      const hasMatch = values.some((item) =>
        terms.some((term) => includesSearchPhrase(item, term)),
      );

      return hasMatch ? terms : [];
    }),
  );
}

function normalizeAliasedFilterValues(value, definitions) {
  return uniqueValues(
    toArray(value).flatMap((item) => {
      const aliasValues = collectAliasValues(item, definitions);

      return aliasValues.length ? aliasValues : [item];
    }),
  );
}

function removeSearchTerms(value, terms = []) {
  let normalizedValue = ` ${normalizeSearchText(value)} `;

  uniqueValues(terms)
    .map(normalizeSearchText)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .forEach((term) => {
      const pattern = new RegExp(
        `(^|\\s)${escapeRegExp(term).replace(/\s+/g, "\\s+")}(?=\\s|$)`,
        "g",
      );

      normalizedValue = normalizedValue.replace(pattern, " ");
    });

  return normalizedValue.replace(/\s+/g, " ").trim();
}

function createPhraseRegexPattern(term) {
  const pattern = escapeRegExp(term).replace(/\s+/g, "\\s+");

  return `(^|[^\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`;
}

function createContainsRegexConditions(fields, values, definitions = []) {
  return values.flatMap((value) => {
    const terms = definitions.length
      ? getAliasTerms(value, definitions)
      : [value];

    return terms.flatMap((term) => {
      const pattern = createPhraseRegexPattern(term);

      return fields.map((field) => ({
        [field]: { $options: "i", $regex: pattern },
      }));
    });
  });
}

function createExactRegexConditions(field, values, definitions = []) {
  return values.flatMap((value) => {
    const terms = definitions.length
      ? getAliasTerms(value, definitions)
      : [value];

    return terms.map((term) => ({
      [field]: { $options: "i", $regex: `^${escapeRegExp(term)}$` },
    }));
  });
}

function buildPublicSearchText(property) {
  return [
    property.title,
    property.propertyType,
    property.description,
    property.address,
    property.formattedAddress,
    property.city,
    property.district,
    property.ward,
    property.street,
    property.addressLine,
    property.projectName,
    property.locationNote,
    property.furnishing,
    ...(property.amenities ?? []),
    ...(property.nearbyPlaces ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function getSearchTokens(value = "") {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token && !PUBLIC_SEARCH_STOP_WORDS.has(token));
}

function matchesPropertyKeyword(property, keyword) {
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) {
    return true;
  }

  const searchableText = buildPublicSearchText(property);
  const normalizedSearchableText = normalizeSearchText(searchableText);

  if (normalizedSearchableText.includes(normalizedKeyword)) {
    return true;
  }

  const searchableTokens = new Set(getSearchTokens(searchableText));
  const keywordTokens = getSearchTokens(keyword);

  if (!keywordTokens.length) {
    return true;
  }

  return keywordTokens.every(
    (token) =>
      searchableTokens.has(token) || normalizedSearchableText.includes(token),
  );
}

function getPublicSearchQueryCriteria(query) {
  const keyword = String(query.keyword ?? "").trim();
  const structuredKeywordTerms = [
    ...collectMatchedAliasTerms(keyword, PUBLIC_PROPERTY_TYPE_ALIASES),
    ...collectMatchedAliasTerms(keyword, PUBLIC_DISTRICT_ALIASES),
    ...collectMatchedAliasTerms(keyword, PUBLIC_CITY_ALIASES),
    ...PUBLIC_BROAD_SEARCH_TERMS,
  ];

  return {
    bathrooms: query.bathrooms,
    bedrooms: query.bedrooms,
    city: String(query.city ?? "").trim(),
    cities: uniqueValues([
      ...normalizeAliasedFilterValues(query.city, PUBLIC_CITY_ALIASES),
      ...collectAliasValues(keyword, PUBLIC_CITY_ALIASES),
    ]),
    district: String(query.district ?? "").trim(),
    districts: uniqueValues([
      ...normalizeAliasedFilterValues(query.district, PUBLIC_DISTRICT_ALIASES),
      ...collectAliasValues(keyword, PUBLIC_DISTRICT_ALIASES),
    ]),
    keyword,
    maxArea: query.maxArea,
    maxPrice: query.maxPrice,
    minArea: query.minArea,
    minPrice: query.minPrice,
    propertyTypes: uniqueValues([
      ...normalizeAliasedFilterValues(
        query.propertyType,
        PUBLIC_PROPERTY_TYPE_ALIASES,
      ),
      ...collectAliasValues(keyword, PUBLIC_PROPERTY_TYPE_ALIASES),
    ]),
    ward: String(query.ward ?? "").trim(),
    keywordSearchText: removeSearchTerms(keyword, structuredKeywordTerms),
  };
}

function getPropertySearchRelevanceScore(property, criteria) {
  const searchableText = buildPublicSearchText(property);
  const normalizedSearchableText = normalizeSearchText(searchableText);
  const normalizedKeyword = normalizeSearchText(criteria.keywordSearchText);
  let score = 0;

  if (
    normalizedKeyword &&
    normalizedSearchableText.includes(normalizedKeyword)
  ) {
    score += 80;
  }

  score +=
    getSearchTokens(criteria.keywordSearchText).filter((token) =>
      normalizedSearchableText.includes(token),
    ).length * 8;
  score +=
    criteria.propertyTypes.filter((value) =>
      includesSearchPhrase(property.propertyType, value),
    ).length * 24;
  score +=
    criteria.districts.filter((value) =>
      includesSearchPhrase(property.district, value),
    ).length * 24;

  return score;
}

function sortPropertiesForPublicSearch(properties, criteria) {
  return [...properties].sort((left, right) => {
    const scoreDiff =
      getPropertySearchRelevanceScore(right, criteria) -
      getPropertySearchRelevanceScore(left, criteria);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  });
}

function buildUpdatedPropertyImages(currentImages, uploadedImages, payload) {
  const currentImageMap = new Map();
  const uploadedPropertyImages = uploadedImages.map(mapUploadedImage);

  currentImages.forEach((image) => {
    if (image.publicId) {
      currentImageMap.set(`public:${image.publicId}`, image);
    }

    if (image.url) {
      currentImageMap.set(`url:${image.url}`, image);
    }
  });

  if (Array.isArray(payload.imageOrder)) {
    const usedExistingKeys = new Set();
    const usedUploadIndexes = new Set();
    const orderedImages = [];

    payload.imageOrder.forEach((item) => {
      if (item.source === "existing") {
        const existingImage = getExistingImageFromMap(currentImageMap, item);
        const existingKey = existingImage
          ? getPropertyImageKey(existingImage)
          : "";

        if (
          existingImage &&
          existingKey &&
          !usedExistingKeys.has(existingKey)
        ) {
          orderedImages.push(existingImage);
          usedExistingKeys.add(existingKey);
        }
        return;
      }

      const uploadedImage = uploadedPropertyImages[item.fileIndex];

      if (uploadedImage && !usedUploadIndexes.has(item.fileIndex)) {
        orderedImages.push(uploadedImage);
        usedUploadIndexes.add(item.fileIndex);
      }
    });

    uploadedPropertyImages.forEach((uploadedImage, index) => {
      if (!usedUploadIndexes.has(index)) {
        orderedImages.push(uploadedImage);
      }
    });

    return orderedImages;
  }

  if (Array.isArray(payload.existingImages)) {
    return [
      ...payload.existingImages
        .map((image) => getExistingImageFromMap(currentImageMap, image))
        .filter(Boolean),
      ...uploadedPropertyImages,
    ];
  }

  return [...currentImages, ...uploadedPropertyImages];
}

async function deleteRemovedPropertyImages(currentImages, nextImages) {
  const nextImageKeys = new Set(nextImages.map(getPropertyImageKey));

  await Promise.all(
    currentImages
      .filter((image) => !nextImageKeys.has(getPropertyImageKey(image)))
      .map((image) => image.publicId)
      .filter(Boolean)
      .map((publicId) => deleteAsset(publicId).catch(() => null)),
  );
}

function buildQueryFilters(query) {
  const criteria = getPublicSearchQueryCriteria(query);
  const filters = {
    status: PROPERTY_STATUS.ACTIVE,
  };
  const andConditions = [];

  if (query.owner) {
    filters.owner = query.owner;
  }

  if (criteria.propertyTypes.length) {
    andConditions.push({
      $or: createExactRegexConditions(
        "propertyType",
        criteria.propertyTypes,
        PUBLIC_PROPERTY_TYPE_ALIASES,
      ),
    });
  }

  if (criteria.districts.length) {
    const exactDistrictConditions = createExactRegexConditions(
      "district",
      criteria.districts,
      PUBLIC_DISTRICT_ALIASES,
    );

    andConditions.push({
      $or: criteria.district
        ? [
            ...exactDistrictConditions,
            {
              district: { $in: [null, ""] },
              $or: createContainsRegexConditions(
                ["address", "formattedAddress"],
                criteria.districts,
                PUBLIC_DISTRICT_ALIASES,
              ),
            },
          ]
        : [
            ...exactDistrictConditions,
            ...createContainsRegexConditions(
              ["address", "formattedAddress", "locationNote", "nearbyPlaces"],
              criteria.districts,
              PUBLIC_DISTRICT_ALIASES,
            ),
          ],
    });
  }

  if (criteria.cities.length) {
    andConditions.push({
      $or: createContainsRegexConditions(
        ["city", "address", "formattedAddress"],
        criteria.cities,
        PUBLIC_CITY_ALIASES,
      ),
    });
  }

  if (criteria.ward) {
    andConditions.push({
      $or: createContainsRegexConditions(
        ["ward", "address", "formattedAddress"],
        [criteria.ward],
      ),
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

  if (criteria.bedrooms !== undefined) {
    filters.bedrooms = { $gte: criteria.bedrooms };
  }

  if (criteria.bathrooms !== undefined) {
    filters.bathrooms = { $gte: criteria.bathrooms };
  }

  if (andConditions.length) {
    filters.$and = andConditions;
  }

  return { criteria, filters };
}

export async function listProperties(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const { criteria, filters } = buildQueryFilters(query);

  if (criteria.keywordSearchText) {
    const matchingItems = sortPropertiesForPublicSearch(
      (
        await Property.find(filters)
          .populate("owner", "fullName email phone roles")
          .sort({ createdAt: -1 })
      ).filter((property) =>
        matchesPropertyKeyword(property, criteria.keywordSearchText),
      ),
      criteria,
    );
    const total = matchingItems.length;

    return {
      items: matchingItems.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  const [items, total] = await Promise.all([
    Property.find(filters)
      .populate("owner", "fullName email phone roles")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Property.countDocuments(filters),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listPropertiesByOwner(ownerId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const filters = { owner: ownerId };

  if (query.status) {
    filters.status = query.status;
  }

  const [items, total, statusCountEntries] = await Promise.all([
    Property.find(filters)
      .populate("owner", "fullName email phone roles")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Property.countDocuments(filters),
    Promise.all(
      PROPERTY_STATUS_LIST.map(async (status) => [
        status,
        await Property.countDocuments({ owner: ownerId, status }),
      ]),
    ),
  ]);
  const statusCounts = Object.fromEntries(statusCountEntries);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    statusCounts: {
      all: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      ...statusCounts,
    },
  };
}

export async function getPropertyById(propertyId) {
  const property = await Property.findById(propertyId).populate(
    "owner",
    "fullName email phone roles",
  );

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  return property;
}

export async function createProperty(ownerId, payload, files = []) {
  const owner = await User.findById(ownerId);

  if (!owner) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  if (owner.roles?.includes(ROLES.ADMIN)) {
    throw new ApiError(
      403,
      "Tài khoản admin không được sử dụng tính năng đăng tin.",
    );
  }

  if (!owner.canPostListing || owner.kycStatus !== "verified") {
    throw new ApiError(
      403,
      "Tài khoản cần được KYC xác thực trước khi có thể đăng tin.",
    );
  }
  const requestedStatus =
    payload.status === PROPERTY_STATUS.DRAFT
      ? PROPERTY_STATUS.DRAFT
      : PROPERTY_STATUS.PENDING;
  const listingPackagePrice =
    requestedStatus === PROPERTY_STATUS.DRAFT
      ? 0
      : Number(payload.package?.totalPrice ?? 0);

  await assertWalletCanSpend(ownerId, listingPackagePrice);

  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });
  const propertyFields = { ...payload };
  delete propertyFields.status;

  const propertyPayload = {
    ...propertyFields,
    status: requestedStatus,
    publishedAt: requestedStatus === PROPERTY_STATUS.ACTIVE ? new Date() : null,
    owner: ownerId,
    images: uploadedImages.map((image) => ({
      url: image.secureUrl,
      publicId: image.publicId,
    })),
  };

  const property = await Property.create(propertyPayload);

  try {
    await spendWalletForListing(ownerId, listingPackagePrice, {
      description: "Thanh toán gói đăng tin",
      propertyId: property._id,
      metadata: {
        package: property.package,
        propertyTitle: property.title,
      },
    });
  } catch (error) {
    await property.deleteOne().catch(() => null);
    await Promise.all(
      uploadedImages
        .map((image) => image.publicId)
        .filter(Boolean)
        .map((publicId) => deleteAsset(publicId).catch(() => null)),
    );
    throw error;
  }

  return property;
}

export async function updateProperty(propertyId, actor, payload, files = []) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  const isOwner = property.owner.toString() === actor._id.toString();
  const isAdmin =
    Array.isArray(actor.roles) && actor.roles.includes(ROLES.ADMIN);

  if (isAdmin) {
    throw new ApiError(
      403,
      "Tài khoản admin không được sử dụng tính năng chỉnh sửa tin cá nhân.",
    );
  }

  if (!isOwner) {
    throw new ApiError(403, "Bạn không thể chỉnh sửa tin đăng này.");
  }

  if (!actor.canPostListing || actor.kycStatus !== "verified") {
    throw new ApiError(
      403,
      "Tài khoản cần được KYC xác thực trước khi sửa tin đăng.",
    );
  }

  const payloadKeys = Object.keys(payload).filter(
    (key) => !["existingImages", "imageOrder"].includes(key),
  );
  const isStatusOnlyUpdate =
    files.length === 0 &&
    payloadKeys.length === 1 &&
    payloadKeys[0] === "status";

  if (!isAdmin && isStatusOnlyUpdate) {
    const isAllowedVisibilityTransition =
      (property.status === PROPERTY_STATUS.ACTIVE &&
        payload.status === PROPERTY_STATUS.HIDDEN) ||
      (property.status === PROPERTY_STATUS.HIDDEN &&
        payload.status === PROPERTY_STATUS.ACTIVE &&
        !property.moderationReason);

    if (
      !isAllowedVisibilityTransition &&
      payload.status !== PROPERTY_STATUS.DRAFT
    ) {
      throw new ApiError(
        400,
        property.status === PROPERTY_STATUS.HIDDEN && property.moderationReason
          ? "Tin đã bị quản trị viên ẩn. Vui lòng chỉnh sửa và gửi duyệt lại."
          : "Trạng thái tin đăng này chỉ có thể được cập nhật bởi quản trị viên.",
      );
    }
  }

  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });
  const currentImages = property.images.map(serializePropertyImage);
  const { existingImages, imageOrder, ...propertyPayload } = payload;

  Object.assign(property, propertyPayload);

  const hasContentChanges =
    !isAdmin &&
    (files.length > 0 ||
      payloadKeys.some((key) => key !== "status") ||
      Array.isArray(existingImages) ||
      Array.isArray(imageOrder));

  if (hasContentChanges && payload.status !== PROPERTY_STATUS.DRAFT) {
    property.status = PROPERTY_STATUS.PENDING;
    property.publishedAt = null;
    property.rejectionReason = null;
    property.moderationReason = null;
    property.reviewedBy = null;
    property.reviewedAt = null;
  }

  if (property.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  if (property.status === PROPERTY_STATUS.DRAFT) {
    property.publishedAt = null;
  }

  if (
    uploadedImages.length > 0 ||
    Array.isArray(existingImages) ||
    Array.isArray(imageOrder)
  ) {
    const nextImages = buildUpdatedPropertyImages(
      currentImages,
      uploadedImages,
      {
        existingImages,
        imageOrder,
      },
    );

    property.images = nextImages;
    await deleteRemovedPropertyImages(currentImages, nextImages);
  }

  await property.save();
  return property;
}

export async function updatePropertyStatus(propertyId, reviewerId, payload) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  property.status = payload.status;
  const moderationReason = payload.reason ?? payload.rejectionReason ?? null;
  property.moderationReason = [
    PROPERTY_STATUS.REJECTED,
    PROPERTY_STATUS.HIDDEN,
  ].includes(payload.status)
    ? moderationReason
    : null;
  property.rejectionReason =
    payload.status === PROPERTY_STATUS.REJECTED ? moderationReason : null;
  property.reviewedBy = reviewerId;
  property.reviewedAt = new Date();

  if (payload.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  if (payload.status === PROPERTY_STATUS.PENDING) {
    property.publishedAt = null;
  }

  await property.save();
  await property.populate("owner", "fullName email phone");
  await sendListingStatusNotification(property).catch(() => null);
  return property;
}

export async function deleteProperty(propertyId, actor) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  const isOwner = property.owner.toString() === actor._id.toString();
  const isAdmin =
    Array.isArray(actor.roles) && actor.roles.includes(ROLES.ADMIN);

  if (isAdmin) {
    throw new ApiError(
      403,
      "Tài khoản admin không được sử dụng tính năng xóa tin cá nhân.",
    );
  }

  if (!isOwner) {
    throw new ApiError(403, "Bạn không thể xóa tin đăng này.");
  }

  await property.deleteOne();

  await Promise.all(
    property.images
      .map((image) => image.publicId)
      .filter(Boolean)
      .map((publicId) => deleteAsset(publicId).catch(() => null)),
  );
}
