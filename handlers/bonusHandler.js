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
        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        
        // 3. Hozirgi vaqtni formatlash (masalan, 15/04/2025, 04:26:04)
        const now = new Date();
        const formattedDate = now.toLocaleString("uz-UZ", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        
        // 4. Yangi caption matni (to'liq o'zbek tilida)
        const newCaption = `ℹ️ Har bir xaridingizdan 3% cashback olish uchun yuqoridagi shtrix-kodni kassirga taqdim eting.\n\n` +
                           `💰 ${formattedDate} holatiga ko'ra balansingiz: ${bonus} ball\n\n` +
                           `🧍‍♂️ Karta egasi: ${customer.name || "Nom berilmagan"}`;

        try {
          // 5. Xabar captionini tahrir qilishga urinish
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
          // Agar yangi caption joriy bilan bir xil bo‘lsa ("message is not modified" xatosi)
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
              // Yangi bonus kartani qayta yuboramiz
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
