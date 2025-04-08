// handlers/startHandler.js
module.exports = (bot) => {
    const userStates = require('../userStates');
  
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      userStates[chatId] = { step: 'get_name' };
      await bot.sendMessage(chatId, '👋 Ismingiz va familiyangizni yuboring (masalan: Ali Valiyev):');
    });
  };
  