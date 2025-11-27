// utils/sendMessage.js - WITH FLOW SUPPORT AND BETTER ERROR LOGGING
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
 * Send WhatsApp Flow (opens inside WhatsApp!)
 */
export async function sendRegistrationFlow(to) {
  try {
    await sendTypingIndicator(to, 1200);

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "flow",
          header: {
            type: "text",
            text: "Toki Card Registration"
          },
          body: {
            text: "Complete your registration to activate your card. This opens inside WhatsApp!"
          },
          footer: {
            text: "Secure • Fast • Easy"
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: `flow_${to}_${Date.now()}`,
              flow_id: "1465176101209831",
              flow_cta: "Start Registration",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "WELCOME_SCREEN",
                data: {
                  phone: to
                }
              }
            }
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Flow sent successfully to", to);
    return response.data;
  } catch (error) {
    // Detailed error logging
    console.error("❌ Error sending Flow:");
    console.error("Status:", error.response?.status);
    console.error("Error data:", JSON.stringify(error.response?.data, null, 2));
    console.error("Message:", error.message);
    throw error;
  }
}

/**
 * Modified CTA URL with proper headers
 */
export async function sendCTAWithInAppHint(to, text, url, buttonText) {
  try {
    await sendTypingIndicator(to, 1200);

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        header: {
          type: "text",
          text: "Toki Card Activation"
        },
        body: {
          text: text
        },
        footer: {
          text: "Secure & Fast"
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: buttonText,
            url: url
          }
        }
      }
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

    console.log(`✅ CTA URL sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send CTA URL:", error.response?.data || error.message);
    throw error;
  }
}

// Main sendMessage function
export async function sendMessage(
  to,
  text,
  buttons = [],
  withTyping = true,
  typingDuration = 1200,
  urlButton = null
) {
  try {
    if (withTyping) {
      await sendTypingIndicator(to, typingDuration);
    }

    let payload;

    if (urlButton && urlButton.url) {
      return await sendCTAWithInAppHint(to, text, urlButton.url, urlButton.text);
    } else if (buttons.length > 0) {
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
                title: btn.label.substring(0, 20),
              },
            })),
          },
        },
      };
    } else {
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

    console.log(`✅ Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send message:", error.response?.data || error.message);
    throw error;
  }
}