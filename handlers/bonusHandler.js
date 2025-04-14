const UserState = require("../models/UserState"); // Yoki alohida helpers/state.js dagi getOrCreateUserState

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "check_balance") {
      // Avval DB dan foydalanuvchi holatini olamiz:
      const state = await UserState.findOne({ chatId });
      // Yoki: const state = await getOrCreateUserState(chatId);

      if (!state || !state.userCode) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      }

      // Agar userCode mavjud bo‘lsa, oldingi xabarni o'chirishga harakat qilamiz (ixtiyoriy)
      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (e) {
        console.log("Oldingi xabarni o‘chirishda xatolik:", e.message);
      }

      // Endi bonus kartani qayta ko‘rsatish
      await showBonusCard(bot, chatId, state.userCode);
    }
  });
};
