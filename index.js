// index.js
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Handlers
require('./handlers/startHandler')(bot);
require('./handlers/contactHandler')(bot);
require('./handlers/bonusHandler')(bot);
