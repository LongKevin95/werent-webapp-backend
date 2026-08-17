import { autocompletePlaces } from "../maps/map.service.js";
import {
  HCMC_STREET_GROUPS,
  HCMC_STREET_SOURCE,
} from "./hcm-street-suggestion.data.js";

const HCMC_CITY_LABEL = "Hồ Chí Minh";
const HCMC_CITY_ALIASES = [
  "ho chi minh",
  "thanh pho ho chi minh",
  "tp ho chi minh",
  "tp hcm",
  "tphcm",
  "hcm",
  "sai gon",
  "saigon",
];
const STREET_PREFIX_PATTERN = /^(?:duong|pho|hem|quoc lo|tinh lo)\s+/;
const STREET_SUGGESTION_TEMPLATES = [
  "Mua bán BĐS tại {location}",
  "Thuê BĐS tại {location}",
  "Mua bán đất tại {location}",
  "Thuê nhà đất tại {location}",
  "Mua bán chung cư tại {location}",
  "Thuê chung cư tại {location}",
  "Thuê phòng trọ tại {location}",
  "Thuê nhà riêng tại {location}",
];
const DISTRICT_PRIORITY = [
  "quan 1",
  "quan 3",
  "quan 10",
  "quan binh thanh",
  "quan tan binh",
  "tp thu duc",
  "quan 7",
  "quan phu nhuan",
  "quan go vap",
  "quan tan phu",
  "quan binh tan",
  "quan 12",
  "huyen hoc mon",
  "huyen binh chanh",
  "huyen nha be",
  "huyen cu chi",
  "huyen can gio",
];
const REMOTE_STREET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REMOTE_STREET_CACHE_LIMIT = 300;
const remoteStreetCache = new Map();
const STREET_TOKEN_STOP_WORDS = new Set([
  "duong",
  "pho",
  "hem",
  "quoc",
  "tinh",
  "lo",
  "so",
]);

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStreetQuery(value = "") {
  return normalizeSearchText(value)
    .replace(STREET_PREFIX_PATTERN, "")
    .replace(/\b(thue|mua|ban|bds|bat dong san|nha dat|tai|gan)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStreetTokens(value = "") {
  return normalizeStreetQuery(value)
    .split(" ")
    .filter(
      (token) => token.length >= 3 && !STREET_TOKEN_STOP_WORDS.has(token),
    );
}

function getDistrictPriority(district = "") {
  const normalizedDistrict = normalizeSearchText(district);
  const index = DISTRICT_PRIORITY.findIndex((item) =>
    normalizedDistrict.includes(item),
  );

  return index >= 0 ? DISTRICT_PRIORITY.length - index : 0;
}

function getStreetDisplayName(street = "") {
  const trimmedStreet = String(street).trim();

  if (!trimmedStreet) {
    return "";
  }

  return /^(?:đường|phố|hẻm|quốc lộ|tỉnh lộ)\s/i.test(trimmedStreet)
    ? trimmedStreet
    : `Đường ${trimmedStreet}`;
}

function createStreetRecord({
  city = HCMC_CITY_LABEL,
  district = "",
  source = "seed",
  sourceName = HCMC_STREET_SOURCE.name,
  sourceOrder = 9999,
  street,
  ward = "",
}) {
  const streetName = getStreetDisplayName(street);

  if (!streetName || !district) {
    return null;
  }

  const normalizedStreet = normalizeStreetQuery(streetName);
  const normalizedDistrict = normalizeSearchText(district);
  const normalizedCity = normalizeSearchText(city);
  const aliases = [
    streetName,
    street,
    normalizedStreet,
    `${streetName} ${district}`,
    `${normalizedStreet} ${normalizedDistrict}`,
    `${streetName} ${city}`,
  ]
    .map(normalizeStreetQuery)
    .filter(Boolean);

  return {
    aliases: [...new Set(aliases)],
    city,
    district,
    districtPriority: getDistrictPriority(district),
    label: [streetName, ward, district, city].filter(Boolean).join(", "),
    normalizedCity,
    normalizedDistrict,
    normalizedStreet,
    source,
    sourceName,
    sourceOrder,
    street: streetName,
    ward,
  };
}

const seededStreetRecords = HCMC_STREET_GROUPS.flatMap((group, groupIndex) =>
  group.placements
    .map(([district, ward], placementIndex) =>
      createStreetRecord({
        district,
        sourceOrder: groupIndex * 100 + placementIndex,
        street: group.street,
        ward,
      }),
    )
    .filter(Boolean),
);

function getRecordKey(record) {
  return [
    record.normalizedStreet,
    normalizeSearchText(record.ward),
    record.normalizedDistrict,
    record.normalizedCity,
  ].join("|");
}

function getMatchScore(query, record) {
  const normalizedQuery = normalizeStreetQuery(query);

  if (normalizedQuery.length < 2) {
    return 0;
  }

  let streetScore = record.aliases.reduce((bestScore, alias) => {
    if (alias === normalizedQuery) {
      return Math.max(bestScore, 120);
    }

    if (alias.startsWith(normalizedQuery)) {
      return Math.max(bestScore, 105);
    }

    if (normalizedQuery.startsWith(alias) && alias.length >= 4) {
      return Math.max(bestScore, 92);
    }

    if (alias.includes(normalizedQuery) && normalizedQuery.length >= 4) {
      return Math.max(bestScore, 72);
    }

      return bestScore;
  }, 0);

  if (!streetScore) {
    const queryTokens = getStreetTokens(normalizedQuery);
    const recordTokens = new Set(getStreetTokens(record.normalizedStreet));
    const lastQueryToken = queryTokens.at(-1);
    const matchedTokens = queryTokens.filter((token) => recordTokens.has(token));

    if (!matchedTokens.length) {
      return 0;
    }

    if (
      queryTokens.length > 1 &&
      matchedTokens.length === 1 &&
      matchedTokens[0] !== lastQueryToken
    ) {
      return 0;
    }

    streetScore =
      24 +
      matchedTokens.length * 8 +
      (matchedTokens.includes(lastQueryToken) ? 6 : 0);
  }

  const normalizedDistrictInQuery = record.normalizedDistrict
    ? normalizedQuery.includes(record.normalizedDistrict)
    : false;
  const normalizedCityInQuery = HCMC_CITY_ALIASES.some((alias) =>
    normalizedQuery.includes(alias),
  );

  return (
    streetScore +
    (streetScore >= 70 && streetScore < 120 ? record.districtPriority : 0) +
    (normalizedDistrictInQuery ? 30 : 0) +
    (normalizedCityInQuery ? 12 : 0)
  );
}

function rememberRemoteStreetRecords(cacheKey, records) {
  remoteStreetCache.set(cacheKey, {
    expiresAt: Date.now() + REMOTE_STREET_CACHE_TTL_MS,
    records,
  });

  while (remoteStreetCache.size > REMOTE_STREET_CACHE_LIMIT) {
    const oldestKey = remoteStreetCache.keys().next().value;
    remoteStreetCache.delete(oldestKey);
  }

  return records;
}

function getCachedRemoteStreetRecords(cacheKey) {
  const cached = remoteStreetCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    remoteStreetCache.delete(cacheKey);
    return null;
  }

  remoteStreetCache.delete(cacheKey);
  remoteStreetCache.set(cacheKey, cached);
  return cached.records;
}

function isHcmPlace(place) {
  const text = normalizeSearchText(
    [
      place.displayName,
      place.formattedAddress,
      place.addressComponents?.city,
      place.addressComponents?.state,
      place.addressComponents?.county,
    ].filter(Boolean).join(" "),
  );

  return HCMC_CITY_ALIASES.some((alias) => text.includes(alias));
}

function createRemoteStreetRecord(place) {
  const properties = place.addressComponents ?? {};
  const street =
    properties.street ||
    properties.address_line1 ||
    place.displayName ||
    "";
  const district =
    properties.city_district ||
    properties.district ||
    properties.county ||
    properties.suburb ||
    "";
  const normalizedStreet = normalizeSearchText(street);

  if (!isHcmPlace(place)) {
    return null;
  }

  if (/^(?:phuong|xa|quan|huyen|thanh pho|tp|tinh)\b/.test(normalizedStreet)) {
    return null;
  }

  return createStreetRecord({
    city: HCMC_CITY_LABEL,
    district,
    source: "geoapify",
    sourceName: "Geoapify autocomplete fallback",
    street,
  });
}

async function fetchRemoteStreetRecords(query, limit) {
  const normalizedQuery = normalizeStreetQuery(query);
  const cacheKey = `hcm-street:${normalizedQuery}:${limit}`;
  const cached = getCachedRemoteStreetRecords(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const places = await autocompletePlaces({
      query: `${query}, Hồ Chí Minh`,
      lat: 10.7721,
      lng: 106.6983,
      limit: Math.min(Math.max(limit, 5), 10),
    });
    const records = places.map(createRemoteStreetRecord).filter(Boolean);

    return rememberRemoteStreetRecords(cacheKey, records);
  } catch {
    return rememberRemoteStreetRecords(cacheKey, []);
  }
}

function pickMatchedStreetRecords(query, records, maxRecords) {
  const seenRecords = new Set();

  return records
    .map((record) => ({
      ...record,
      score: getMatchScore(query, record),
    }))
    .filter((record) => record.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.sourceOrder - right.sourceOrder ||
        right.districtPriority - left.districtPriority ||
        left.label.length - right.label.length,
    )
    .filter((record) => {
      const key = getRecordKey(record);

      if (seenRecords.has(key)) {
        return false;
      }

      seenRecords.add(key);
      return true;
    })
    .slice(0, maxRecords);
}

function pushStreetSuggestionLabels(labels, templates, records, limit) {
  for (const template of templates) {
    for (const record of records) {
      labels.push(template.replace("{location}", record.label));

      if (labels.length >= limit) {
        return;
      }
    }
  }
}

function buildStreetSuggestionLabels(records, limit, keyword) {
  const normalizedKeyword = normalizeStreetQuery(keyword);
  const labels = [];
  const exactRecords = records.filter(
    (record) => record.normalizedStreet === normalizedKeyword,
  );
  const fuzzyRecords = records.filter(
    (record) => record.normalizedStreet !== normalizedKeyword,
  );

  if (exactRecords.length) {
    pushStreetSuggestionLabels(
      labels,
      STREET_SUGGESTION_TEMPLATES.slice(0, 3),
      exactRecords,
      limit,
    );

    if (labels.length < limit) {
      pushStreetSuggestionLabels(
        labels,
        STREET_SUGGESTION_TEMPLATES.slice(0, 1),
        fuzzyRecords,
        limit,
      );
    }

    if (labels.length < limit) {
      pushStreetSuggestionLabels(
        labels,
        STREET_SUGGESTION_TEMPLATES.slice(3),
        exactRecords,
        limit,
      );
    }

    return labels;
  }

  pushStreetSuggestionLabels(labels, STREET_SUGGESTION_TEMPLATES, records, limit);
  return labels;
}

export async function getSearchSuggestions(query = {}) {
  const keyword = String(query.keyword ?? query.q ?? "").trim();
  const limit = query.limit ?? 10;

  if (normalizeStreetQuery(keyword).length < 2) {
    return {
      items: [],
      source: {
        ...HCMC_STREET_SOURCE,
        remoteFallback: false,
      },
    };
  }

  const localRecords = pickMatchedStreetRecords(keyword, seededStreetRecords, 8);
  const remoteRecords =
    localRecords.length >= 4
      ? []
      : await fetchRemoteStreetRecords(keyword, 10);
  const matchedRecords = pickMatchedStreetRecords(
    keyword,
    [...localRecords, ...remoteRecords],
    6,
  );

  return {
    items: buildStreetSuggestionLabels(matchedRecords, limit, keyword).map((label) => ({
      label,
      type: "street",
    })),
    source: {
      ...HCMC_STREET_SOURCE,
      remoteFallback: remoteRecords.length > 0,
    },
  };
}
