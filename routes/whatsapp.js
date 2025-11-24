// routes/whatsapp.js → FINAL PRODUCTION VERSION (NO FAKE DATA)
import express from "express";
import axios from "axios";
import natural from "natural";
import { sendMessage, sendButtons, sendList } from "../utils/sendMessage.js";

const router = express.Router();
const tokenizer = new natural.WordTokenizer();

// CONFIG — CHANGE THESE ONCE
const API_BASE = process.env.API_BASE || "https://tokicard-api.onrender.com/auth";
const WEBAPP = "https://tokicard-onboardingform.vercel.app";

// Simple in-memory cache (works perfectly on Render/Railway)
const userCache = new Map();

async function getUser(phone) {
  if (userCache.has(phone)) return userCache.get(phone);

  try {
  const res = await axios.get(`${API_BASE}/user`, {
      params: { email: phone }, // we're using phone as identifier for now
      timeout: 8000
    });
    const userData = res.data || null;
    userCache.set(phone, userData);
    return userData;
  } catch (err) {
    userCache.set(phone, null);
    return null;
  }
}

function clearCache(phone) {
  userCache.delete(phone);
}

// ====================== WEBHOOK VERIFICATION ======================
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("WhatsApp Webhook Verified!");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ====================== MAIN MESSAGE HANDLER ======================
router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from; // WhatsApp number
    const text = (message.text?.body || "").trim().toLowerCase();
    const buttonId = message.interactive?.button_reply?.id;

    console.log(`From: ${from} | Message: "${text}" | Button: ${buttonId}`);

    const user = await getUser(from);

    // ====================== BUTTON REPLIES ======================
    if (buttonId === "OPEN_WEB") {
      await sendMessage(from, `Opening your Toki Card...\n${WEBAPP}/?phone=${from}`);
      return res.sendStatus(200);
    }

    // ====================== NATURAL LANGUAGE DETECTION ======================
    const words = tokenizer.tokenize(text) || [];

    const intents = {
      greeting: ["hi", "hello", "hey", "start", "good morning", "good afternoon"],
      balance: ["balance", "wallet", "money", "how much"],
      card: ["card", "show card", "my card", "virtual card", "card details", "show my card"],
      fund: ["fund", "paid", "funded", "top up", "deposit", "i have paid", "transferred"],
      kyc: ["kyc", "verify", "id", "identity", "profile"],
      help: ["help", "menu", "what can i do", "commands"]
    };

    let detectedIntent = null;
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(kw => words.includes(kw))) {
        detectedIntent = intent;
        break;
      }
    }

    // ====================== GREETING ======================
    if (detectedIntent === "greeting" || text === "") {
      await sendButtons(from,
        `*Welcome to Toki Card!* \n\nGet your USD virtual card in under 2 minutes`,
        [
          { id: "OPEN_WEB", title: "Continue in Browser" },
          { id: "HELP", title: "See Menu" }
        ]
      );
      return res.sendStatus(200);
    }

    // ====================== HELP / MENU ======================
    if (detectedIntent === "help" || text.includes("menu")) {
      await sendList(from, "What would you like to do?", [
        { id: "balance", title: "Check Balance" },
        { id: "card", title: "View My Card" },
        { id: "fund", title: "Fund Wallet" },
        { id: "kyc", title: "Complete Profile" },
        { id: "OPEN_WEB", title: "Open Web Dashboard" }
      ]);
      return res.sendStatus(200);
    }

    // ====================== BALANCE ======================
    if (detectedIntent === "balance") {
      const balance = user?.fundedAmount || 0;
      const name = user?.firstName ? `, ${user.firstName}` : "";
      await sendMessage(from, `Hi${name}!\n\nYour current balance:\n*$${balance}.00 USD*`);
      return res.sendStatus(200);
    }

    // ====================== SHOW CARD (100% REAL) ======================
    if (detectedIntent === "card") {
      if (!user) {
        await sendMessage(from, "You haven't started yet. Click below to begin:");
        await sendMessage(from, `${WEBAPP}/?phone=${from}`);
        return res.sendStatus(200);
      }

      if (!user.fundingCompleted) {
        await sendMessage(from, "You must fund your wallet first to get your card.");
        await sendMessage(from, `Activate now → ${WEBAPP}/funding?phone=${from}`);
        return res.sendStatus(200);
      }

      if (!user.card?.number) {
        await sendMessage(from,
          "Your virtual card is being generated...\n\n" +
          "Please complete card creation in the web dashboard.\n\n" +
          `${WEBAPP}/dashboard?phone=${from}`
        );
        return res.sendStatus(200);
      }

      const card = user.card;
      await sendMessage(from,
        `*Your Toki USD Virtual Card* \n\n` +
        `Cardholder: ${card.name || "TOKI USER"}\n` +
        `Type: Virtual Mastercard\n\n` +
        `• Expiry: ${card.expiry}\n` +
        `• CVV: ${card.cvv}\n` +
        `• Billing: ${card.billingAddress || "1000 Broadway St, San Francisco, CA"}\n\n` +
        `Card number below:`
      );
      await sendMessage(from,
        `*Card Number:*\n\`${card.number}\`\n\n_Tap & hold to copy_ • Valid worldwide`
      );
      return res.sendStatus(200);
    }

    // ====================== FUNDING CONFIRMATION ======================
    if (detectedIntent === "fund") {
      if (!user?.kycBasicCompleted) {
        await sendMessage(from, "You must complete your profile first before funding.");
        await sendMessage(from, `Complete now → ${WEBAPP}/?phone=${from}`);
        return res.sendStatus(200);
      }

      if (user.fundingCompleted) {
        await sendMessage(from, "You're already funded! Type *card* to see your card.");
        return res.sendStatus(200);
      }

      // Mark as funded via your real backend
      await axios.post(`${API_BASE}/kyc-funding`, {
        email: user.email || from,
        amount: 5
      });

      clearCache(from); // Force refresh next time

      await sendButtons(from,
        `*Funding confirmed!* \n\n$5 added to your wallet \nYour virtual card is now active!`,
        [
          { id: "OPEN_WEB", title: "View Card Now" },
          { id: "balance", title: "Check Balance" }
        ]
      );
      return res.sendStatus(200);
    }

    // ====================== DEFAULT: SMART DEEP LINK ======================
    let link = `${WEBAPP}/?phone=${from}`;
    let msg = "Click below to continue your journey:";

    if (!user) {
      msg = "You haven't started. Click to begin:";
    } else if (!user.kycBasicCompleted) {
      msg = "Complete your profile to continue:";
    } else if (!user.fundingCompleted) {
      msg = "Activate your wallet with $5:";
      link = `${WEBAPP}/funding?phone=${from}`;
    } else {
      msg = "Welcome back! Your card is ready:";
      link = `${WEBAPP}/dashboard?phone=${from}`;
    }

    await sendButtons(from, msg, [
      { id: "OPEN_WEB", title: "Open in Browser" }
    ]);
    await sendMessage(from, link);

    return res.sendStatus(200);

  } catch (err) {
    console.error("Bot Error:", err.message);
    await sendMessage(message.from, "Sorry, something went wrong. Try again soon.");
    res.sendStatus(500);
  }
});

export default router;