// routes/whatsapp.js → FULLY FIXED & WORKING VERSION (2025)
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
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

/* ----------------------------- MAIN ROUTER ----------------------------- */
router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;

    // FIXED: Properly extract text from typed message OR button click (id is what Meta sends now)
    let rawText =
      message.text?.body?.trim() ||
      message.interactive?.button_reply?.id ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.id ||
      "";

    const text = rawText.toLowerCase().trim();
    console.log("Message from", from, ":", text || "(empty/button click)");

    // GET USER FROM REAL BACKEND
    let user = null;
    try {
      const res = await axios.get(`${API_BASE}/user`, { params: { phone: from }, timeout: 8000 });
      user = res.data;
    } catch (e) {
      user = null;
    }

    /* ----------------------------- INTENT KEYWORDS (IMPROVED) ----------------------------- */
    const intents = {
      register: ["register", "signup", "sign up", "create", "start", "join", "open account", "new account"],
      kyc: ["kyc", "verify", "verification", "identity", "id", "document"],
      activate: ["activate", "activate card"],
      fund: ["fund", "deposit", "top up", "add money", "load", "pay"],
      balance: ["balance", "wallet", "how much", "my money", "check balance"],
      help: ["help", "support", "assistant"],
      about: ["about", "what is toki", "toki card", "what's this"],
      how: ["how", "how it works", "how to use"],
      security: ["safe", "secure", "trust", "scam"],
      fees: ["fee", "charge", "cost", "price"],
      features: ["feature", "benefit"],
      referral: ["refer", "invite", "referral", "bonus"],
      crypto: ["crypto", "usdt", "bitcoin", "btc"],
      fiat: ["fiat", "bank", "transfer"],
      card: ["card", "show card", "my card", "virtual card", "card details", "card number", "show my card", "card info"],
      acknowledge: ["ok", "okay", "cool", "got it", "thanks"],
      followup: ["next", "continue", "what next"]
    };

    let userIntent = null;
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(kw => kw.split(" ").every(word => text.includes(word)))) {
        userIntent = intent;
        break;
      }
    }

    console.log("Detected intent:", userIntent || "(none)");

    /* ------------------------------ GREETING ------------------------------ */
    if (["hi", "hello", "hey", "hola", "good morning", "morning", "evening"].some(g => text.includes(g))) {
      await sendMessage(from, "Welcome to *Toki Card* – Your USD Virtual Card! \n\nWhat would you like to do?", [
        { id: "fund", label: "Fund Card" },
        { id: "card", label: "Show My Card" },
        { id: "balance", label: "Check Balance" },
        { id: "help", label: "Help & Support" }
      ]);
      return res.sendStatus(200);
    }

    /* --------------------- SHOW CARD (2 MESSAGES) --------------------- */
    if (userIntent === "card") {
      if (!user) {
        await sendMessage(from, "You need to *register first* to get your card.", [
          { id: "register", label: "Register Now" }
        ]);
        return res.sendStatus(200);
      }

      if (!user.card?.number) {
        await sendMessage(from, "Your virtual card is not ready yet.\n\nComplete funding to activate it.", [
          { id: "fund", label: "Fund Now" }
        ]);
        return res.sendStatus(200);
      }

      const card = user.card;
      await sendMessage(from,
        `*Your Toki USD Virtual Card*\n\n` +
        `• Holder: ${card.name || "Toki User"}\n` +
        `• Expiry: ${card.expiry}\n` +
        `• CVV: ${card.cvv}\n\n` +
        `Card number below`,
        [
          { id: "fund", label: "Fund Card" },
          { id: "help", label: "Help" }
        ]
      );

      await sendMessage(from,
        `*Card Number:*\n\`${card.number}\`\n\n_Tap & hold to copy_`,
        []
      );
      return res.sendStatus(200);
    }

    /* --------------------------- INTENT HANDLERS --------------------------- */
    if (userIntent === "register") {
      const link = `${WEBAPP}/?phone=${from}`;
      await sendMessage(from, `Register now and get your USD virtual card in minutes!\n\n${link}`, [
        { id: "open_web", label: "Open Registration" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "kyc") {
      const link = `${WEBAPP}/?phone=${from}#kyc`;
      await sendMessage(from, `Complete your identity verification (KYC):\n\n${link}`, [
        { id: "fund", label: "Continue to Fund" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "fund") {
      if (!user?.kycBasicCompleted) {
        await sendMessage(from, "You must complete *KYC verification* before funding.", [
          { id: "kyc", label: "Complete KYC" }
        ]);
        return res.sendStatus(200);
      }

      await sendMessage(from, "Choose how you want to fund your Toki Card:", [
        { id: "crypto", label: "Crypto (USDT/BTC)" },
        { id: "fiat", label: "Bank Transfer (Soon)" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "crypto") {
      await sendMessage(from, "We currently support:\n\n• *USDT (TRC20)*\n• *Bitcoin (BTC)*\n\nUse the address shown after funding starts.", [
        { id: "fund", label: "Fund with Crypto" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "fiat") {
      await sendMessage(from, "Bank transfer (Fiat) funding is coming very soon!\n\nStay tuned.", [
        { id: "fund", label: "Fund with Crypto" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "about") {
      await sendMessage(from, "*Toki Card* is a USD virtual card for global spending.\n\n• Pay online anywhere\n• No bank account needed\n• Fund with crypto\n• Instant issuance", [
        { id: "register", label: "Get Started" },
        { id: "help", label: "Help" }
      ]);
      return res.sendStatus(200);
    }

    if (userIntent === "help" || userIntent === "support") {
      await sendMessage(from, "*Toki Card Support*\n\nCommon options:", [
        { id: "card", label: "Show My Card" },
        { id: "fund", label: "How to Fund" },
        { id: "kyc", label: "KYC Issues" },
        { id: "help", label: "Live Chat (Soon)" }
      ]);
      return res.sendStatus(200);
    }

    /* ------------------------------ DEFAULT ------------------------------ */
    await sendMessage(from, "I didn’t understand that.\n\nType *menu* or tap a button below:", [
      { id: "fund", label: "Fund Card" },
      { id: "card", label: "Show Card" },
      { id: "balance", label: "Balance" },
      { id: "help", label: "Help" }
    ]);

    return res.sendStatus(200);
  } catch (err) {
    console.error("WhatsApp route error:", err.message || err);
    res.sendStatus(500);
  }
});

export default router;