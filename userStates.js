// models/UserState.js
const mongoose = require("mongoose");

const userStateSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  fullName: { type: String, default: "" },
  phone: { type: String, default: "" },
  userCode: { type: String, default: "" },
  step: { type: String, default: "main_menu" },
  feedbackMessages: { type: [String], default: [] },
  applicationData: { type: Object, default: {} },
  // Reklama xabarlarining message_id larini saqlash uchun maydon
  adMessages: { type: [Number], default: [] }
}, { timestamps: true });

module.exports = mongoose.model("UserState", userStateSchema);
