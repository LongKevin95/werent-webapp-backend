import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  PROPERTY_PACKAGE_TIER,
  PROPERTY_STATUS,
  ROLES,
} from "../common/constants.js";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import Property from "../modules/properties/property.model.js";
import User from "../modules/users/user.model.js";

const TEMP_PASSWORD = "12345678";
const PREVIOUS_SEED_OWNER_EMAIL = "search-seed@werent.test";
const SEED_OWNER_ID = "6a68c5b8426e8fd9a31f28a0";
const SEED_OWNER_EMAIL = "benchothue@gmail.com";
const SEED_OWNER_PHONE = "444555666";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function buildImageUrls(seed) {
  return [1, 2, 3].map((index) => ({
    url: `https://picsum.photos/seed/werent-${seed}-${index}/1200/800`,
    publicId: null,
  }));
}

function buildPackage(tier = PROPERTY_PACKAGE_TIER.STANDARD) {
  return {
    tier,
    durationKey: "30days",
    durationDays: 30,
    pricePerDay: 0,
    totalPrice: 0,
  };
}

function buildProperty({
  title,
  propertyType,
  price,
  area,
  bedrooms = 1,
  bathrooms = 1,
  city = "TP. Hồ Chí Minh",
  district,
  ward,
  street,
  addressLine,
  projectName = "",
  locationNote = "",
  seed,
  amenities = [],
  nearbyPlaces = [],
  tier,
  createdOffsetDays = 0,
}) {
  const address = [addressLine, street, ward, district, city]
    .filter(Boolean)
    .join(", ");
  const createdAt = new Date(Date.now() - createdOffsetDays * DAY_IN_MS);

  return {
    title,
    propertyType,
    description:
      "Tin seed dùng để kiểm thử tìm kiếm theo loại hình, quận, phường, dự án và địa danh. Ảnh dùng URL ngoài, không upload lên Cloudinary.",
    address,
    city,
    district,
    ward,
    street,
    addressLine,
    projectName,
    locationNote,
    formattedAddress: address,
    price,
    depositAmount: price,
    area,
    bedrooms,
    bathrooms,
    furnishing: "Nội thất cơ bản",
    moveInDays: 7,
    amenities,
    nearbyPlaces,
    package: buildPackage(tier),
    images: buildImageUrls(seed),
    contactName: "WeRent Seed Owner",
    contactPhone: SEED_OWNER_PHONE,
    contactEmail: SEED_OWNER_EMAIL,
    status: PROPERTY_STATUS.ACTIVE,
    publishedAt: createdAt,
    expiresAt: new Date(Date.now() + 30 * DAY_IN_MS),
    createdAt,
    updatedAt: createdAt,
    isFeatured: tier === PROPERTY_PACKAGE_TIER.VIP_GOLD,
  };
}

const seedProperties = [
  buildProperty({
    title: "Phòng trọ mới gần chợ Bà Chiểu, Bình Thạnh",
    propertyType: "Phòng trọ",
    price: 4200000,
    area: 24,
    district: "Quận Bình Thạnh",
    ward: "Phường 1",
    street: "Bạch Đằng",
    addressLine: "Hẻm 42",
    locationNote: "Gần chợ Bà Chiểu, Đại học Hutech",
    seed: "phong-tro-binh-thanh-ba-chieu",
    amenities: ["wifi", "camera", "máy lạnh"],
    nearbyPlaces: ["Chợ Bà Chiểu", "Đại học Hutech", "Pearl Plaza"],
    createdOffsetDays: 1,
  }),
  buildProperty({
    title: "Căn hộ 2 phòng ngủ Pearl Plaza Bình Thạnh",
    propertyType: "Căn hộ chung cư",
    price: 14500000,
    area: 72,
    bedrooms: 2,
    bathrooms: 2,
    district: "Quận Bình Thạnh",
    ward: "Phường 25",
    street: "Điện Biên Phủ",
    addressLine: "Căn 18.08",
    projectName: "Pearl Plaza Residence",
    locationNote: "Gần cầu Sài Gòn",
    seed: "can-ho-pearl-plaza-binh-thanh",
    amenities: ["hồ bơi", "gym", "bãi xe"],
    nearbyPlaces: ["Pearl Plaza", "Cầu Sài Gòn", "Hàng Xanh"],
    tier: PROPERTY_PACKAGE_TIER.VIP_GOLD,
    createdOffsetDays: 2,
  }),
  buildProperty({
    title: "Nhà nguyên căn hẻm xe hơi Xô Viết Nghệ Tĩnh",
    propertyType: "Nhà nguyên căn",
    price: 18000000,
    area: 96,
    bedrooms: 3,
    bathrooms: 3,
    district: "Quận Bình Thạnh",
    ward: "Phường 21",
    street: "Xô Viết Nghệ Tĩnh",
    addressLine: "Hẻm 208",
    locationNote: "Gần Hàng Xanh",
    seed: "nha-nguyen-can-binh-thanh-hang-xanh",
    amenities: ["ban công", "sân để xe", "máy lạnh"],
    nearbyPlaces: ["Hàng Xanh", "Đại học Ngoại thương", "Landmark 81"],
    createdOffsetDays: 3,
  }),
  buildProperty({
    title: "Phòng trọ giá tốt gần Aeon Mall Bình Tân",
    propertyType: "Phòng trọ",
    price: 3500000,
    area: 20,
    district: "Quận Bình Tân",
    ward: "Phường Bình Trị Đông B",
    street: "Đường số 17A",
    addressLine: "Số 18/5",
    locationNote: "Gần Aeon Mall Bình Tân",
    seed: "phong-tro-binh-tan-aeon",
    amenities: ["wifi", "camera", "gác lửng"],
    nearbyPlaces: ["Aeon Mall Bình Tân", "Bến xe Miền Tây"],
    createdOffsetDays: 4,
  }),
  buildProperty({
    title: "Nhà riêng Bình Tân gần đường Tên Lửa",
    propertyType: "Nhà riêng",
    price: 12500000,
    area: 82,
    bedrooms: 3,
    bathrooms: 2,
    district: "Quận Bình Tân",
    ward: "Phường An Lạc A",
    street: "Tên Lửa",
    addressLine: "Số 91",
    locationNote: "Khu Tên Lửa",
    seed: "nha-rieng-binh-tan-ten-lua",
    amenities: ["sân để xe", "bếp", "máy lạnh"],
    nearbyPlaces: ["Đường Tên Lửa", "Aeon Mall Bình Tân"],
    createdOffsetDays: 5,
  }),
  buildProperty({
    title: "Căn hộ Sunrise City gần Nguyễn Hữu Thọ Quận 7",
    propertyType: "Căn hộ chung cư",
    price: 16000000,
    area: 76,
    bedrooms: 2,
    bathrooms: 2,
    district: "Quận 7",
    ward: "Phường Tân Hưng",
    street: "Nguyễn Hữu Thọ",
    addressLine: "Block W2",
    projectName: "Sunrise City",
    locationNote: "Gần Lotte Mart Quận 7",
    seed: "can-ho-sunrise-city-quan-7",
    amenities: ["hồ bơi", "gym", "bảo vệ"],
    nearbyPlaces: ["Lotte Mart Quận 7", "Nguyễn Hữu Thọ", "Đại học RMIT"],
    tier: PROPERTY_PACKAGE_TIER.VIP_GOLD,
    createdOffsetDays: 6,
  }),
  buildProperty({
    title: "Nhà phố Phú Mỹ Hưng khu yên tĩnh",
    propertyType: "Nhà phố",
    price: 32000000,
    area: 120,
    bedrooms: 4,
    bathrooms: 4,
    district: "Quận 7",
    ward: "Phường Tân Phong",
    street: "Nguyễn Đức Cảnh",
    addressLine: "Số 22",
    projectName: "Phú Mỹ Hưng",
    locationNote: "Khu đô thị Phú Mỹ Hưng",
    seed: "nha-pho-phu-my-hung-quan-7",
    amenities: ["sân vườn", "gara", "bếp"],
    nearbyPlaces: ["Phú Mỹ Hưng", "Crescent Mall", "Hồ Bán Nguyệt"],
    createdOffsetDays: 7,
  }),
  buildProperty({
    title: "Phòng trọ sinh viên gần Đại học RMIT",
    propertyType: "Phòng trọ",
    price: 4800000,
    area: 26,
    district: "Quận 7",
    ward: "Phường Tân Phong",
    street: "Nguyễn Văn Linh",
    addressLine: "Hẻm 105",
    locationNote: "Gần Đại học RMIT",
    seed: "phong-tro-rmit-quan-7",
    amenities: ["wifi", "camera", "máy lạnh"],
    nearbyPlaces: ["Đại học RMIT", "Tôn Đức Thắng", "Crescent Mall"],
    createdOffsetDays: 8,
  }),
  buildProperty({
    title: "Căn hộ Vinhomes Grand Park view công viên",
    propertyType: "Căn hộ chung cư",
    price: 9500000,
    area: 58,
    bedrooms: 2,
    bathrooms: 1,
    district: "TP. Thủ Đức",
    ward: "Phường Long Bình",
    street: "Nguyễn Xiển",
    addressLine: "S2.03",
    projectName: "Vinhomes Grand Park",
    locationNote: "Gần bến xe Miền Đông mới",
    seed: "vinhomes-grand-park-thu-duc",
    amenities: ["hồ bơi", "gym", "công viên"],
    nearbyPlaces: ["Vinhomes Grand Park", "Bến xe Miền Đông mới"],
    tier: PROPERTY_PACKAGE_TIER.VIP_GOLD,
    createdOffsetDays: 9,
  }),
  buildProperty({
    title: "Căn hộ The Sun Avenue Mai Chí Thọ",
    propertyType: "Căn hộ chung cư",
    price: 13500000,
    area: 68,
    bedrooms: 2,
    bathrooms: 2,
    district: "TP. Thủ Đức",
    ward: "Phường An Phú",
    street: "Mai Chí Thọ",
    addressLine: "Block SAV3",
    projectName: "The Sun Avenue",
    locationNote: "Gần khu Sala Quận 2",
    seed: "the-sun-avenue-quan-2",
    amenities: ["hồ bơi", "gym", "bãi xe"],
    nearbyPlaces: ["Khu Sala Quận 2", "Mai Chí Thọ", "Metro An Phú"],
    createdOffsetDays: 10,
  }),
  buildProperty({
    title: "Căn hộ New City Thủ Thiêm gần khu Sala",
    propertyType: "Căn hộ chung cư",
    price: 15500000,
    area: 75,
    bedrooms: 2,
    bathrooms: 2,
    district: "TP. Thủ Đức",
    ward: "Phường An Khánh",
    street: "Mai Chí Thọ",
    addressLine: "Căn 12A",
    projectName: "New City Thủ Thiêm",
    locationNote: "Khu Sala Quận 2",
    seed: "new-city-thu-thiem-sala",
    amenities: ["hồ bơi", "gym", "bảo vệ"],
    nearbyPlaces: ["Khu Sala Quận 2", "Thủ Thiêm", "Hầm Thủ Thiêm"],
    createdOffsetDays: 11,
  }),
  buildProperty({
    title: "Phòng trọ Thảo Điền gần Quốc Hương",
    propertyType: "Phòng trọ",
    price: 6200000,
    area: 28,
    district: "TP. Thủ Đức",
    ward: "Phường Thảo Điền",
    street: "Quốc Hương",
    addressLine: "Hẻm 39",
    locationNote: "Thảo Điền",
    seed: "phong-tro-thao-dien",
    amenities: ["wifi", "máy lạnh", "máy giặt"],
    nearbyPlaces: ["Thảo Điền", "Xuân Thủy", "Metro An Phú"],
    createdOffsetDays: 12,
  }),
  buildProperty({
    title: "Căn hộ Landmark 81 Vinhomes Central Park",
    propertyType: "Căn hộ chung cư",
    price: 28000000,
    area: 90,
    bedrooms: 2,
    bathrooms: 2,
    district: "Quận Bình Thạnh",
    ward: "Phường 22",
    street: "Nguyễn Hữu Cảnh",
    addressLine: "Landmark 81",
    projectName: "Vinhomes Central Park",
    locationNote: "Landmark 81",
    seed: "landmark-81-central-park",
    amenities: ["hồ bơi", "gym", "view sông"],
    nearbyPlaces: ["Landmark 81", "Vinhomes Central Park", "Cầu Sài Gòn"],
    tier: PROPERTY_PACKAGE_TIER.VIP_GOLD,
    createdOffsetDays: 13,
  }),
  buildProperty({
    title: "Văn phòng nhỏ gần Hồ Con Rùa Quận 3",
    propertyType: "Văn phòng",
    price: 12000000,
    area: 45,
    bedrooms: 0,
    bathrooms: 1,
    district: "Quận 3",
    ward: "Phường Võ Thị Sáu",
    street: "Trần Cao Vân",
    addressLine: "Lầu 2",
    locationNote: "Gần Hồ Con Rùa",
    seed: "van-phong-ho-con-rua-quan-3",
    amenities: ["máy lạnh", "thang máy", "bảo vệ"],
    nearbyPlaces: ["Hồ Con Rùa", "Nhà văn hóa Thanh Niên"],
    createdOffsetDays: 14,
  }),
  buildProperty({
    title: "Nhà mặt tiền gần Bến Thành Quận 1",
    propertyType: "Nhà mặt tiền",
    price: 45000000,
    area: 100,
    bedrooms: 3,
    bathrooms: 3,
    district: "Quận 1",
    ward: "Phường Bến Thành",
    street: "Lý Tự Trọng",
    addressLine: "Số 112",
    locationNote: "Gần chợ Bến Thành",
    seed: "nha-mat-tien-ben-thanh-quan-1",
    amenities: ["mặt tiền", "kinh doanh", "máy lạnh"],
    nearbyPlaces: ["Chợ Bến Thành", "Phố đi bộ Nguyễn Huệ"],
    createdOffsetDays: 15,
  }),
  buildProperty({
    title: "Đất thuê làm kho gần Nguyễn Văn Linh Nhà Bè",
    propertyType: "Đất nền",
    price: 22000000,
    area: 240,
    bedrooms: 0,
    bathrooms: 0,
    district: "Huyện Nhà Bè",
    ward: "Xã Phước Kiển",
    street: "Nguyễn Văn Linh",
    addressLine: "Lô A12",
    locationNote: "Gần cầu Phú Mỹ",
    seed: "dat-kho-nha-be-cau-phu-my",
    amenities: ["xe tải vào được", "mặt bằng trống"],
    nearbyPlaces: ["Cầu Phú Mỹ", "Nguyễn Văn Linh", "Khu Phước Kiển"],
    createdOffsetDays: 16,
  }),
  buildProperty({
    title: "Biệt thự Thảo Điền sân vườn rộng",
    propertyType: "Biệt thự",
    price: 65000000,
    area: 260,
    bedrooms: 5,
    bathrooms: 5,
    district: "TP. Thủ Đức",
    ward: "Phường Thảo Điền",
    street: "Nguyễn Văn Hưởng",
    addressLine: "Villa 08",
    projectName: "Thảo Điền Compound",
    locationNote: "Khu Thảo Điền",
    seed: "biet-thu-thao-dien",
    amenities: ["sân vườn", "hồ bơi", "gara"],
    nearbyPlaces: ["Thảo Điền", "Sông Sài Gòn", "Metro An Phú"],
    tier: PROPERTY_PACKAGE_TIER.VIP_GOLD,
    createdOffsetDays: 17,
  }),
];

async function ensureSeedOwner() {
  const ownerObjectId = new mongoose.Types.ObjectId(SEED_OWNER_ID);
  const email = User.normalizeEmail(SEED_OWNER_EMAIL);
  const phone = User.normalizePhone(SEED_OWNER_PHONE);
  const owner = await User.findOne({ _id: ownerObjectId, email });

  if (owner) {
    return owner;
  }

  const [existingById, existingByEmail] = await Promise.all([
    User.findById(ownerObjectId),
    User.findOne({ email }),
  ]);

  if (existingById && existingById.email !== email) {
    throw new Error(
      `User id ${SEED_OWNER_ID} belongs to ${existingById.email}, not ${email}.`,
    );
  }

  if (existingByEmail && existingByEmail._id.toString() !== SEED_OWNER_ID) {
    throw new Error(
      `Email ${email} belongs to ${existingByEmail._id}, not ${SEED_OWNER_ID}.`,
    );
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  return User.findOneAndUpdate(
    { _id: ownerObjectId },
    {
      $setOnInsert: {
        fullName: "Khách cho thuê",
        email,
        phone,
        passwordHash,
        roles: [ROLES.USER],
        isActive: true,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function seedSearchProperties() {
  await connectDatabase();

  const owner = await ensureSeedOwner();
  const seedTitles = seedProperties.map((property) => property.title);

  await Property.deleteMany({
    title: { $in: seedTitles },
    $or: [
      { owner: owner._id },
      { contactEmail: SEED_OWNER_EMAIL },
      { contactEmail: PREVIOUS_SEED_OWNER_EMAIL },
    ],
  });
  await Property.insertMany(
    seedProperties.map((property) => ({
      ...property,
      owner: owner._id,
    })),
  );

  console.log(`Seeded ${seedProperties.length} search properties successfully.`);
  console.log("Images are external URLs with publicId=null; no uploads were created.");
  console.log(`Seed owner: ${SEED_OWNER_EMAIL} / ${TEMP_PASSWORD}`);
}

seedSearchProperties()
  .catch((error) => {
    console.error("Failed to seed search properties:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
