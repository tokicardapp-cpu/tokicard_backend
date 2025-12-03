import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import whatsappRoutes from "./routes/whatsapp.js";
import webhookRoutes from "./routes/webhooks.js";
import { connectToMongo } from "./db/mongo.js";
import { startStatusChecker } from "./services/statusChecker.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use("/whatsapp", whatsappRoutes);
app.use("/webhooks", webhookRoutes);

app.get("/", (req, res) => {
  res.send("✅ Toki bot server is working!");
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MongoDB FIRST
    await connectToMongo();
    console.log("✅ MongoDB ready");
    
    // 2. Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Toki bot running on port ${PORT}`);
    });
    
    // 3. Wait 5 seconds, THEN start checker (give everything time to settle)
    setTimeout(() => {
      console.log("🤖 Starting status checker...");
      startStatusChecker(30);
    }, 5000);
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();