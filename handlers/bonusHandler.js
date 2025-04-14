const UserState = require("../userStates");
const moysklad = require("../services/moysklad");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "check_balance") {
      try {
        // DB’dan foydalanuvchi holatini olish
        const state = await UserState.findOne({ chatId });
        if (!state || !state.userCode) {
          return bot.sendMessage(
            chatId,
            "❗ Siz hali ro'yxatdan o'tmagansiz. /start buyrug'ini bosing."
          );
        }

        // Moysklad API orqali kontragent ma'lumotlarini olish
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, { 
            text: "❌ Kontragent topilmadi", 
            show_alert: true 
          });
          return;
        }
        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        const newCaption = `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`;

        try {
          // Xabar captionini tahrir qilishga urinamiz
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
          await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
        } catch (editError) {
          // Agar xato "message is not modified" bo'lsa
          if (
            editError.response &&
            editError.response.description &&
            editError.response.description.includes("message is not modified")
          ) {
            try {
              // Avval eski xabarni o'chiramiz
              await bot.deleteMessage(chatId, query.message.message_id);
            } catch (delErr) {
              console.error("Oldingi xabarni o'chirishda xatolik:", delErr.message);
            }
            try {
              // Yangi barcode va yangilangan bonus ma'lumotlari bilan bonus kartani qayta yuboramiz
              await showBonusCard(bot, chatId, state.userCode);
              await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
            } catch (showErr) {
              console.error("Yangi bonus kartani yuborishda xatolik:", showErr.message);
              await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
            }
          } else {
            console.error("Balansni yangilashda xatolik:", editError.message);
            await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
          }
        }
      } catch (error) {
        console.error("Check balance error:", error.message);
        await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
      }
    }
  });
};
