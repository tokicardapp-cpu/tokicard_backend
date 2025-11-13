import express from "express";
import natural from "natural";
import { sendMessage } from "../utils/sendMessage.js";
import { db } from "../firebase.js";

const router = express.Router();

/* --------------------------- CARD GENERATOR --------------------------- */
function generateCard() {
  const randomNumber = () =>
    Array(4)
      .fill(0)
      .map(() => Math.floor(1000 + Math.random() * 9000))
      .join(" ");

  const expiryMonth = ("0" + Math.floor(1 + Math.random() * 12)).slice(-2);
  const expiryYear = 25 + Math.floor(Math.random() * 5); // 2025 - 2029

  const cvv = Math.floor(100 + Math.random() * 900);

  const addresses = [
    "55 Madison Ave, New York, NY",
    "1208 Sunset Blvd, Los Angeles, CA",
    "322 Park Ave, Miami, FL",
    "44 Wall Street, New York, NY",
    "270 Pine St, San Francisco, CA"
  ];

  return {
    number: randomNumber(),
    expiry: `${expiryMonth}/${expiryYear}`,
    cvv: cvv.toString(),
    billingAddress: addresses[Math.floor(Math.random() * addresses.length)]
  };
}

/* ---------------------- META WEBHOOK VERIFICATION --------------------- */
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ WhatsApp Webhook verified successfully!");
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
    console.log("📦 Incoming webhook:", JSON.stringify(req.body, null, 2));

    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;

    const text =
      message.text?.body?.trim().toLowerCase() ||
      message.interactive?.button_reply?.title?.toLowerCase() ||
      "";

    console.log("📩 Message received from", from, ":", text);

    /* ----------------------------- INTENTS ----------------------------- */
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());

    const intents = {
      register: [
        "register", "signup", "sign up", "create",
        "get started", "start", "open registration"
      ],
      kyc: ["kyc", "verify", "verification", "identity", "id"],
      activate: ["activate", "activate card"],
      fund: ["fund", "top up", "deposit", "add money"],
      balance: ["balance", "check balance", "wallet"],
      help: ["help", "support", "assist"],
      about: ["what is toki", "toki card", "about"],
      how: ["how", "how it works", "explain"],
      security: ["safe", "secure", "trust", "security"],
      fees: ["cost", "fee", "price", "charges"],
      features: ["features", "benefits"],
      referral: ["refer", "invite", "referral"],
      crypto: ["crypto", "usdt", "bitcoin"],
      fiat: ["bank", "transfer", "fiat"],

      // ⭐ NEW: card details intent
      card: [
        "show card",
        "card details",
        "show card details",
        "my card",
        "virtual card",
        "card info",
        "show my card"
      ],

      // casual
      acknowledge: ["ok", "okay", "alright", "cool", "sure", "thanks"],
      followup: ["what next", "continue", "proceed"]
    };

    // Smart matching
    let userIntent = null;

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some((kw) => text.includes(kw))) {
        userIntent = intent;
        break;
      }
    }

    if (!userIntent) {
      let bestMatch = { intent: null, score: 0 };
      for (const [intent, keywords] of Object.entries(intents)) {
        for (const keyword of keywords) {
          const score = natural.JaroWinklerDistance(text, keyword);
          if (score > bestMatch.score) bestMatch = { intent, score };
        }
      }
      if (bestMatch.score > 0.85) userIntent = bestMatch.intent;
    }

    console.log("🎯 Detected intent:", userIntent);

    /* ------------------------------ GREETING ------------------------------ */
    if (["hi", "hello", "hey"].some((g) => text.includes(g))) {
      await sendMessage(
        from,
        "👋 Welcome to *Toki Card*! What would you like to do?",
        [{ label: "Fund" }, { label: "About" }, { label: "Help" }]
      );
      return res.sendStatus(200);
    }

    /* ------------------------- CARD DETAILS SECTION ------------------------ */
    if (userIntent === "card") {
      const userRef = db.collection("users").doc(from);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await sendMessage(
          from,
          "⚠️ Please *register first* before accessing your virtual card.\n\nType *register* to continue.",
          [{ label: "Register" }]
        );
        return res.sendStatus(200);
      }

      // Does user already have a stored card?
      let card = userDoc.data().card;

      if (!card) {
        card = generateCard();
        await userRef.update({ card });
      }

      await sendMessage(
        from,
        `💳 *Your Toki USD Virtual Card*\n\n` +
          `▪️ *Card Number:* ${card.number}\n` +
          `▪️ *Expiry:* ${card.expiry}\n` +
          `▪️ *CVV:* ${card.cvv}\n` +
          `▪️ *Billing Address:* ${card.billingAddress}\n\n` +
          `👉 *Tap & hold* any detail to copy it.`,
        [
          { label: "Fund" },
          { label: "Balance" },
          { label: "Help" }
        ]
      );

      return res.sendStatus(200);
    }

    /* ------------------------------ ALL EXISTING INTENTS ------------------------------ */

    if (userIntent === "register") {
      const registerLink = `https://tokicard-onboardingform.onrender.com?phone=${from}`;
      await sendMessage(
        from,
        `📝 *Let’s get you started!*\n\nOpen your registration:\n👉 ${registerLink}`,
        [{ label: "Open Registration" }, { label: "KYC" }]
      );
      return res.sendStatus(200);
    }

    if (userIntent === "kyc") {
      const kycLink = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(
        from,
        `🪪 Complete your KYC below:\n${kycLink}`,
        [{ label: "Help" }, { label: "Fund" }]
      );
      return res.sendStatus(200);
    }

    if (userIntent === "fund") {
      const userRef = db.collection("users").doc(from);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await sendMessage(
          from,
          "⚠️ You need to *register first*. Type *register* to begin.",
          [{ label: "Register" }]
        );
        return res.sendStatus(200);
      }

      const userData = userDoc.data();

      if (!userData.cardActive) {
        await sendMessage(
          from,
          "⚠️ Please complete *KYC* before funding.\n\nType *KYC* to continue.",
          [{ label: "KYC" }]
        );
        return res.sendStatus(200);
      }

      await sendMessage(
        from,
        "💰 Choose your funding method:\n\n• *Crypto* (USDT / BTC)\n• *Fiat* (bank transfer)",
        [{ label: "Crypto" }, { label: "Fiat" }]
      );
      return res.sendStatus(200);
    }

    if (userIntent === "crypto") {
      await sendMessage(from, "💎 We support *USDT (TRC20)* and *BTC*.");
      return res.sendStatus(200);
    }

    if (userIntent === "fiat") {
      await sendMessage(from, "🏦 Bank transfer funding is available.");
      return res.sendStatus(200);
    }

    /* -------------------------- EMAIL REGISTRATION ------------------------- */
    if (text.includes("@")) {
      const email = text.trim().toLowerCase();
      const waitlistSnapshot = await db.collection("waitlist").orderBy("timestamp", "asc").get();

      const waitlistEntries = waitlistSnapshot.docs.map((doc) => doc.data());
      const userIndex = waitlistEntries.findIndex((entry) => entry.email.toLowerCase() === email);

      const isWaitlisted = userIndex !== -1;
      const userRef = db.collection("users").doc(from);

      await userRef.set({
        phone: from,
        email,
        kycStatus: "pending",
        cardActive: false,
        annualFeePaid: false,
        isWaitlisted,
        createdAt: new Date()
      });

      if (isWaitlisted) {
        await sendMessage(
          from,
          `🎉 Welcome back! You're already on our waitlist.`,
          [{ label: "KYC" }]
        );
      } else {
        await sendMessage(
          from,
          "✅ Account created successfully!",
          [{ label: "KYC" }]
        );
      }

      return res.sendStatus(200);
    }

    /* ------------------------------ DEFAULT ------------------------------ */
    await sendMessage(
      from,
      "🤖 I didn’t understand that.\nType *help* to see available commands.",
      [{ label: "Help" }]
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ WhatsApp route error:", error);
    res.sendStatus(500);
  }
});

export default router;
