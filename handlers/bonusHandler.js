const UserState = require("../models/UserState"); // DB model
const moysklad = require("../services/moysklad");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data === "check_balance") {
      try {
        // DB dan foydalanuvchi holatini olish
        const state = await UserState.findOne({ chatId });
        if (!state || !state.userCode) {
          return bot.sendMessage(
            chatId,
            "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
          );
        }

        // State dan userCode ni olib, Moysklad API orqali mijoz ma'lumotini olish
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, { text: "❌ Kontragent topilmadi", show_alert: true });
          return;
        }

        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        const newCaption = `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`;

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
        // Agar "message is not modified" xatosi yuz bersa:
        if (
          error.response &&
          error.response.description &&
          error.response.description.includes("message is not modified")
        ) {
          await bot.answerCallbackQuery(query.id, { text: "Balans hozirgi qiymatda" });
        } else {
          console.error("Balansni yangilashda xatolik:", error);
          await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
        }
      }
    }
  });
};
