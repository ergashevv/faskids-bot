// handlers/contactHandler.js
const { v4: uuidv4 } = require('uuid');
const moysklad = require('../services/moysklad');
const userStates = require('../userStates');
const showBonusCard = require('../components/showBonusCard');

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const state = userStates[chatId];

    if (text === '📲 Mening jamg‘arma kartam') {
      const userCode = userStates[chatId]?.userCode;
      if (!userCode) return bot.sendMessage(chatId, '❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.');
      return showBonusCard(bot, chatId, userCode);
    }

    if (state?.step === 'get_name') {
      userStates[chatId].fullName = text;
      userStates[chatId].step = 'get_phone';
      await bot.sendMessage(chatId, '📞 Endi telefon raqamingizni yuboring (masalan: +998901234567):', {
        reply_markup: {
          keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    } else if (msg.contact && state?.step === 'get_phone') {
      const rawPhone = msg.contact.phone_number;
      const fullName = state.fullName.trim();
      const code = `TG-${uuidv4().slice(0, 8)}`;
      const normalizedPhone = rawPhone.replace(/\D/g, '').replace(/^998/, '');
      const searchPhone = `998${normalizedPhone}`;

      try {
        const matches = await moysklad.findCustomerByPhone(searchPhone);

        if (matches.length > 0) {
          const matchedUser = matches[0];
          if (matchedUser.name.toLowerCase() === fullName.toLowerCase()) {
            userStates[chatId].userCode = matchedUser.code;
            return showBonusCard(bot, chatId, matchedUser.code);
          } else {
            return bot.sendMessage(chatId, `❗ Bu telefon raqam allaqachon boshqa foydalanuvchi (${matchedUser.name}) nomiga ro‘yxatdan o‘tgan. Iltimos, boshqa raqam kiriting yoki admin bilan bog‘laning.`);
          }
        }

        const created = await moysklad.createCustomer({
          name: fullName,
          phone: searchPhone,
          code,
        });

        userStates[chatId].userCode = code;
        return showBonusCard(bot, chatId, code);
      } catch (err) {
        console.error(err);
        await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko‘ring.');
      }
    }
  });
};