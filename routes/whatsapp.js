import express from "express";
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

    // 🧠 Unified handler: Text or Button click
    const text =
      message.text?.body?.trim().toLowerCase() ||
      message.interactive?.button_reply?.title?.toLowerCase() ||
      "";

    console.log("📩 Message received from", from, ":", text);

    /* 👋 Greeting */
    if (text === "hi" || text === "hello" || text === "hey") {
      await sendMessage(
        from,
        "👋 Welcome to *Toki Card*! What would you like to do?",
        [
          { label: "Register" },
          { label: "KYC" },
          { label: "Help" },
        ]
      );
      return res.sendStatus(200);
    }

    /* 📝 Registration */
    if (text === "register") {
      await sendMessage(
        from,
        "Please enter your *email address* to create your Toki account 📧"
      );
      return res.sendStatus(200);
    }

    /* 📧 Handle Email Input */
    if (text.includes("@")) {
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
      } else if (userIndex !== -1) {
        await sendMessage(
          from,
          `✅ Welcome back, ${
            waitlistEntries[userIndex].fullName || "Toki user"
          }!\nYou're on our waitlist, but outside the first 500. A small $2 activation fee will apply when you get your card.`,
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

    /* 🪪 KYC */
    if (text === "kyc") {
      const kycLink = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(
        from,
        `🔗 Please complete your KYC verification using the secure link below:\n\n${kycLink}\n\nOnce verified, I’ll activate your Toki Card.`,
        [{ label: "Help" }, { label: "Fund" }]
      );
      return res.sendStatus(200);
    }

    /* 🆘 Help */
    if (text === "help") {
      await sendMessage(
        from,
        "📘 *Toki Card Help Menu*\n\n• *register* → Create your account\n• *kyc* → Verify your identity\n• *fund* → Add money to your card\n• *balance* → View your balance\n• *activate* → Activate your card\n\n⚡ You can type or tap a button below.",
        [
          { label: "Register" },
          { label: "KYC" },
          { label: "Balance" },
        ]
      );
      return res.sendStatus(200);
    }

    /* 💬 Unknown Command */
    await sendMessage(
      from,
      "🤖 I didn’t understand that.\nType *help* or tap a button below 👇",
      [{ label: "Help" }, { label: "Register" }]
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp route error:", error);
    res.sendStatus(500);
  }
});

export default router;
