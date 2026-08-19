import { novu } from "../../config/novu.js";

export const sendTestNotification = async (req, res) => {
  try {
    const result = await novu.trigger("test-notification", {
      to: {
        subscriberId: "test-user-001",
      },
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Novu error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể gửi notification",
    });
  }
};
