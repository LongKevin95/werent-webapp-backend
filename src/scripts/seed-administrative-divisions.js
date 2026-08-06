import { connectDatabase, disconnectDatabase } from "../config/db.js";
import AdministrativeDivision from "../modules/administrative-divisions/administrative-division.model.js";

const SOURCE_BASE_URL =
  process.env.ADMINISTRATIVE_DIVISIONS_SOURCE_BASE_URL ??
  "https://provinces.open-api.vn/api/v1";
const SOURCE_TREE_URL = `${SOURCE_BASE_URL}/?depth=3`;
const SOURCE_VERSION_URL = `${SOURCE_BASE_URL}/version`;
const SOURCE_NAME = "provinces.open-api.vn";
const VERSION = "v1";

function normalizeWard(ward) {
  return {
    code: ward.code,
    codename: ward.codename,
    districtCode: ward.district_code,
    divisionType: ward.division_type,
    name: ward.name,
  };
}

function normalizeDistrict(district) {
  return {
    code: district.code,
    codename: district.codename,
    divisionType: district.division_type,
    name: district.name,
    provinceCode: district.province_code,
    wards: (district.wards ?? []).map(normalizeWard),
  };
}

function normalizeProvince(province, dataVersion) {
  return {
    code: province.code,
    codename: province.codename,
    dataVersion,
    districts: (province.districts ?? []).map(normalizeDistrict),
    divisionType: province.division_type,
    name: province.name,
    phoneCode: province.phone_code ?? null,
    source: SOURCE_NAME,
    version: VERSION,
  };
}

function countDistricts(provinces) {
  return provinces.reduce(
    (total, province) => total + (province.districts?.length ?? 0),
    0,
  );
}

function countWards(provinces) {
  return provinces.reduce(
    (total, province) =>
      total +
      (province.districts ?? []).reduce(
        (districtTotal, district) =>
          districtTotal + (district.wards?.length ?? 0),
        0,
      ),
    0,
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}.`);
  }

  return response.json();
}

async function getSourceDataVersion() {
  try {
    const payload = await fetchJson(SOURCE_VERSION_URL);
    return payload?.data_version ?? "";
  } catch {
    return "";
  }
}

async function seedAdministrativeDivisions() {
  await connectDatabase();

  const [sourceProvinces, dataVersion] = await Promise.all([
    fetchJson(SOURCE_TREE_URL),
    getSourceDataVersion(),
  ]);

  if (!Array.isArray(sourceProvinces) || sourceProvinces.length === 0) {
    throw new Error("Administrative division source returned no provinces.");
  }

  const provinces = sourceProvinces.map((province) =>
    normalizeProvince(province, dataVersion),
  );

  await AdministrativeDivision.bulkWrite(
    provinces.map((province) => ({
      updateOne: {
        filter: {
          code: province.code,
          version: VERSION,
        },
        update: {
          $set: province,
        },
        upsert: true,
      },
    })),
  );

  console.log("Seeded Vietnamese administrative divisions successfully.");
  console.log(`Source: ${SOURCE_TREE_URL}`);
  console.log(`Version: ${VERSION}${dataVersion ? ` (${dataVersion})` : ""}`);
  console.log(`Provinces: ${provinces.length}`);
  console.log(`Districts: ${countDistricts(provinces)}`);
  console.log(`Wards: ${countWards(provinces)}`);
}

seedAdministrativeDivisions()
  .catch((error) => {
    console.error("Failed to seed administrative divisions:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
