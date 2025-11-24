// utils/sendMessage.js → FINAL PRODUCTION VERSION
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

// Simulate typing indicator
async function sendTypingIndicator(to, duration = 1500) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "typing_on",
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    await new Promise((resolve) => setTimeout(resolve, duration));
  } catch (error) {
    console.error("Typing indicator failed:", error.response?.data || error.message);
  }
}

/**
 * Send WhatsApp message with optional buttons & typing indicator
 */
export async function sendMessage(
  to,
  text,
  buttons = [],
  withTyping = true,        // ← I changed default to true — feels more human
  typingDuration = 1200
) {
  try {
    if (withTyping) {
      await sendTypingIndicator(to, typingDuration);
    }

    let payload;

    if (buttons.length > 0) {
      // Interactive buttons
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.slice(0, 3).map((btn, i) => ({
              type: "reply",
              reply: {
                id: `btn_${i + 1}`,
                title: btn.label.substring(0, 20), // WhatsApp max 20 chars
              },
            })),
          },
        },
      };
    } else {
      // Plain text
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      };
    }

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

    console.log(`Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(
      "Failed to send WhatsApp message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Optional: Add sendList if you want dropdown menus later
// export async function sendList(...) { ... }