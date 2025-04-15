const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  adId: { type: String, required: true, unique: true },
  originalText: { type: String, default: "" },
  media: { type: Object, default: null },
  broadcastedMessages: {
    type: Map,
    of: Number,
    default: {}
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ad", adSchema);
