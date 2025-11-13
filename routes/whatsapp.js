import express from "express";
import { sendMessage } from "../utils/sendMessage.js";
import { db } from "../firebase.js";

const router = express.Router();

/* --------------------------- CARD GENERATOR --------------------------- */
function generateCard() {
  const random4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  const zw = "\u200B"; // zero-width joiner – stops line breaks
  const number =
    random4() + zw + random4() + zw + random4() + zw + random4();

  const expiryMonth = ("0" + Math.floor(1 + Math.random() * 12)).slice(-2);
  const expiryYear = 26 + Math.floor(Math.random() * 6); // 2026-2031
  const cvv = Math.floor(100 + Math.random() * 900).toString();

  const addresses = [
    "55 Madison Ave, New York, NY",
    "1208 Sunset Blvd, Los Angeles, CA",
    "322 Park Ave, Miami, FL",
    "44 Wall Street, New York, NY",
    "270 Pine St, San Francisco, CA",
  ];

  return {
    number, // ZWJ-protected
    expiry: `${expiryMonth}/${expiryYear}`,
    cvv,
    billingAddress: addresses[Math.floor(Math.random() * addresses.length)],
  };
}

/* ---------------------- WEBHOOK VERIFICATION ---------------------- */
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

/* ----------------------------- MAIN POST --------------------------- */
router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text =
      message.text?.body?.trim().toLowerCase() ||
      message.interactive?.button_reply?.title?.toLowerCase() ||
      "";

    /* --------------------------- INTENTS --------------------------- */
    const intents = {
      register: ["register", "signup", "sign up", "create", "start"],
      kyc: ["kyc", "verify", "identity", "id"],
      fund: ["fund", "top up", "deposit"],
      card: [
        "show card",
        "card details",
        "my card",
        "virtual card",
        "card info",
      ],
      // … keep the rest you already have …
    };

    let intent = null;
    for (const [i, list] of Object.entries(intents)) {
      if (list.some((k) => text.includes(k))) {
        intent = i;
        break;
      }
    }

    /* --------------------------- GREETING -------------------------- */
    if (["hi", "hello", "hey"].some((g) => text.includes(g))) {
      await sendMessage(
        from,
        "Welcome to *Toki Card*!",
        [{ label: "Fund" }, { label: "About" }, { label: "Help" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- CARD --------------------------- */
    if (intent === "card") {
      const ref = db.collection("users").doc(from);
      const doc = await ref.get();

      if (!doc.exists) {
        await sendMessage(
          from,
          "Please *register* first.",
          [{ label: "Register" }]
        );
        return res.sendStatus(200);
      }

      let card = doc.data().card;
      if (!card) {
        card = generateCard();
        await ref.update({ card });
      }

      // ---- MESSAGE 1: other details ----
      await sendMessage(
        from,
        `*Your Toki USD Virtual Card*\n\n` +
          `• *Expiry:* ${card.expiry}\n` +
          `• *CVV:* ${card.cvv}\n` +
          `• *Billing:* ${card.billingAddress}\n\n` +
          `Card number below`,
        [{ label: "Fund" }, { label: "Help" }]
      );

      // ---- MESSAGE 2: CARD NUMBER (single back-ticks) ----
      await sendMessage(
        from,
        `*Card Number:*\n\`${card.number}\`\n\n_Tap & hold to copy_`,
        []
      );

      return res.sendStatus(200);
    }

    /* --------------------------- REGISTER (URL BUTTON) ---------------- */
    if (intent === "register") {
      const regUrl = `https://tokicard-onboardingform.onrender.com?phone=${from}`;

      // URL BUTTON – ALWAYS opens inside WhatsApp
      await sendMessage(
        from,
        "Tap the button to start registration:",
        [
          {
            type: "reply",
            reply: { id: "REG_BTN", title: "Open Registration" },
          },
        ],
        "button",
        { url: regUrl } // <-- this is the magic
      );
      return res.sendStatus(200);
    }

    /* --------------------------- KYC (URL BUTTON) ------------------- */
    if (intent === "kyc") {
      const kycUrl = `https://kyc.tokicard.com/session?user=${from}`;

      await sendMessage(
        from,
        "Complete your KYC:",
        [
          {
            type: "reply",
            reply: { id: "KYC_BTN", title: "Start KYC" },
          },
        ],
        "button",
        { url: kycUrl }
      );
      return res.sendStatus(200);
    }

    /* --------------------------- FUND --------------------------- */
    if (intent === "fund") {
      const ref = db.collection("users").doc(from);
      const doc = await ref.get();

      if (!doc.exists) {
        await sendMessage(from, "Register first.", [{ label: "Register" }]);
        return res.sendStatus(200);
      }
      if (!doc.data().cardActive) {
        await sendMessage(from, "Finish KYC first.", [{ label: "KYC" }]);
        return res.sendStatus(200);
      }

      await sendMessage(
        from,
        "Choose funding method:",
        [{ label: "Crypto" }, { label: "Fiat" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- EMAIL REG ---------------------- */
    if (text.includes("@")) {
      const email = text.trim().toLowerCase();
      const waitlistSnap = await db.collection("waitlist")
        .orderBy("timestamp", "asc")
        .get();
      const exists = waitlistSnap.docs.some(
        (d) => d.data().email === email
      );

      await db.collection("users").doc(from).set(
        {
          phone: from,
          email,
          kycStatus: "pending",
          cardActive: false,
          annualFeePaid: false,
          isWaitlisted: exists,
          createdAt: new Date(),
        },
        { merge: true }
      );

      await sendMessage(
        from,
        exists ? "You're on the waitlist." : "Account created!",
        [{ label: "KYC" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- DEFAULT ----------------------- */
    await sendMessage(
      from,
      "I didn’t understand. Type *help*.",
      [{ label: "Help" }]
    );
    return res.sendStatus(200);
  } catch (err) {
    console.error("Route error:", err);
    res.sendStatus(500);
  }
});

export default router;