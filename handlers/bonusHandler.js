const UserState = require("../models/UserState");
const moysklad = require("../services/moysklad");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data === "check_balance") {
      try {
        // 1. MongoDB’dan foydalanuvchi holatini olish
        const state = await UserState.findOne({ chatId });
        if (!state || !state.userCode) {
          return bot.sendMessage(chatId, "❗ You are not registered yet. Please press /start.");
        }
        
        // 2. Eski bonus xabarini majburiy ravishda o'chirish
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (deleteErr) {
          console.error("Error deleting the previous message:", deleteErr.message);
          // Agar xatolik yuz bersa, davom etamiz
        }
        
        // 3. Yangi bonus kartani (barcode va caption bilan) yuborish
        await showBonusCard(bot, chatId, state.userCode);
        
        // 4. Callback queryga javob qaytarish
        await bot.answerCallbackQuery(query.id, { text: "Balance updated" });
      } catch (error) {
        console.error("Error in check_balance callback:", error.message);
        await bot.answerCallbackQuery(query.id, { text: "An error occurred" });
      }
    }
  });
};
