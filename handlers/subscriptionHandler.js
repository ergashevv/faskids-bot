/** @format */

const userStates = require("../userStates");

module.exports = (bot, existingUserKeyboard) => {
  const requiredChannelUsername = "faskids";
  const requiredChannelId = "@faskids"; // ✅ since it's a public channel, use @username

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const state = userStates[chatId];

    if (query.data === "check_subscription") {
      try {
        const member = await bot.getChatMember(requiredChannelId, userId);
        console.log(`${requiredChannelUsername} → status: ${member.status}`);

        if (["member", "administrator", "creator"].includes(member.status)) {
          await bot.sendMessage(
            chatId,
            "🎉 Ajoyib! Kanalga qo'shildingiz. Quyidagi menyudan foydalanishingiz mumkin.",
            existingUserKeyboard
          );
          userStates[chatId].userId = userId;
        } else {
          await bot.sendMessage(
            chatId,
            `❌ Siz hali kanalga qo'shilmagansiz. Iltimos, avval kanalga qo'shiling:\n\nhttps://t.me/${requiredChannelUsername}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "📲 Kanalga qo'shilish",
                      url: `https://t.me/${requiredChannelUsername}`,
                    },
                  ],
                  [
                    {
                      text: "✅ Tekshirish",
                      callback_data: "check_subscription",
                    },
                  ],
                ],
              },
            }
          );
        }
      } catch (err) {
        console.error(
          `Failed to get member info for @${requiredChannelUsername}:`,
          err.message
        );

        await bot.sendMessage(
          chatId,
          "❌ Tekshiruvda xatolik yuz berdi. Keyinroq urinib ko'ring."
        );
      }
    }
  });
};
