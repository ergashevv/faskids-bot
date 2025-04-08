/** @format */

// handlers/bonusHandler.js
const userStates = require("../userStates");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "check_balance") {
      const userCode = userStates[chatId]?.userCode;
      if (!userCode) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      }

      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (e) {
        console.log("Oldingi xabarni o‘chirishda xatolik:", e.message);
      }

      await showBonusCard(bot, chatId, userCode);
    }
  });
};
