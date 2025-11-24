// routes/whatsapp.js → YOUR EXACT BOT, ONLY CLEANED AS REQUESTED
import express from "express";
import axios from "axios";
import { sendMessage } from "../utils/sendMessage.js";

const router = express.Router();

// YOUR REAL LINKS
const API_BASE = "https://tokicard-api.onrender.com/auth";
const WEBAPP = "https://tokicard-onboardingform.onrender.com";

/* ---------------------- META WEBHOOK VERIFICATION --------------------- */
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WhatsApp Webhook verified successfully!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

/* ----------------------------- MAIN ROUTER ----------------------------- */
router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);
    const from = message.from;
    const text = (message.text?.body?.trim().toLowerCase() || "") ||
                  (message.interactive?.button_reply?.title?.toLowerCase() || "");
    console.log("Message from", from, ":", text);

    /* ----------------------------- INTENTS (EXACTLY YOURS) ----------------------------- */
    const intents = {
      register: ["register", "signup", "sign up", "create", "start", "open registration"],
      kyc: ["kyc", "verify", "identity", "id"],
      activate: ["activate", "activate card"],
      fund: ["fund", "top up", "deposit"],
      balance: ["balance", "wallet"],
      help: ["help", "support"],
      about: ["what is toki", "toki card", "about"],
      how: ["how", "how it works"],
      security: ["safe", "secure", "trust"],
      fees: ["cost", "fee", "charges"],
      features: ["features", "benefits"],
      referral: ["refer", "invite"],
      crypto: ["crypto", "usdt", "bitcoin"],
      fiat: ["bank", "fiat"],
      card: ["show card", "card details", "show card details", "my card", "virtual card", "card info", "show my card"],
      acknowledge: ["ok", "okay", "cool"],
      followup: ["what next", "continue"]
    };

    let userIntent = null;
    for (const [intent, list] of Object.entries(intents)) {
      if (list.some(kw => text.includes(kw))) {
        userIntent = intent;
        break;
      }
    }
    console.log("Detected intent:", userIntent);

    // GET USER FROM REAL BACKEND
    let user;
    try {
      const res = await axios.get(`${API_BASE}/user`, { params: { email: from }, timeout: 8000 });
      user = res.data;
    } catch (e) {
      user = null;
    }

    /* ------------------------------ GREETING ------------------------------ */
    if (["hi", "hello", "hey"].some(g => text.includes(g))) {
      await sendMessage(from, "Welcome to *Toki Card*! What would you like to do?", [
        { label: "Fund" }, { label: "About" }, { label: "Help" }
      ]);
      return res.sendStatus(200);
    }

    /* --------------------- CARD DETAILS — 2 MESSAGES (YOUR STYLE) --------------------- */
    if (userIntent === "card") {
      if (!user) {
        await sendMessage(from, "Please *register first* before viewing your card.", [{ label: "Register" }]);
        return res.sendStatus(200);
      }

      // REMOVED: generateCard() function and fake card generation
      // Now only shows card if it already exists in your backend (100% real)
      if (!user.card?.number) {
        await sendMessage(from, "Your card is not ready yet. Please complete funding or try again later.");
        return res.sendStatus(200);
      }

      const card = user.card;

      await sendMessage(from,
        `*Your Toki USD Virtual Card*\n\n` +
        `• *Expiry:* ${card.expiry}\n` +
        `• *CVV:* ${card.cvv}\n\n` +
        `Your card number is below`,
        [{ label: "Fund" }, { label: "Help" }]
      );
      await sendMessage(from,
        `*Card Number:*\n\`${card.number}\`\n\n_Tap & hold to copy_`,
        []
      );
      return res.sendStatus(200);
    }

    /* --------------------------- OTHER INTENTS (UNCHANGED) --------------------------- */
    if (userIntent === "register") {
      const link = `${WEBAPP}/?phone=${from}`;
      await sendMessage(from, `Start your registration:\n${link}`, [
        { label: "Open Registration" }, { label: "KYC" }
      ]);
      return res.sendStatus(200);
    }
    if (userIntent === "kyc") {
      const kyc = `${WEBAPP}/?phone=${from}`;
      await sendMessage(from, `Complete your KYC:\n${kyc}`, [{ label: "Fund" }]);
      return res.sendStatus(200);
    }
    if (userIntent === "fund") {
      if (!user?.kycBasicCompleted) {
        await sendMessage(from, "You must complete *KYC* first.", [{ label: "KYC" }]);
        return res.sendStatus(200);
      }
      await sendMessage(from, "Choose your funding method:", [
        { label: "Crypto" }, { label: "Fiat" }
      ]);
      return res.sendStatus(200);
    }
    if (userIntent === "crypto") {
      await sendMessage(from, "We support *USDT (TRC20)* and *BTC*.");
      return res.sendStatus(200);
    }
    if (userIntent === "fiat") {
      await sendMessage(from, "Bank transfer coming soon.");
      return res.sendStatus(200);
    }

    /* ------------------------------ DEFAULT ------------------------------ */
    await sendMessage(from, "I didn’t understand that. Type *help* to see commands.", [{ label: "Help" }]);
    return res.sendStatus(200);

  } catch (err) {
    console.error("WhatsApp route error:", err);
    res.sendStatus(500);
  }
});

export default router;