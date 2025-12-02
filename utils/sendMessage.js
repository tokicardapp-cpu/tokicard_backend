// utils/sendMessage.js - SIMPLIFIED VERSION
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

async function sendTypingIndicator(to, duration = 1500) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "typing_on" },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
    );
    await new Promise((resolve) => setTimeout(resolve, duration));
  } catch (error) {
    console.error("Typing indicator failed:", error.response?.data || error.message);
  }
}

/**
 * MAIN FUNCTION: Send message with URL button that opens your website
 * Usage: sendMessage(phoneNumber, "Welcome message", "https://your-website.com", "Button Text")
 */
export async function sendMessage(to, text, websiteUrl = null, buttonText = "Open Link") {
  try {
    // Show typing indicator
    await sendTypingIndicator(to, 1200);

    let payload;

    // If websiteUrl is provided, send CTA URL button
    if (websiteUrl) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text: text
          },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonText, // Dynamic button text
              url: websiteUrl // Your website URL
            }
          }
        }
      };
    } else {
      // Regular text message (no button)
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text }
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

    console.log(`✅ Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send message:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * OPTIONAL: Send message with reply buttons (for bot interactions)
 */
export async function sendMessageWithButtons(to, text, buttons = []) {
  try {
    await sendTypingIndicator(to, 1200);

    const payload = {
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
              id: btn.id || `btn_${i + 1}`,
              title: btn.label.substring(0, 20),
            },
          })),
        },
      },
    };

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

    console.log(`✅ Message with buttons sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send message:", error.response?.data || error.message);
    throw error;
  }
}

// USAGE EXAMPLES:
/*
// 1. Send message with "Activate Card" button
await sendMessage(
  "+2348012345678",
  "Welcome to Toki Card! Complete your registration to activate your card.",
  "https://tokicard.com/activate?phone=+2348012345678"
);

// 2. Send regular text message (no button)
await sendMessage(
  "+2348012345678",
  "Thank you for registering!"
);

// 3. Send message with reply buttons (for bot flow)
await sendMessageWithButtons(
  "+2348012345678",
  "How can we help you today?",
  [
    { id: "help", label: "Get Help" },
    { id: "status", label: "Check Status" },
    { id: "support", label: "Contact Support" }
  ]
);
*/