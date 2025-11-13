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
      .join(""); // 🔥 NO SPACES ANYMORE

  const expiryMonth = ("0" + Math.floor(1 + Math.random() * 12)).slice(-2);
  const expiryYear = 26 + Math.floor(Math.random() * 6); // 2026 - 2031

  const cvv = Math.floor(100 + Math.random() * 900);

  const addresses = [
    "55 Madison Ave, New York, NY",
    "1208 Sunset Blvd, Los Angeles, CA",
    "322 Park Ave, Miami, FL",
    "44 Wall Street, New York, NY",
    "270 Pine St, San Francisco, CA"
  ];

  return {
    number: randomNumber(), // now 16 digits together
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

      // ⭐ New: Card details
      card: [
        "show card",
        "card details",
        "show card details",
        "my card",
        "virtual card",
        "card info",
        "show my card"
      ],

      acknowledge: ["ok", "okay", "cool"],
      followup: ["what next", "continue"]
    };

    let userIntent = null;
    for (const [intent, list] of Object.entries(intents)) {
      if (list.some((kw) => text.includes(kw))) {
        userIntent = intent;
        break;
      }
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

    /* ----------------------------------------------------------------------
       ⭐⭐⭐ CARD DETAILS — 2 MESSAGES (NO SPACES IN CARD NUMBER)
    ---------------------------------------------------------------------- */
  /* ----------------------------------------------------------------------
   ⭐⭐⭐ CARD DETAILS — 2 MESSAGES — NO SPACES IN CARD NUMBER
---------------------------------------------------------------------- */
if (userIntent === "card") {
  const ref = db.collection("users").doc(from);
  const doc = await ref.get();

  if (!doc.exists) {
    await sendMessage(
      from,
      "⚠️ Please *register first* before viewing your card.",
      [{ label: "Register" }]
    );
    return res.sendStatus(200);
  }

  let card = doc.data().card;

  if (!card) {
    card = generateCard();
    await ref.update({ card });
  }

  // FIRST MESSAGE
  await sendMessage(
    from,
    `💳 *Your Toki USD Virtual Card*\n\n` +
      `▪️ *Expiry:* ${card.expiry}\n` +
      `▪️ *CVV:* ${card.cvv}\n` +
      `▪️ *Billing Address:* ${card.billingAddress}\n\n` +
      `👉 Your *card number* will follow next.`,
    [{ label: "Fund" }, { label: "Help" }]
  );

  // SECOND MESSAGE — Code block prevents auto spacing
  await sendMessage(
    from,
    `🔢 *Card Number*\n\`\`\`\n${card.number}\n\`\`\`\n👉 Tap & hold to copy.`,
    []
  );

  return res.sendStatus(200);
}


    /* --------------------------- EXISTING INTENTS --------------------------- */

    if (userIntent === "register") {
      const link = `https://tokicard-onboardingform.onrender.com?phone=${from}`;
      await sendMessage(
        from,
        `📝 Start your registration:\n👉 ${link}`,
        [{ label: "Open Registration" }, { label: "KYC" }]
      );
      return res.sendStatus(200);
    }

    if (userIntent === "kyc") {
      const kyc = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(from, `🪪 Complete your KYC:\n${kyc}`, [{ label: "Fund" }]);
      return res.sendStatus(200);
    }

    if (userIntent === "fund") {
      const ref = db.collection("users").doc(from);
      const doc = await ref.get();

      if (!doc.exists) {
        await sendMessage(from, "⚠️ Please *register* first.", [{ label: "Register" }]);
        return res.sendStatus(200);
      }

      if (!doc.data().cardActive) {
        await sendMessage(
          from,
          "⚠️ You must complete *KYC* before funding.",
          [{ label: "KYC" }]
        );
        return res.sendStatus(200);
      }

      await sendMessage(
        from,
        "💰 Choose your funding method:",
        [{ label: "Crypto" }, { label: "Fiat" }]
      );
      return res.sendStatus(200);
    }

    if (userIntent === "crypto") {
      await sendMessage(from, "💎 We support *USDT (TRC20)* and *BTC*.");
      return res.sendStatus(200);
    }

    if (userIntent === "fiat") {
      await sendMessage(from, "🏦 Bank transfer coming soon.");
      return res.sendStatus(200);
    }

    /* -------------------------- EMAIL REGISTRATION ------------------------- */
    if (text.includes("@")) {
      const email = text.trim().toLowerCase();

      const waitlistSnapshot = await db.collection("waitlist").orderBy("timestamp", "asc").get();
      const waitlistEntries = waitlistSnapshot.docs.map((d) => d.data());
      const exists = waitlistEntries.some((w) => w.email === email);

      await db.collection("users").doc(from).set({
        phone: from,
        email,
        kycStatus: "pending",
        cardActive: false,
        annualFeePaid: false,
        isWaitlisted: exists,
        createdAt: new Date()
      });

      if (exists) {
        await sendMessage(from, "🎉 You're already on the waitlist.", [{ label: "KYC" }]);
      } else {
        await sendMessage(from, "✅ Account created!", [{ label: "KYC" }]);
      }

      return res.sendStatus(200);
    }

    /* ------------------------------ DEFAULT ------------------------------ */
    await sendMessage(
      from,
      "🤖 I didn’t understand that. Type *help* to see commands.",
      [{ label: "Help" }]
    );

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ WhatsApp route error:", err);
    res.sendStatus(500);
  }
});

export default router;
