// handlers/showBonusCard.js
const moysklad = require('../services/moysklad');
const generateBarcode = require('../utils/barcode');

module.exports = async function showBonusCard(bot, chatId, code) {
  try {
    const user = await moysklad.findCustomerByCode(code);
    if (!user) return bot.sendMessage(chatId, '❌ Kontragent topilmadi.');

    const bonus = user.bonusPoints || 0;
    const phone = user.phone;
    const barcodePath = await generateBarcode(phone, code);

    await bot.sendPhoto(chatId, barcodePath, {
      caption: `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Balansni qayta tekshirish', callback_data: 'check_balance' }],
        ],
      },
    });
  } catch (e) {
    console.error(e.response?.data || e.message);
    await bot.sendMessage(chatId, '❌ Kartani olishda xatolik.');
  }
};
