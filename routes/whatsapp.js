import express from "express";
import natural from "natural";
import { sendMessage } from "../utils/sendMessage.js";
import { db } from "../firebase.js";

const router = express.Router();

/* ✅ 1️⃣ Webhook Verification (Required by Meta) */
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

/* ✅ 2️⃣ Handle Incoming WhatsApp Messages */
router.post("/", async (req, res) => {
  try {
    console.log("📦 Incoming webhook:", JSON.stringify(req.body, null, 2));

    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;

    // 🧠 Unified input handler (text or button click)
    const text =
      message.text?.body?.trim().toLowerCase() ||
      message.interactive?.button_reply?.title?.toLowerCase() ||
      "";

    console.log("📩 Message received from", from, ":", text);

    // 🧠 NLP tokenization
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());

    // 🎯 Intent dictionary
    const intents = {
      register: ["register", "signup", "sign up", "create", "join", "get started", "start"],
      kyc: ["kyc", "verify", "verification", "identity", "id", "verify id", "confirm identity"],
      activate: ["activate", "activate card", "enable card", "start card", "card activation"],
      fund: ["fund", "top up", "deposit", "add money", "recharge", "add funds", "fund wallet"],
      balance: ["balance", "check balance", "how much", "remaining", "wallet balance"],
      help: ["help", "support", "assist", "problem", "contact", "customer care"],
      about: ["what is toki", "toki card", "about", "who are you", "how does toki work", "toki info"],
      referral: ["refer", "invite", "referral", "earn", "share link"],
      crypto: ["crypto", "bitcoin", "usdt", "wallet", "pay with crypto"],
      fiat: ["bank", "transfer", "usd", "fiat", "payment link"]
    };

    let userIntent = null;

    for (const [intent, keywords] of Object.entries(intents)) {
      if (tokens.some(word => keywords.includes(word))) {
        userIntent = intent;
        break;
      }
    }

    console.log("🎯 Detected intent:", userIntent);

    /* 👋 Greeting */
    if (["hi", "hello", "hey"].includes(text)) {
      await sendMessage(
        from,
        "👋 Welcome to *Toki Card*! What would you like to do?",
        [
          { label: "Register" },
          { label: "KYC" },
          { label: "Help" }
        ]
      );
      return res.sendStatus(200);
    }

    /* 🧠 Handle detected intents */
    if (userIntent === "register") {
      await sendMessage(
        from,
        "📝 Let's get you started!\nPlease enter your *email address* to register your Toki Card account."
      );
    }

    else if (userIntent === "kyc") {
      const kycLink = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(
        from,
        `🪪 To activate your Toki Card, please complete your KYC verification below:\n\n${kycLink}\n\nIt only takes a few minutes.`,
        [{ label: "Help" }, { label: "Fund" }]
      );
    }

    else if (userIntent === "activate") {
      await sendMessage(
        from,
        "💳 Once your KYC is approved and payment confirmed, your Toki Card will be automatically activated.\n\nType *balance* to check your balance anytime."
      );
    }

    else if (userIntent === "fund") {
      await sendMessage(
        from,
        "💰 You can fund your Toki Card using *crypto (USDT, BTC)* or *fiat (bank transfer)*.\n\nType *crypto* or *fiat* to choose your method."
      );
    }

    else if (userIntent === "balance") {
      await sendMessage(
        from,
        "💵 You can check your balance directly here once your card is active.\nType *activate* if you haven’t activated your card yet."
      );
    }

    else if (userIntent === "help") {
      await sendMessage(
        from,
        "🆘 *Toki Card Help Menu*\n\n• *register* → Create your account\n• *kyc* → Verify your identity\n• *fund* → Add money to your card\n• *balance* → View your balance\n• *activate* → Activate your card\n• *about* → Learn more about Toki Card\n\nYou can type or tap a button below 👇",
        [
          { label: "Register" },
          { label: "KYC" },
          { label: "About" }
        ]
      );
    }

    else if (userIntent === "about") {
      await sendMessage(
        from,
        "🌍 *About Toki Card*\n\n*Toki Card* is a USD virtual card that lets you pay for global services — like Netflix, Spotify, and online subscriptions — using *crypto or local currency*.\n\n✨ With Toki Card, you can:\n• Create a secure USD virtual card\n• Fund with *crypto (USDT, BTC)* or *bank transfer*\n• Enjoy zero monthly fees for early users\n• Get instant KYC verification\n\nType *register* to get started or *help* to see all commands."
      );
    }

    else if (userIntent === "referral") {
      await sendMessage(
        from,
        "🎁 You can invite friends to Toki Card and earn rewards!\nReferral links will be available soon — stay tuned 👀"
      );
    }

    else if (userIntent === "crypto") {
      await sendMessage(
        from,
        "💎 To fund with crypto, use *USDT (TRC20)* or *Bitcoin (BTC)*.\nOnce payment is confirmed, your card balance updates instantly.\n\nWould you like me to send your deposit address?"
      );
    }

    else if (userIntent === "fiat") {
      await sendMessage(
        from,
        "🏦 To fund with fiat, send a bank transfer using your personalized Toki Card payment link.\n\nWould you like me to generate your link?"
      );
    }

    /* 📧 Handle Email Input (same as before) */
    else if (text.includes("@")) {
      const email = text.trim().toLowerCase();
      const waitlistSnapshot = await db
        .collection("waitlist")
        .orderBy("timestamp", "asc")
        .get();

      const waitlistEntries = waitlistSnapshot.docs.map((doc) => doc.data());
      const userIndex = waitlistEntries.findIndex(
        (entry) => entry.email.toLowerCase() === email
      );

      const isEarlyUser = userIndex !== -1 && userIndex < 500;

      await db.collection("users").doc(from).set({
        phone: from,
        email,
        kycStatus: "pending",
        cardActive: false,
        annualFeePaid: false,
        isEarlyUser,
        createdAt: new Date(),
      });

      if (isEarlyUser) {
        await sendMessage(
          from,
          `🎉 Welcome back, ${
            waitlistEntries[userIndex].fullName || "Toki user"
          }!\nYou're among the *first 500 waitlist members* — your Toki Card activation will be *FREE*! 🔥`,
          [{ label: "KYC" }]
        );
      } else {
        await sendMessage(
          from,
          "✅ Account created successfully!",
          [{ label: "KYC" }]
        );
      }
    }

    /* 🤖 Default Fallback */
    else {
      await sendMessage(
        from,
        "🤖 I didn’t quite understand that.\nTry typing *help* or tap one of the buttons below 👇",
        [{ label: "Help" }, { label: "Register" }]
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp route error:", error);
    res.sendStatus(500);
  }
});

export default router;
