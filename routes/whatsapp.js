// routes/whatsapp.js → UPDATED WITH FUNDING HANDLERS
import express from "express";
import axios from "axios";
import { sendMessage, sendMessageWithButtons } from "../utils/sendMessage.js";
import { getDb } from "../db/mongo.js";
const router = express.Router();

const API_BASE = "https://tokicard-api.onrender.com/auth";
const WEBAPP = "https://tokicard-onboardingform.onrender.com";

/* ---------------------- META WEBHOOK VERIFICATION --------------------- */
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WhatsApp Webhook verified successfully!");
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
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    
    // Better text extraction with fallback
    let text = "";
    let isButton = false;
    
    if (message.text?.body) {
      text = message.text.body.trim().toLowerCase();
    } else if (message.interactive?.button_reply?.title) {
      text = message.interactive.button_reply.title.toLowerCase();
      isButton = true;
    } else if (message.interactive?.list_reply?.title) {
      text = message.interactive.list_reply.title.toLowerCase();
      isButton = true;
    }
    
    console.log("Message from", from, ":", text, isButton ? "(button)" : "(text)");
    
    if (!text) {
      console.log("No text content found in message");
      return res.sendStatus(200);
    }

    /* ----------------------------- INTENTS ----------------------------- */
    const intents = {
      register: ["activate card", "activate", "register", "signup", "sign up", "create account", "start", "open registration", "registration"],
      kyc: ["kyc", "verify", "identity", "verification", "id verification"],
      fund: ["fund", "top up", "deposit", "add money", "recharge"],
      balance: ["balance", "wallet", "check balance", "my balance"],
      help: ["help", "support", "assist", "commands"],
      about: ["about", "what is toki", "toki card", "info", "information"],
      how: ["how", "how it works", "guide", "tutorial"],
      security: ["safe", "secure", "trust", "security", "is it safe"],
      fees: ["cost", "fee", "charges", "price", "pricing"],
      features: ["features", "benefits", "what can", "advantages"],
      referral: ["refer", "invite", "referral", "refer friend"],
      crypto: ["crypto", "usdt", "bitcoin", "btc", "cryptocurrency"],
      fiat: ["fiat", "bank transfer"],
      card: ["show card", "card details", "show card details", "my card", "virtual card", "card info", "show my card", "view card", "see card", "card number"],
      acknowledge: ["ok", "okay", "cool", "thanks", "thank you", "got it"],
      followup: ["what next", "continue", "next", "then", "what now"],
      // ✅ NEW: Funding intents
      cryptoFund: ["fund with crypto", "crypto funding", "stablecoin"],
      bankFund: ["bank transfer (ngn)", "fund with bank", "ngn funding"]
    };

    // Check for exact matches first (for buttons)
    let userIntent = null;
    
    for (const [intent, list] of Object.entries(intents)) {
      if (list.includes(text)) {
        userIntent = intent;
        console.log("Exact match found:", intent);
        break;
      }
    }
    
    // If no exact match, try partial match
    if (!userIntent) {
      for (const [intent, list] of Object.entries(intents)) {
        if (list.some(kw => text.includes(kw))) {
          userIntent = intent;
          console.log("Partial match found:", intent);
          break;
        }
      }
    }
    
    console.log("Final detected intent:", userIntent);

    // GET USER FROM REAL BACKEND
    let user;
    try {
      const res = await axios.get(`${API_BASE}/user`, { params: { email: from }, timeout: 8000 });
      user = res.data;
      console.log("User found:", user ? "Yes" : "No");
    } catch (e) {
      console.log("User fetch error:", e.message);
      user = null;
    }

    /* ------------------------------ GREETING ------------------------------ */
    if (!isButton && !userIntent && /^(hi|hello|hey|greetings|good morning|good evening)$/i.test(text)) {
      await sendMessageWithButtons(from, "Welcome to *Toki Card*! 👋\n\nWhat would you like to do?", [
        { label: "Activate Card" }, { label: "Fund" }, { label: "Help" }
      ]);
      return res.sendStatus(200);
    }

    /* --------------------- CARD DETAILS — 2 MESSAGES --------------------- */
    if (userIntent === "card") {
      if (!user) {
        await sendMessageWithButtons(from, "Please *activate your card first* before viewing it.", [
          { label: "Activate Card" }
        ]);
        return res.sendStatus(200);
      }
      
      if (!user.card?.number) {
        await sendMessageWithButtons(from, "Your card is not ready yet. Please complete funding or try again later.", [
          { label: "Fund" }, { label: "Help" }
        ]);
        return res.sendStatus(200);
      }
      
      const card = user.card;
      await sendMessageWithButtons(from,
        `*Your Toki USD Virtual Card* 💳\n\n` +
        `• *Expiry:* ${card.expiry}\n` +
        `• *CVV:* ${card.cvv}\n\n` +
        `Your card number is below ⬇️`,
        [{ label: "Fund" }, { label: "Help" }]
      );
      await sendMessage(from, `*Card Number:*\n\`${card.number}\`\n\n_Tap & hold to copy_`);
      return res.sendStatus(200);
    }

    /* --------------------------- ACTIVATE CARD (REGISTER) --------------------------- */
    if (userIntent === "register") {
      const activationUrl = `https://tokicard-onboardingform.onrender.com/emailform`;
      await sendMessage(
        from,
        `🎉 *Welcome to Toki Card!*\n\nYour virtual USD card for seamless global payments.\n\n` +
        `✅ Fund with crypto (USDT, BTC)\n` +
        `✅ Spend anywhere online\n` +
        `✅ Instant card creation\n\n` +
        `Click below to activate your card now! 👇`,
        activationUrl,
        "Activate Card"
      );
      return res.sendStatus(200);
    }

    /* --------------------------- KYC --------------------------- */
    if (userIntent === "kyc") {
      const kycUrl = `https://tokicard-onboardingform.onrender.com/kycBasic`;
      await sendMessage(
        from,
        `📋 *Complete your KYC verification*\n\nThis is required before you can fund your card.`,
        kycUrl,
        "Start KYC"
      );
      return res.sendStatus(200);
    }

    /* --------------------------- FUND --------------------------- */
    if (userIntent === "fund") {
      if (!user) {
        await sendMessageWithButtons(from, "Please *activate your card first* before funding.", [
          { label: "Activate Card" }
        ]);
        return res.sendStatus(200);
      }
      if (!user?.kycBasicCompleted) {
        await sendMessageWithButtons(from, "⚠️ You must complete *KYC verification* first before funding.", [
          { label: "KYC" }
        ]);
        return res.sendStatus(200);
      }
      await sendMessageWithButtons(from, "💳 *Choose your funding method:*", [
        { label: "Crypto" }, { label: "Fiat" }
      ]);
      return res.sendStatus(200);
    }

    /* --------------------------- CRYPTO FUNDING (UPDATED) --------------------------- */
    if (userIntent === "crypto" || userIntent === "cryptoFund") {
      const cryptoUrl = `https://tokicard-onboardingform.onrender.com/crypto-deposit?phone=${from}`;
      await sendMessage(
        from,
        `🪙 *Crypto Funding*\n\n` +
        `We support:\n` +
        `• USDT (TRC20) - Min: $10\n` +
        `• USDC - Min: $10\n` +
        `• CTNG - Min: $5\n\n` +
        `💡 Deposits are processed *instantly*!`,
        cryptoUrl,
        "Start Crypto Deposit"
      );
      return res.sendStatus(200);
    }

    /* --------------------------- BANK FUNDING (UPDATED) --------------------------- */
    if (userIntent === "fiat" || userIntent === "bankFund") {
      if (!user) {
        await sendMessageWithButtons(from, "Please *activate your card first* before funding.", [
          { label: "Activate Card" }
        ]);
        return res.sendStatus(200);
      }

      // Get or generate virtual account
      let account = user.virtualAccount;
      
      if (!account) {
        account = {
          bankName: "Providus Bank",
          accountNumber: "98" + Math.floor(10000000 + Math.random() * 90000000),
          accountName: `TOKI-${user.firstName} ${user.lastName}`,
          rate: 1520
        };
        
        // Save to database
        const db = getDb();
        await db.collection("users").updateOne(
          { email: from },
          { $set: { virtualAccount: account } }
        );
      }

      await sendMessage(
        from,
        `🏦 *Your Personal Bank Account*\n\n` +
        `*Bank:* ${account.bankName}\n` +
        `*Account Number:* ${account.accountNumber}\n` +
        `*Account Name:* ${account.accountName}\n\n` +
        `📌 *How to fund:*\n` +
        `1. Transfer NGN to the account above\n` +
        `2. Funds convert automatically to USD\n` +
        `3. Card gets funded within minutes\n\n` +
        `💡 *Current Rate:* ₦${account.rate}/$1\n\n` +
        `_These are your permanent details. Save them!_`
      );

      await sendMessageWithButtons(
        from,
        "Need help?",
        [
          { label: "Check Balance" },
          { label: "Help" }
        ]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- BALANCE --------------------------- */
    if (userIntent === "balance") {
      if (!user) {
        await sendMessageWithButtons(from, "Please *activate your card first* to check your balance.", [
          { label: "Activate Card" }
        ]);
        return res.sendStatus(200);
      }
      const balance = user.balance || 0;
      await sendMessageWithButtons(from, 
        `💰 *Your Balance*\n\n$${balance.toFixed(2)} USD\n\n` +
        `${balance < 10 ? "Low balance. Consider funding your account!" : ""}`,
        [{ label: "Fund" }, { label: "Show Card" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- HELP --------------------------- */
    if (userIntent === "help") {
      await sendMessageWithButtons(from, 
        `🤖 *Toki Card Bot - Commands*\n\n` +
        `*Getting Started:*\n` +
        `• Activate Card - Create your account\n` +
        `• KYC - Verify your identity\n\n` +
        `*Card Management:*\n` +
        `• Fund - Add money to your card\n` +
        `• Balance - Check your balance\n` +
        `• Show Card - View card details\n\n` +
        `*Information:*\n` +
        `• About - Learn about Toki Card\n` +
        `• Features - See what we offer\n\n` +
        `Just type any command or click a button!`,
        [{ label: "Activate Card" }, { label: "About" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- ABOUT --------------------------- */
    if (userIntent === "about") {
      await sendMessageWithButtons(from,
        `*About Toki Card* 💳\n\n` +
        `Toki Card is your virtual USD card for seamless global payments.\n\n` +
        `✅ Fund with crypto (USDT, BTC)\n` +
        `✅ Spend anywhere online\n` +
        `✅ Instant card creation\n` +
        `✅ Secure & reliable\n\n` +
        `Ready to get started?`,
        [{ label: "Activate Card" }, { label: "Features" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- FEATURES --------------------------- */
    if (userIntent === "features") {
      await sendMessageWithButtons(from,
        `✨ *Toki Card Features*\n\n` +
        `🌍 Global Acceptance\n` +
        `💸 Low Fees\n` +
        `⚡ Instant Deposits\n` +
        `🔒 Bank-Level Security\n` +
        `💳 Virtual Card\n` +
        `📱 Easy Management\n\n` +
        `Get your card today!`,
        [{ label: "Activate Card" }, { label: "Help" }]
      );
      return res.sendStatus(200);
    }

    /* --------------------------- ACKNOWLEDGE --------------------------- */
    if (userIntent === "acknowledge") {
      await sendMessageWithButtons(from, "Great! 👍 Type *help* if you need anything else.", [
        { label: "Help" }
      ]);
      return res.sendStatus(200);
    }

    /* ------------------------------ DEFAULT ------------------------------ */
    await sendMessageWithButtons(from, 
      `🤔 I didn't understand that.\n\n` +
      `Type *help* to see what I can do, or click a button below.`, 
      [{ label: "Help" }, { label: "Activate Card" }, { label: "Fund" }]
    );
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ WhatsApp route error:", err);
    console.error("Error stack:", err.stack);
    res.sendStatus(500);
  }
});

export default router;