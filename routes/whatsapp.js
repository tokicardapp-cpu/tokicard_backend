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

    // 🧠 Unified text input handler (text or button)
    const text =
      message.text?.body?.trim().toLowerCase() ||
      message.interactive?.button_reply?.title?.toLowerCase() ||
      "";

    console.log("📩 Message received from", from, ":", text);

    // 🧠 NLP setup
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
      about: ["what is toki", "what is toki card", "toki card", "about", "who are you", "toki info", "tell me about toki"],
      how: ["how", "how it works", "how does it work", "explain", "working", "how to use", "usage"],
      security: ["safe", "secure", "trust", "is it safe", "security", "fraud", "scam", "legit"],
      fees: ["cost", "fee", "price", "charges", "how much", "payment", "subscription", "plan"],
      features: ["features", "benefits", "why use", "advantages", "good", "special", "functions"],
      referral: ["refer", "invite", "referral", "earn", "share link"],
      crypto: ["crypto", "bitcoin", "usdt", "wallet", "pay with crypto"],
      fiat: ["bank", "transfer", "usd", "fiat", "payment link"]
    };

    // 🧩 Smart Intent Detection (Substring + Fuzzy Matching)
    let userIntent = null;

    for (const [intent, keywords] of Object.entries(intents)) {
      for (const keyword of keywords) {
        if (text.includes(keyword) || tokens.some((word) => keyword.includes(word))) {
          userIntent = intent;
          break;
        }
      }
      if (userIntent) break;
    }

    // Fuzzy fallback
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

    /* 👋 Greeting */
    if (["hi", "hello", "hey", "hi toki", "hey toki", "hello toki"].some((greet) => text.includes(greet))) {
      await sendMessage(
        from,
        "👋 Welcome to *Toki Card*! What would you like to do?",
        [
          { label: "Fund" },
          { label: "Balance" },
          { label: "About" }
        ]
      );
      return res.sendStatus(200);
    }

    /* 🧠 Intent-based responses */
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
        "🌍 *About Toki Card*\n\n*Toki Card* is a USD virtual card that allows you to make payments globally — for Netflix, Spotify, and online purchases — using *crypto or your local currency*.\n\nIt’s built for Africans who want borderless payments that just work.\n\nWould you like me to explain *how it works*?",
        [{ label: "How It Works" }, { label: "Features" }]
      );
    }

    else if (userIntent === "how") {
      await sendMessage(
        from,
        "⚙️ *How Toki Card Works*\n\n1️⃣ *Register* with your phone number or email.\n2️⃣ *Verify* your identity (KYC) — takes only 2 minutes.\n3️⃣ *Fund* your card using crypto (USDT/BTC) or bank transfer.\n4️⃣ *Use your USD virtual card* to pay anywhere online — Netflix, Amazon, Spotify, and more.\n\nEverything happens right in WhatsApp. 💚",
        [{ label: "Register" }, { label: "Is it safe?" }]
      );
    }

    else if (userIntent === "security") {
      await sendMessage(
        from,
        "🔒 *Security & Trust*\n\nToki Card is powered by secure payment partners that comply with global financial standards (PCI-DSS & KYC/AML).\n\nAll user data is encrypted and your funds are protected with strong banking-grade security.\n\n✅ Verified partners\n✅ Encrypted transactions\n✅ Instant support within WhatsApp"
      );
    }

    else if (userIntent === "fees") {
      await sendMessage(
        from,
        "💸 *Toki Card Fees*\n\n• Early users: *FREE activation*\n• Funding fees: *0% for crypto*, *1% for fiat transfers*\n• Monthly maintenance: *$0 — no recurring charges*\n\nTransparent, simple, and affordable. 💚"
      );
    }

    else if (userIntent === "features") {
      await sendMessage(
        from,
        "✨ *Key Features of Toki Card*\n\n• Instant USD virtual card creation 💳\n• Fund with crypto or local currency 💰\n• No hidden fees 🪙\n• Global acceptance 🌎\n• 24/7 WhatsApp support 💬\n• Early users enjoy lifetime free activation 🔥"
      );
    }

    else if (userIntent === "referral") {
      await sendMessage(
        from,
        "🎁 *Referral Program*\nInvite friends to Toki Card and earn rewards every time they activate their card.\n\nReferral links launching soon — stay tuned! 👀"
      );
    }

    else if (userIntent === "crypto") {
      await sendMessage(
        from,
        "💎 *Fund with Crypto*\n\nWe support *USDT (TRC20)* and *Bitcoin (BTC)*.\nOnce payment is confirmed, your Toki Card balance updates instantly.\n\nWould you like me to send your deposit address?"
      );
    }

    else if (userIntent === "fiat") {
      await sendMessage(
        from,
        "🏦 *Fund with Bank Transfer*\n\nYou can send funds using your personalized payment link or bank account.\n\nWould you like me to generate your link?"
      );
    }

    /* 📧 Handle Email Input */
    else if (text.includes("@")) {
      const email = text.trim().toLowerCase();
      const waitlistSnapshot = await db.collection("waitlist").orderBy("timestamp", "asc").get();

      const waitlistEntries = waitlistSnapshot.docs.map((doc) => doc.data());
      const userIndex = waitlistEntries.findIndex(
        (entry) => entry.email.toLowerCase() === email
      );

      // ✅ New condition: anyone on the waitlist gets free activation
      const isWaitlisted = userIndex !== -1;

      await db.collection("users").doc(from).set({
        phone: from,
        email,
        kycStatus: "pending",
        cardActive: false,
        annualFeePaid: false,
        isWaitlisted,
        createdAt: new Date(),
      });

      if (isWaitlisted) {
        await sendMessage(
          from,
          `🎉 Welcome back, ${waitlistEntries[userIndex].fullName || "Toki user"}!\nYou're already on our waitlist — your Toki Card activation will be *FREE*! 🔥`,
          [{ label: "KYC" }]
        );
      } else {
        await sendMessage(
          from,
          "✅ Account created successfully! You’re now eligible for your Toki Card.",
          [{ label: "KYC" }]
        );
      }
    }

    /* 🤖 Default fallback */
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
