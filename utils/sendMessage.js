import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

/**
 * Simulate WhatsApp "typing" indicator by waiting before sending the message.
 *
 * @param {string} to - Recipient’s WhatsApp number
 * @param {number} duration - Duration to simulate typing (in ms)
 */
async function sendTypingIndicator(to, duration = 1500) {
  try {
    // 🕐 Send "typing" state to WhatsApp
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "typing_on", // triggers the "typing" state in chat
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // ⏳ Wait to simulate typing duration
    await new Promise((resolve) => setTimeout(resolve, duration));
  } catch (error) {
    console.error(
      "⚠️ Typing indicator error:",
      error.response?.data || error.message
    );
  }
}

/**
 * Sends a WhatsApp message.
 * Supports both plain text and interactive (button) formats.
 * Automatically supports optional typing indicator simulation.
 *
 * @param {string} to - Recipient’s WhatsApp number (e.g. "2347012345678")
 * @param {string} text - Message content
 * @param {Array<{label: string}>} [buttons=[]] - Optional quick reply buttons
 * @param {boolean} [withTyping=false] - If true, shows typing indicator before sending
 * @param {number} [typingDuration=1500] - Optional custom typing delay in milliseconds
 */
export async function sendMessage(to, text, buttons = [], withTyping = false, typingDuration = 1500) {
  try {
    // 🟡 Step 1: Simulate typing if requested
    if (withTyping) {
      await sendTypingIndicator(to, typingDuration);
    }

    // 🟢 Step 2: Build payload
    let payload;

    if (buttons.length > 0) {
      // Interactive button message
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
    } else {
      // Simple text message
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      };
    }

    // 🟢 Step 3: Send the message
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
