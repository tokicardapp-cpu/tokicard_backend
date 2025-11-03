import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

/**
 * Sends a WhatsApp message.
 * Automatically detects if it’s plain text or interactive (button) format.
 *
 * @param {string} to - Recipient’s WhatsApp number (e.g. "2347012345678")
 * @param {string} text - Message body content
 * @param {Array<{label: string}>} [buttons=[]] - Optional quick reply buttons
 */
export async function sendMessage(to, text, buttons = []) {
  try {
    let payload;

    // ✅ Case 1: Interactive button message
    if (buttons.length > 0) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map((btn, index) => ({
              type: "reply",
              reply: {
                id: `btn_${index + 1}`,
                title: btn.label,
              },
            })),
          },
        },
      };
    }

    // ✅ Case 2: Simple text message
    else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      };
    }

    // ✅ Send the message through the WhatsApp Cloud API
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Failed to send WhatsApp message:",
      error.response?.data || error.message
    );
  }
}
