import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import whatsappRoutes from "./routes/whatsapp.js";
import webhookRoutes from "./routes/webhooks.js";

dotenv.config();
const app = express();

app.use(bodyParser.json());
app.use("/whatsapp", whatsappRoutes);
app.use("/webhooks", webhookRoutes);

// 👇 Test route
app.get("/", (req, res) => {
  res.send("✅ Toki bot server is working!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Toki bot running on port ${PORT}`));
