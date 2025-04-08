const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const bwipjs = require('bwip-js');
const fs = require('fs');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const MOYSKLAD_API = 'https://api.moysklad.ru/api/remap/1.2';

const headers = {
  Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`,
  'Content-Type': 'application/json',
};

const userStates = {};

// /start - ism va familiya olish
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'get_name' };
  await bot.sendMessage(chatId, '👋 Ismingiz va familiyangizni yuboring (masalan: Sa`dullayev Quvonchbek):');
});

// Message listener
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const state = userStates[chatId];

  if (text === '📲 Mening jamg‘arma kartam') {
    const userCode = userStates[chatId]?.userCode;
    if (!userCode) return bot.sendMessage(chatId, '❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.');
    return showBonusCard(chatId, userCode);
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
  }
  else if (msg.contact && state?.step === 'get_phone') {
    const rawPhone = msg.contact.phone_number;
    const fullName = state?.fullName?.trim();
    const code = `TG-${uuidv4().slice(0, 8)}`;
    const normalizedPhone = rawPhone.replace(/\D/g, '').replace(/^998/, '');
    const searchPhone = `998${normalizedPhone}`;
  
    try {
      const existing = await axios.get(`${MOYSKLAD_API}/entity/counterparty?filter=phone=${searchPhone}`, { headers });
      const matches = existing.data.rows;
  
      if (matches.length > 0) {
        const matchedUser = matches[0];
  
        // 🔍 Tekshiramiz: ism ham aynan shu bo‘lsa — ishlatamiz
        if (matchedUser.name.toLowerCase() === fullName.toLowerCase()) {
          userStates[chatId].userCode = matchedUser.code;
          return showBonusCard(chatId, matchedUser.code);
        } else {
          // ❗ Raqam bor, lekin ism boshqa — xatolik
          return bot.sendMessage(chatId, `❗ Bu telefon raqam allaqachon boshqa foydalanuvchi (${matchedUser.name}) nomiga ro‘yxatdan o‘tgan. Iltimos, boshqa raqam kiriting yoki admin bilan bog‘laning.`);
        }
      }
  
      // ✅ Hech kim bu raqamni ishlatmagan bo‘lsa — yangi foydalanuvchi yaratamiz
      const create = await axios.post(`${MOYSKLAD_API}/entity/counterparty`, {
        name: fullName,
        phone: searchPhone,
        code,
        tags: ['накопительный бонус'],
        attributes: [
          {
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/counterparty/metadata/attributes/${process.env.BONUS_FIELD_ID}`,
              type: 'attributemetadata',
              mediaType: 'application/json',
            },
            value: 0,
          },
        ],
        discountPrograms: [
          {
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/bonusprogram/65b3c335-dd5c-11ef-0a80-10d4000a19a3`,
              type: 'bonusprogram',
              mediaType: 'application/json',
            },
          },
        ],
      }, { headers });
  
      userStates[chatId].userCode = code;
      return showBonusCard(chatId, code);
    } catch (err) {
      console.error(err.response?.data || err.message);
      await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko‘ring.');
    }
  }
  
  
  
  
});

// Bonus karta (barcode + balans)
async function showBonusCard(chatId, code) {
  try {
    const response = await axios.get(`${MOYSKLAD_API}/entity/counterparty?filter=code=${code}`, { headers });
    const user = response.data.rows[0];
    if (!user) return bot.sendMessage(chatId, '❌ Kontragent topilmadi.');

    const bonus = user.bonusPoints || 0;
    const phone = user.phone;
    const barcodePath = `./barcodes/${code}.png`;
    const barcodeData = `${phone}`;

    if (!fs.existsSync(barcodePath)) {
      if (!fs.existsSync('./barcodes')) fs.mkdirSync('./barcodes');
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeData,
        scale: 4,
        height: 40,
        includetext: true,
        textxalign: 'center',
        textsize: 15,
        backgroundcolor: 'FFFFFF',
        paddingwidth: 20,
        paddingheight: 20
      });
      fs.writeFileSync(barcodePath, png);
    }

    await bot.sendPhoto(chatId, barcodePath, {
      caption: `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Balansni qayta tekshirish', callback_data: 'check_balance' }]
        ]
      }
    });
  } catch (e) {
    console.error(e.response?.data || e.message);
    await bot.sendMessage(chatId, '❌ Kartani olishda xatolik.');
  }
}

// Callback orqali balansni yangilash
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'check_balance') {
    const userCode = userStates[chatId]?.userCode;
    if (!userCode) {
      return bot.sendMessage(chatId, '❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing.');
    }

    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) {
      console.log('Oldingi xabarni o‘chirishda xatolik:', e.message);
    }

    await showBonusCard(chatId, userCode);
  }
});
