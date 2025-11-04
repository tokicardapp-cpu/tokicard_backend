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
    } else res.sendStatus(403);
  } else res.sendStatus(400);
});

/* ✅ 2️⃣ Handle Incoming WhatsApp Messages */
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

    // 🧠 NLP tokenization
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());

    // 🎯 Ordered intent dictionary (prioritize "about" first)
    const intents = {
      about: ["what is toki", "what is toki card", "toki card", "about", "who are you", "toki info", "tell me about toki"],
      how: ["how", "how it works", "how does it work", "explain", "working", "how to use", "usage"],
      security: ["safe", "secure", "trust", "is it safe", "security", "fraud", "scam", "legit"],
      features: ["features", "benefits", "why use", "advantages", "good", "special", "functions"],
      fees: ["cost", "fee", "price", "charges", "how much", "payment", "subscription", "plan"],
      register: ["register", "signup", "sign up", "create", "join", "get started", "start"],
      kyc: ["kyc", "verify", "verification", "identity", "id", "verify id", "confirm identity"],
      activate: ["activate", "activate card", "enable card", "start card", "card activation"],
      fund: ["fund", "top up", "deposit", "add money", "recharge", "add funds", "fund wallet"],
      balance: ["balance", "check balance", "how much", "remaining", "wallet balance"],
      help: ["help", "support", "assist", "problem", "contact", "customer care"],
      referral: ["refer", "invite", "referral", "earn", "share link"],
      crypto: ["crypto", "bitcoin", "usdt", "wallet", "pay with crypto"],
      fiat: ["bank", "transfer", "usd", "fiat", "payment link"]
    };

    // 🧩 Smart intent detection
    let userIntent = null;

    // Step 1: substring or token match
    for (const [intent, keywords] of Object.entries(intents)) {
      for (const keyword of keywords) {
        if (text.includes(keyword) || tokens.some((word) => keyword.includes(word))) {
          userIntent = intent;
          break;
        }
      }
      if (userIntent) break;
    }

    // Step 2: fuzzy matching
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
        "👋 Welcome to *Toki Card*! I can help you get started, verify KYC, or learn what we’re about.",
        [
          { label: "Register" },
          { label: "KYC" },
          { label: "What is Toki Card?" }
        ]
      );
      return res.sendStatus(200);
    }

    /* 🧠 Intent responses */
    if (userIntent === "about") {
      await sendMessage(
        from,
        "🌍 *About Toki Card*\n\n*Toki Card* is a USD virtual card that lets you make payments globally — Netflix, Spotify, Amazon, and more — using *crypto or local currency*.\n\nWe’re built for Africans who need borderless payments that just work.\n\nWould you like me to explain *how it works*?",
        [{ label: "How It Works" }, { label: "Features" }]
      );
    }

    else if (userIntent === "how") {
      await sendMessage(
        from,
        "⚙️ *How Toki Card Works*\n\n1️⃣ *Register* with your email or phone.\n2️⃣ *Verify* identity (KYC) — takes 2 minutes.\n3️⃣ *Fund* using crypto (USDT/BTC) or bank transfer.\n4️⃣ *Use your USD virtual card* to pay for anything online.\n\nAll inside WhatsApp — simple and secure 💚",
        [{ label: "Register" }, { label: "Is it safe?" }]
      );
    }

    else if (userIntent === "security") {
      await sendMessage(
        from,
        "🔒 *Security & Trust*\n\nToki Card works with global partners that comply with PCI-DSS and KYC/AML standards. Your data and funds are always protected.\n\n✅ Verified partners\n✅ Encrypted transactions\n✅ Instant WhatsApp support"
      );
    }

    else if (userIntent === "features") {
      await sendMessage(
        from,
        "✨ *Toki Card Features*\n\n• Create USD virtual card instantly 💳\n• Fund with crypto or fiat 💰\n• No hidden fees 🪙\n• Works globally 🌎\n• 24/7 WhatsApp support 💬\n• Early users enjoy lifetime free activation 🔥"
      );
    }

    else if (userIntent === "fees") {
      await sendMessage(
        from,
        "💸 *Toki Card Fees*\n\n• Early users: *FREE activation*\n• Regular activation: *$2 one-time fee*\n• Funding: *0% crypto*, *1% fiat*\n• Monthly fee: *$0*\n\nSimple. Transparent. Fair. 💚"
      );
    }

    else if (userIntent === "register") {
      await sendMessage(
        from,
        "📝 Let's get you started!\nPlease enter your *email address* to register your Toki Card account."
      );
    }

    else if (userIntent === "kyc") {
      const kycLink = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(
        from,
        `🪪 Complete your KYC below to activate your Toki Card:\n\n${kycLink}\n\nTakes only a few minutes.`,
        [{ label: "Help" }, { label: "Fund" }]
      );
    }

    else if (userIntent === "fund") {
      await sendMessage(
        from,
        "💰 Fund your Toki Card using *crypto (USDT/BTC)* or *fiat (bank transfer)*.\n\nChoose your method below 👇",
        [{ label: "Crypto" }, { label: "Bank Transfer" }]
      );
    }

    else if (userIntent === "activate") {
      await sendMessage(
        from,
        "💳 Once your KYC is approved and payment is confirmed, your card activates automatically!\n\nYou can then check your *balance* anytime."
      );
    }

    else if (userIntent === "help") {
      await sendMessage(
        from,
        "🆘 *Toki Card Help Menu*\n\n• *Register* → Create your account\n• *KYC* → Verify your identity\n• *Fund* → Add money\n• *About* → Learn what we do\n\nYou can also tap a button below 👇",
        [{ label: "Register" }, { label: "KYC" }, { label: "What is Toki Card?" }]
      );
    }

    else if (userIntent === "referral") {
      await sendMessage(
        from,
        "🎁 *Referral Program*\nInvite friends and earn rewards when they activate their card.\n\nReferral links coming soon! 👀"
      );
    }

    else if (userIntent === "crypto") {
      await sendMessage(
        from,
        "💎 *Fund with Crypto*\n\nWe support *USDT (TRC20)* and *Bitcoin (BTC)*.\nOnce confirmed, your Toki Card balance updates instantly.\n\nWould you like me to send your deposit address?"
      );
    }

    else if (userIntent === "fiat") {
      await sendMessage(
        from,
        "🏦 *Fund via Bank Transfer*\n\nYou’ll get a personal link or account for easy deposit.\nWould you like me to generate it?"
      );
    }

    /* 📧 Handle Email Input */
    else if (text.includes("@")) {
      const email = text.trim().toLowerCase();
      const waitlistSnapshot = await db.collection("waitlist").orderBy("timestamp", "asc").get();
      const waitlistEntries = waitlistSnapshot.docs.map((doc) => doc.data());
      const userIndex = waitlistEntries.findIndex((entry) => entry.email.toLowerCase() === email);
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
          `🎉 Welcome back, ${waitlistEntries[userIndex].fullName || "Toki user"}!\nYou're among the *first 500 waitlist members* — your Toki Card activation is *FREE*! 🔥`,
          [{ label: "KYC" }]
        );
      } else {
        await sendMessage(from, "✅ Account created successfully!", [{ label: "KYC" }]);
      }
    }

    /* 🤖 Default fallback */
    else {
      await sendMessage(
        from,
        "🤖 I didn’t quite understand that.\nTry typing *help* or tap below 👇",
        [{ label: "Help" }, { label: "What is Toki Card?" }]
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp route error:", error);
    res.sendStatus(500);
  }
});

export default router;
