import env from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import app from "./app.js";

const PORT = env.PORT;

async function startServer() {
  try {
    await connectDatabase();
    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
