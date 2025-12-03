// services/statusChecker.js - Background job to check completed users
import { getDb } from "../db/mongo.js";
import { sendMessage, sendMessageWithButtons } from "../utils/sendMessage.js";

let isRunning = false;

export async function checkCompletedUsers() {
  if (isRunning) {
    console.log("⏩ Status checker already running, skipping...");
    return;
  }

  isRunning = true;
  
  try {
    const db = getDb();
    const users = db.collection("users");
    
    // Find users who completed all steps but haven't received congrats
    const completedUsers = await users.find({
      kycBasicCompleted: true,
      fundingCompleted: true,
      verifyCompleted: true,
      congratsSent: { $ne: true },
      phone: { $exists: true, $ne: null, $ne: "" }
    }).toArray();

    if (completedUsers.length === 0) {
      console.log("✅ No new completed users found");
      isRunning = false;
      return;
    }

    console.log(`🎉 Found ${completedUsers.length} completed user(s)!`);

    for (const user of completedUsers) {
      try {
        console.log(`📤 Sending congratulations to ${user.phone}...`);

        // Message 1: Congratulations
        await sendMessage(
          user.phone,
          `🎉 *Congratulations ${user.firstName}!*\n\n` +
          `Your Toki Card account is now fully activated!\n\n` +
          `*Your Registration Details:*\n` +
          `👤 Full Name: ${user.fullName}\n` +
          `📧 Email: ${user.email}\n` +
          `📅 Date of Birth: ${user.dob}\n` +
          `✅ KYC Status: Verified\n\n` +
          `You're all set to start using your virtual USD card! 🚀`
        );

        // Wait 3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Message 2: Funding intro
        await sendMessage(
          user.phone,
          `💳 *Next Step: Fund Your Card*\n\n` +
          `To start spending, you need to add funds to your card.\n\n` +
          `We offer two convenient funding methods:`
        );

        // Wait 2 more seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Message 3: Funding options with buttons
        await sendMessageWithButtons(
          user.phone,
          `*Choose Your Funding Method:*\n\n` +
          `🪙 *Crypto (Stablecoins)*\n` +
          `   • USDT (TRC20)\n` +
          `   • USDC\n` +
          `   • CTNG\n` +
          `   ⚡ Instant deposits\n\n` +
          `🏦 *Bank Transfer (NGN)*\n` +
          `   • Fund with local banks\n` +
          `   • Get personal account details\n` +
          `   💵 Easy & familiar`,
          [
            { label: "Fund with Crypto" },
            { label: "Bank Transfer (NGN)" }
          ]
        );

        // Mark as sent
        await users.updateOne(
          { _id: user._id },
          { 
            $set: { 
              congratsSent: true,
              congratsSentAt: new Date()
            } 
          }
        );

        console.log(`✅ Congrats sent to ${user.phone}`);

        // Wait 2 seconds before next user to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Failed to send to ${user.phone}:`, error.message);
        // Continue with next user even if one fails
      }
    }

  } catch (error) {
    console.error("❌ Status checker error:", error);
  } finally {
    isRunning = false;
  }
}

// Start the background checker
export function startStatusChecker(intervalSeconds = 30) {
  console.log(`🤖 Starting status checker (runs every ${intervalSeconds} seconds)`);
  
  // Run immediately on start
  checkCompletedUsers();
  
  // Then run at interval
  setInterval(() => {
    checkCompletedUsers();
  }, intervalSeconds * 1000);
}