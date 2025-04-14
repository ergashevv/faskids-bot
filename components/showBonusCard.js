const moysklad = require('../services/moysklad');
const generateBarcode = require('../utils/barcode');

module.exports = async function showBonusCard(bot, chatId, code) {
  try {
    // Moysklad API orqali foydalanuvchi ma'lumotlarini olish
    const user = await moysklad.findCustomerByCode(code);
    if (!user) {
      return bot.sendMessage(chatId, '❌ Kontragent topilmadi.');
    }

    const bonus = user.bonusPoints || 0;
    const phone = user.phone;
    const fullName = user.name || "Nom berilmagan";
    
    // Barcode generatsiyasi
    const barcodePath = await generateBarcode(phone, code);

    // Hozirgi vaqtni formatlash (14.04.2025 16:21:55 ko‘rinishida):
    const now = new Date();
    const formattedDate = now.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Caption matni – lotin yozuvida
    const caption = `ℹ️ Har bir xaridingizdan 3% kesbek olish uchun yuqoridagi shtrix-kodni kassirga taqdim eting.\n\n` +
                    `💰 Sizning ${formattedDate} holatiga ko'ra balansingiz: ${bonus}\n\n` +
                    `🧍‍♂️ Karta egasi: ${fullName}`;

    await bot.sendPhoto(chatId, barcodePath, {
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Balansni qayta tekshirish', callback_data: 'check_balance' }],
        ],
      },
    });
  } catch (e) {
    console.error(e.response?.data || e.message);
    await bot.sendMessage(chatId, '❌ Kartani olishda xatolik.');
  }
};
