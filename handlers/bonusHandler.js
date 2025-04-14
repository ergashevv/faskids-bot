const UserState = require("../models/UserState");
const moysklad = require("../services/moysklad");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "check_balance") {
      // DB dan foydalanuvchi holatini olamiz
      const state = await UserState.findOne({ chatId });
      if (!state || !state.userCode) {
        return bot.sendMessage(chatId, "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.");
      }

      try {
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, { text: "❌ Kontragent topilmadi", show_alert: true });
          return;
        }
        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        const newCaption = `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`;
        // Harakat qilamiz: xabarni tahrir qilishga urinamiz
        await bot.editMessageCaption(newCaption, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Balansni qayta tekshirish', callback_data: 'check_balance' }],
            ]
          },
        });
        await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
      } catch (error) {
        if (
          error.response &&
          error.response.description &&
          error.response.description.includes("message is not modified")
        ) {
          // Agar yangilanish bo'lmasa, o'sha xabarni o'chirib yangisini qayta yuboramiz.
          try {
            await bot.deleteMessage(chatId, query.message.message_id);
          } catch (delErr) {
            console.error("Oldingi xabarni o‘chirishda xatolik:", delErr.message);
          }
          // Barcode va yangi bonus bilan yangisini generatsiya qilamiz
          try {
            await showBonusCard(bot, chatId, state.userCode);
            await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
          } catch (showErr) {
            console.error("Yangi bonus kartani yuborishda xatolik:", showErr);
            await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
          }
        } else {
          console.error("Balansni yangilashda xatolik:", error);
          await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
        }
      }
    }
  });
};
