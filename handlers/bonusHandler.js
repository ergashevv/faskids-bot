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
          return bot.sendMessage(chatId, "❗ Siz hali ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosing.");
        }

        // 2. Moysklad API orqali foydalanuvchi bonus maʼlumotlarini olish
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, { text: "❌ Kontragent topilmadi", show_alert: true });
          return;
        }

        // 3. Eski xabarni toʻliq o‘chirish
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (deleteErr) {
          console.error("Eski xabarni o'chirishda xatolik:", deleteErr.message);
          // Xatolik bo'lsa ham, davom etamiz
        }

        // 4. Yangi bonus kartani barcode bilan yuborish
        await showBonusCard(bot, chatId, state.userCode);

        // 5. Callback queryga javob
        await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
      } catch (error) {
        console.error("Balansni yangilash xatosi:", error.message);
        await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
      }
    }
  });
};
