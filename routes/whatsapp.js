import express from "express";
import { sendMessage } from "../utils/sendMessage.js";
import { db } from "../firebase.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from; // User's WhatsApp number
    const text = message.text?.body?.trim().toLowerCase();

    console.log("📩 Message received from", from, ":", text);

    // 👋 Greeting
    if (text === "hi" || text === "hello") {
      await sendMessage(
        from,
        "👋 Welcome to *Toki Card*!\n\nI can help you create your USD virtual card, verify KYC, and fund it with crypto or fiat.\n\nType *register* to get started."
      );
      return res.sendStatus(200);
    }

    // 📝 Registration
    if (text === "register") {
      await sendMessage(
        from,
        "Please enter your *email address* to create your Toki account 📧"
      );
      return res.sendStatus(200);
    }

    // 📧 When user sends an email
    if (text.includes("@")) {
      const email = text.trim().toLowerCase();

      // Get waitlist (ordered by timestamp)
      const waitlistSnapshot = await db
        .collection("waitlist")
        .orderBy("timestamp", "asc")
        .get();

      const waitlistEntries = waitlistSnapshot.docs.map((doc) => doc.data());

      // Find this user's position in the waitlist
      const userIndex = waitlistEntries.findIndex(
        (entry) => entry.email.toLowerCase() === email
      );

      // Determine if early user (first 500)
      const isEarlyUser = userIndex !== -1 && userIndex < 500;

      // Save user info to "users" collection
      await db.collection("users").doc(from).set({
        phone: from,
        email,
        kycStatus: "pending",
        cardActive: false,
        annualFeePaid: false,
        isEarlyUser,
        createdAt: new Date(),
      });

      // Respond appropriately
      if (isEarlyUser) {
        await sendMessage(
          from,
          `🎉 Welcome back, ${
            waitlistEntries[userIndex].fullName || "Toki user"
          }!\nYou're among the *first 500 waitlist members* — your Toki Card activation will be *FREE*! 🔥\n\nNow type *kyc* to verify your identity.`
        );
      } else if (userIndex !== -1) {
        await sendMessage(
          from,
          `✅ Welcome back, ${
            waitlistEntries[userIndex].fullName || "Toki user"
          }!\nYou're on our waitlist, but outside the first 500. A small $2 activation fee will apply when you get your card.\n\nNow type *kyc* to verify your identity.`
        );
      } else {
        await sendMessage(
          from,
          "✅ Account created successfully!\n\nNow type *kyc* to verify your identity."
        );
      }

      return res.sendStatus(200);
    }

    // 🪪 KYC Link
    if (text === "kyc") {
      const kycLink = `https://kyc.tokicard.com/session?user=${from}`;
      await sendMessage(
        from,
        `🔗 Please complete your KYC verification using the secure link below:\n\n${kycLink}\n\nOnce verified, I’ll activate your Toki Card.`
      );
      return res.sendStatus(200);
    }

    // 🆘 Help Command
    if (text === "help") {
      await sendMessage(
        from,
        "📘 *Toki Card Help Menu*\n\n• *register* → Create your account\n• *kyc* → Verify your identity\n• *fund* → Add money to your card\n• *balance* → View your balance\n• *activate* → Activate your card\n\n⚡ Tip: Type the keyword directly, e.g., 'kyc'"
      );
      return res.sendStatus(200);
    }

    // 💬 Unrecognized message fallback
    await sendMessage(
      from,
      "🤖 Sorry, I didn’t understand that.\nType *help* to see what I can do."
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp route error:", error);
    res.sendStatus(500);
  }
});

export default router;
