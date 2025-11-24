// routes/whatsapp.js → FINAL VERSION (3 CONGRATS + NO BACKEND TOUCH)
import express from "express";
import axios from "axios";
import natural from "natural";
import { sendMessage, sendButtons } from "../utils/sendMessage.js";

const router = express.Router();
const tokenizer = new natural.WordTokenizer();

// CONFIG
const API_BASE = process.env.API_BASE || "https://tokicard-backendatabase.onrender.com/auth";
const WEBAPP = "https://tokicard-onboardingform.onrender.com";

// Cache + progress tracking
const userCache = new Map();
const userProgress = new Map(); // remembers last known state

async function getUser(phone) {
  if (userCache.has(phone)) return userCache.get(phone);
  try {
    const res = await axios.get(`${API_BASE}/user`, { params: { email: phone }, timeout: 8000 });
    const user = res.data;
    userCache.set(phone, user);
    return user;
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
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ====================== MAIN HANDLER ======================
router.post("/", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = (message.text?.body || "").trim().toLowerCase();
    const buttonId = message.interactive?.button_reply?.id;

    const user = await getUser(from);
    const name = user?.firstName ? user.firstName.split(" ")[0] : "there";

    // ===== TRACK PREVIOUS PROGRESS =====
    const prev = userProgress.get(from) || {};

    // ===== AUTO CONGRATS ON EVERY COMPLETED LEVEL =====
    if (user) {
      // 1. Just completed Basic KYC
      if (!prev.kycBasicCompleted && user.kycBasicCompleted) {
        await sendMessage(from,
          `*Congratulations ${name}!*\n\nStep 1 Complete: Profile & BVN verified!\n\nNext: Pay $5 and type *activate card* to unlock your virtual card`
        );
      }

      // 2. Just completed Funding / Activation
      if (!prev.fundingCompleted && user.fundingCompleted) {
        await sendMessage(from,
          `*BIG CONGRATS ${name}!*\n\nStep 2 Complete: Wallet Activated!\n\nYour Toki USD Card is now LIVE!\n\nType *card* to see your card details`
        );
        clearCache(from);
      }

      // 3. Just completed ID Verification
      if (!prev.verifyId && user.onboardingSteps?.verifyId) {
        await sendMessage(from,
          `*FULLY VERIFIED ${name}!*\n\nStep 3 Complete: Government ID confirmed!\n\nYou now have higher limits & full access unlocked!\nYou’re elite now`
        );
      }

      // Save current state
      userProgress.set(from, {
        kycBasicCompleted: !!user.kycBasicCompleted,
        fundingCompleted: !!user.fundingCompleted,
        verifyId: !!user.onboardingSteps?.verifyId
      });
    }

    // ====================== BUTTON: OPEN DASHBOARD ======================
    if (buttonId === "OPEN_WEB") {
      const link = user?.fundingCompleted
        ? `${WEBAPP}/dashboard?phone=${from}`
        : user?.kycBasicCompleted
          ? `${WEBAPP}/funding?phone=${from}`
          : `${WEBAPP}/?phone=${from}`;
      await sendMessage(from, `Opening your dashboard...\n${link}`);
      return res.sendStatus(200);
    }

    // ====================== NATURAL LANGUAGE ======================
    const words = tokenizer.tokenize(text) || [];
    const intents = {
      greeting: ["hi", "hello", "hey", "start", "good morning", "gm"],
      about: ["about", "what is toki", "explain"],
      how: ["how", "how it works", "how do i", "abeg how"],
      balance: ["balance", "wallet", "money"],
      card: ["card", "my card", "show card", "view card"],
      activate: ["activate card", "activate", "i paid", "paid", "done", "i have paid"],
      support: ["support", "help me", "issue"],
      menu: ["menu", "options"]
    };

    let intent = null;
    for (const [key, keywords] of Object.entries(intents)) {
      if (keywords.some(k => words.includes(k))) { intent = key; break; }
    }

    // ====================== ABOUT / HOW / SUPPORT ======================
    if (intent === "about") {
      await sendMessage(from, `*Toki Card*\n\nYour USD virtual card from Nigeria.\nPay Netflix, Amazon, Apple — anywhere.\nOne-time $5 activation.\nGet card in 2 mins on WhatsApp.\nAlready trusted by 10,000+ Nigerians`);
      await sendButtons(from, "Ready?", [{ id: "OPEN_WEB", title: "Get My Card" }]);
      return res.sendStatus(200);
    }

    if (intent === "how") {
      await sendMessage(from, `*How it works (2 mins)*\n\n1. Say hi → fill profile\n2. Pay $5 one-time\n3. Type *activate card*\n4. Type *card* → get card instantly\n\nThat’s all. No bank. No stress.`);
      await sendButtons(from, "Start?", [{ id: "OPEN_WEB", title: "Yes, Start Now" }]);
      return res.sendStatus(200);
    }

    if (intent === "support") {
      await sendMessage(from, `Need help?\n\nReply here and we’ll respond in minutes.\nOr chat @tokicard_support`);
      return res.sendStatus(200);
    }

    // ====================== ACTIVATE CARD ======================
    if (intent === "activate") {
      if (!user?.kycBasicCompleted) {
        await sendMessage(from, "Complete your profile first!\nSay *hi* to continue");
        return res.sendStatus(200);
      }
      if (user.fundingCompleted) {
        await sendMessage(from, "Already activated!\nType *card* to see it");
        return res.sendStatus(200);
      }

      await axios.post(`${API_BASE}/kyc-funding`, { email: from, amount: 5 });
      clearCache(from);

      await sendMessage(from, `*ACTIVATED!* Your card is ready!\nType *card* now`);
      return res.sendStatus(200);
    }

    // ====================== SHOW CARD ======================
    if (intent === "card") {
      if (!user?.fundingCompleted) {
        await sendMessage(from, "Activate first! Type *activate card*");
        return res.sendStatus(200);
      }
      if (!user.card?.number) {
        await sendMessage(from, "Card generating... wait 30 secs and say *card* again");
        return res.sendStatus(200);
      }

      const c = user.card;
      await sendMessage(from,
        `*Your Toki USD Card*\n\n` +
        `Holder: ${c.name || "TOKI USER"}\n` +
        `Number: \`${c.number}\`\n` +
        `Expiry: ${c.expiry} • CVV: ${c.cvv}\n\n` +
        `_Tap & hold to copy • Works worldwide_`
      );
      return res.sendStatus(200);
    }

    // ====================== BALANCE ======================
    if (intent === "balance") {
      await sendMessage(from, `Balance: *$${user?.fundedAmount || 0}.00 USD*`);
      return res.sendStatus(200);
    }

    // ====================== GREETING / MENU ======================
    if (intent === "greeting" || intent === "menu" || !text) {
      await sendMessage(from, `Hey ${name}! Welcome to *Toki Card*`);

      const buttons = [
        { id: "OPEN_WEB", title: user?.fundingCompleted ? "Dashboard" : user?.kycBasicCompleted ? "Activate Card ($5)" : "Get Started" },
        { title: "About Toki", id: "about" },
        { title: "How It Works", id: "how" },
        { title: "Support", id: "support" }
      ];

      if (user?.kycBasicCompleted) buttons.splice(1, 0, { title: "Check Balance", id: "balance" });
      if (user?.fundingCompleted) buttons.splice(1, 0, { title: "View My Card", id: "card" });

      await sendButtons(from, "Choose:", buttons);
      return res.sendStatus(200);
    }

    // ====================== DEFAULT ======================
    await sendButtons(from, "Main Menu:", [
      { id: "OPEN_WEB", title: "Continue" },
      { title: "About", id: "about" },
      { title: "How It Works", id: "how" }
    ]);

    return res.sendStatus(200);

  } catch (err) {
    console.error("Bot error:", err.message);
    await sendMessage(message?.from || "unknown", "Small issue. Try again");
    res.sendStatus(500);
  }
});

export default router;