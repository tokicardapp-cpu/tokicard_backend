import express from "express";
import { db } from "../firebase.js";
import { sendMessage } from "../utils/sendMessage.js";

const router = express.Router();

// ✅ WhatsApp webhook verification (required by Meta)
router.get("/", (req, res) => {
 const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
 // Must match Meta dashboard

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

// ✅ WhatsApp webhook message receiver
router.post("/", (req, res) => {
  console.log("📩 WhatsApp webhook event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// ✅ KYC webhook (from Sumsub / IdentityPass)
router.post("/kyc", async (req, res) => {
  const { userId, status } = req.body;

  if (status === "approved") {
    await db.collection("users").doc(userId).update({ kycStatus: "approved" });

    const user = await db.collection("users").doc(userId).get();
    await sendMessage(user.data().phone, "✅ KYC approved! Type 'activate' to continue.");
  }

  res.sendStatus(200);
});

// ✅ Payment webhook (from Paystack / NOWPayments)
router.post("/payment", async (req, res) => {
  const { userId, amount, status } = req.body;

  if (status === "confirmed") {
    const userRef = db.collection("users").doc(userId);
    const user = await userRef.get();

    await userRef.update({
      cardActive: true,
      annualFeePaid: true,
    });

    await sendMessage(
      user.data().phone,
      `💳 Payment of $${amount} confirmed! Your card is now active.`
    );
  }

  res.sendStatus(200);
});

export default router;
