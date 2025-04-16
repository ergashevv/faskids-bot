// birthdayPush.js
const cron  = require('node-cron');
const dayjs = require('dayjs');
require('dayjs/locale/uz');
dayjs.locale('uz');

const axios     = require('axios');
const { MOYSKLAD_TOKEN } = process.env;

/** bonus kiritish */
async function addBirthdayBonus(agentHref, bonusValue = 1000) {
  try {
    await axios.post(
      'https://api.moysklad.ru/api/remap/1.2/entity/bonustransaction',
      {
        transactionType: 'EARNING',
        bonusValue,
        agent: { meta: { href: agentHref, type: 'counterparty', mediaType: 'application/json' } },
        description: `Tug‘ilgan kun bonusi: +${bonusValue}`
      },
      {
        headers: {
          Authorization: `Bearer ${MOYSKLAD_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`Bonus +${bonusValue} yuborildi ${agentHref}`);
  } catch (err) {
    console.error('Bonus jo‘natishda xato:', err.response?.data || err.message);
  }
}

/** tabrik xabari */
function sendBirthdayMessage(bot, chatId, fullName = '', bonusAmount = 1000) {
  const text =
`🎉 <b>FAS kids</b> jamoasi sizni muborakbod etadi, ${fullName || 'qadrli do‘stimiz'}!  
🛍️ Bugun biz hisobingizga <b>+${bonusAmount} bonus</b> qoshdik.  
🎁 Do‘konimizga keling, sovg‘angizni oling va bayram kayfiyatini oshiring!  

Sog‘-salomat bo‘ling! 😊`;
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

/**
 * initBirthdayPush
 *   bot            – TelegramBot instance
 *   UserModel      – mongoose modeli
 *   moyskladService– sizning services/moysklad.js
 *   options        – { defaultTime, testTime, bonusAmount }
 */
function initBirthdayPush(bot, UserModel, moyskladService, options = {}) {
  const defaultTime = options.defaultTime || '09:00';
  const testTime    = options.testTime    || null;
  const bonusAmount = options.bonusAmount || 1000;
  const timezone    = process.env.TZ || 'UTC';

  // cron uchun soat:daqiqa ni ajratamiz
  const [h, m] = (testTime || defaultTime).split(':').map(Number);

  async function runCheck() {
    try {
      const today = dayjs().format('DD-MM');        // masalan "17-04"
      const regex = new RegExp(`^${today}`);
      const users = await UserModel.find(
        { birthday: { $regex: regex } },
        { chatId:1, userCode:1, fullName:1 }
      ).lean();
      if (!users.length) return;
      for (const u of users) {
        // 1) Tabrik
        await sendBirthdayMessage(bot, u.chatId, u.fullName, bonusAmount);
        // 2) Bonus
        const customer = await moyskladService.findCustomerByCode(u.userCode);
        if (customer?.meta?.href) {
          await addBirthdayBonus(customer.meta.href, bonusAmount);
        } else {
          console.warn(`Agent topilmadi: ${u.userCode}`);
        }
      }
    } catch (err) {
      console.error('Birthday‑push xato:', err);
    }
  }

  // — PROD: kuniga bir marta, belgilangan soat:daqiqada
  cron.schedule(
    `${m} ${h} * * *`,   // daqiqa soat * * *
    runCheck,
    { timezone }
  );

  // — TEST: agar NODE_ENV=test bo‘lsa, har 5 daqiqada
  if (process.env.NODE_ENV === 'test') {
    cron.schedule(
      '*/5 * * * *',
      runCheck,
      { timezone }
    );
  }
}

module.exports = { initBirthdayPush };
