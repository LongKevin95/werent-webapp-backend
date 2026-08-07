import bcrypt from "bcryptjs";
import { ROLES } from "../common/constants.js";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import User from "../modules/users/user.model.js";

const TEMP_PASSWORD = "12345678";

const seedUsers = [
  {
    fullName: "Admin WeRent",
    email: "admin@gmail.com",
    phone: "111222333",
    roles: [ROLES.ADMIN],
  },
  {
    fullName: "Khách cho thuê",
    email: "benchothue@gmail.com",
    phone: "444555666",
    roles: [ROLES.USER],
  },
  {
    fullName: "Khách thuê",
    email: "benthue@gmail.com",
    phone: "777888999",
    roles: [ROLES.USER],
  },
];

async function seedTestUsers() {
  await connectDatabase();

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const emails = seedUsers.map((user) => User.normalizeEmail(user.email));
  const phones = seedUsers.map((user) => User.normalizePhone(user.phone));

  await User.deleteMany({
    $or: [{ email: { $in: emails } }, { phone: { $in: phones } }],
  });

  await User.insertMany(
    seedUsers.map((user) => ({
      ...user,
      email: User.normalizeEmail(user.email),
      phone: User.normalizePhone(user.phone),
      passwordHash,
      isActive: true,
    })),
  );

  console.log("Seeded test users successfully.");
  console.log(`Temporary password for all seeded accounts: ${TEMP_PASSWORD}`);
  console.log("Accounts:");
  console.log("- Admin: admin@gmail.com / 111222333");
  console.log("- Khách cho thuê: benchothue@gmail.com / 444555666");
  console.log("- Khách thuê: benthue@gmail.com / 777888999");
}

seedTestUsers()
  .catch((error) => {
    console.error("Failed to seed test users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
