const UserState = require("../models/UserState");
const moysklad = require("../services/moysklad");
const showBonusCard = require("../components/showBonusCard");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data === "check_balance") {
      try {
        // 1. MongoDB dan foydalanuvchi holatini olish
        const state = await UserState.findOne({ chatId });
        if (!state || !state.userCode) {
          return bot.sendMessage(chatId, "❗ You are not registered yet. Please press /start.");
        }
        
        // 2. Moysklad API orqali foydalanuvchi bonus ma'lumotlarini olish
        const customer = await moysklad.findCustomerByCode(state.userCode);
        if (!customer) {
          await bot.answerCallbackQuery(query.id, {
            text: "❌ Customer not found",
            show_alert: true,
          });
          return;
        }
        const bonus = customer.bonusPoints || 0;
        const phone = customer.phone;
        
        // 3. Hozirgi vaqtni formatlash (lotin yozuvida)
        const now = new Date();
        const formattedDate = now.toLocaleString("en-US", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        
        // 4. Yangi captionni tayyorlash
        const newCaption = `ℹ️ For every purchase you get 1% cashback; please present the barcode above to the cashier.\n\n` +
                           `💰 As of ${formattedDate}, your balance is: ${bonus}\n\n` +
                           `🧍‍♂️ Card holder: ${customer.name || "Not provided"}`;
        
        // 5. Xabarni yangilashga urinib ko'ramiz
        await bot.editMessageCaption(newCaption, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Check Balance Again", callback_data: "check_balance" }],
            ],
          },
        });
        await bot.answerCallbackQuery(query.id, { text: "Balance updated" });
      } catch (error) {
        // 6. Agar xato "message is not modified" bo'lsa
        if (
          error.response &&
          error.response.description &&
          error.response.description.includes("message is not modified")
        ) {
          try {
            // Avval eski xabarni o'chirish
            await bot.deleteMessage(chatId, query.message.message_id);
          } catch (delErr) {
            console.error("Error deleting previous message:", delErr.message);
          }
          try {
            // Yangi barcode va caption bilan bonus kartani qayta yuborish
            await showBonusCard(bot, chatId, state.userCode);
            await bot.answerCallbackQuery(query.id, { text: "Balance updated" });
          } catch (showErr) {
            console.error("Error sending new bonus card:", showErr.message);
            await bot.answerCallbackQuery(query.id, { text: "An error occurred" });
          }
        } else {
          console.error("Error updating balance:", error.message);
          await bot.answerCallbackQuery(query.id, { text: "An error occurred" });
        }
      }
    }
  });
};
