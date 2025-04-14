const UserState = require("../models/UserState");
const moysklad = require("../services/moysklad");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "check_balance") {
      // 1) DB’dan foydalanuvchi holatini olish
      const state = await UserState.findOne({ chatId });
      if (!state || !state.userCode) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      }

      try {
        // 2) MoySkladdan mijoz ma'lumotlarini olish
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, { text: "❌ Kontragent topilmadi", show_alert: true });
          return;
        }

        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        const newCaption = `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`;

        // 3) Xabarni tahrir qilishga harakat qilamiz
        await bot.editMessageCaption(newCaption, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Balansni qayta tekshirish", callback_data: "check_balance" }],
            ],
          },
        });

        // 4) Muvaffaqiyatli tahrirlangan bo'lsa:
        await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
      } catch (error) {
        // 5) Xatoliklarni ushlaymiz
        if (
          error.response &&
          error.response.description &&
          error.response.description.includes("message is not modified")
        ) {
          // 5a) Agar "message is not modified" bo'lsa => xabarni o'chirib, yangisini yuboramiz
          try {
            await bot.deleteMessage(chatId, query.message.message_id);
          } catch (delErr) {
            console.error("Oldingi xabarni o‘chirishda xatolik:", delErr.message);
          }

          // Yangi barcode va yangilangan bonus bilan yuborish
          try {
            await showBonusCard(bot, chatId, state.userCode);
            await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
          } catch (showErr) {
            console.error("Yangi bonus kartani yuborishda xatolik:", showErr);
            await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
          }
        } else {
          // 5b) Boshqa xatolik bo'lsa
          console.error("Balansni yangilashda xatolik:", error);
          await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
        }
      }
    }
  });
};
