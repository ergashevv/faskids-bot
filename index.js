/** @format */

// index.js
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const existingUserKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Handlers
require("./handlers/startHandler")(bot);
require("./handlers/contactHandler")(bot, existingUserKeyboard);
require("./handlers/bonusHandler")(bot);
require("./handlers/subscriptionHandler")(bot, existingUserKeyboard);
