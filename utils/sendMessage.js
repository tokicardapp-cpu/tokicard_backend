
// import axios from "axios";
// import dotenv from "dotenv";

// dotenv.config();

// const TOKEN = process.env.WHATSAPP_TOKEN;
// const PHONE_ID = process.env.PHONE_ID;

// export async function sendMessage(to, text) {
//   try {
//     await axios.post(
//       `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
//       {
//         messaging_product: "whatsapp",
//         to,
//         text: { body: text },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${TOKEN}`,
//         },
//       }
//     );
//     console.log(`✅ Message sent to ${to}`);
//   } catch (error) {
//     console.error("❌ Failed to send WhatsApp message:", error.response?.data || error);
//   }
// }
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

/**
 * Send a WhatsApp message.
 * Supports both text and interactive (button) messages.
 *
 * @param {string} to - WhatsApp user number (e.g., "2347012345678")
 * @param {string} text - Message body text
 * @param {Array} [buttons] - Optional array of button objects: [{ label: "Register" }, { label: "KYC" }]
 */
export async function sendMessage(to, text, buttons = []) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
    };

    // 🟢 If we have buttons → send interactive message
    if (buttons.length > 0) {
      payload.type = "interactive";
      payload.interactive = {
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
      };
    } else {
      // 🟢 Otherwise → send simple text message
      payload.type = "text";
      payload.text = { body: text };
    }

    await axios.post(
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
  } catch (error) {
    console.error(
      "❌ Failed to send WhatsApp message:",
      error.response?.data || error
    );
  }
}
