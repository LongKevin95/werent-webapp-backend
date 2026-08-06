import AdministrativeDivision from "./administrative-division.model.js";

const ADMINISTRATIVE_DIVISION_VERSION = "v1";

function serializeWard(ward) {
  return {
    code: ward.code,
    codename: ward.codename,
    districtCode: ward.districtCode,
    divisionType: ward.divisionType,
    name: ward.name,
  };
}

function serializeDistrict(district) {
  return {
    code: district.code,
    codename: district.codename,
    divisionType: district.divisionType,
    name: district.name,
    provinceCode: district.provinceCode,
    wards: (district.wards ?? []).map(serializeWard),
  };
}

function serializeProvince(province) {
  return {
    code: province.code,
    codename: province.codename,
    dataVersion: province.dataVersion,
    districts: (province.districts ?? []).map(serializeDistrict),
    divisionType: province.divisionType,
    name: province.name,
    phoneCode: province.phoneCode,
    source: province.source,
    version: province.version,
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

export async function listAdministrativeDivisions() {
  const provinces = await AdministrativeDivision.find({
    version: ADMINISTRATIVE_DIVISION_VERSION,
  })
    .sort({ code: 1 })
    .lean();

  const serializedProvinces = provinces.map(serializeProvince);

  return {
    metadata: {
      districts: countDistricts(serializedProvinces),
      isSeeded: serializedProvinces.length > 0,
      provinces: serializedProvinces.length,
      version: ADMINISTRATIVE_DIVISION_VERSION,
      wards: countWards(serializedProvinces),
    },
    provinces: serializedProvinces,
  };
}
