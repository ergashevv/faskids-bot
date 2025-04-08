/** @format */

// handlers/contactHandler.js
const { v4: uuidv4 } = require("uuid");
const moysklad = require("../services/moysklad");
const userStates = require("../userStates");
const showBonusCard = require("../components/showBonusCard");

const applicationQuestions = [
  { question: "📝 Avtobiografiya (F.I.Sh.):", answer: "" },
  { question: "🎂 Tug‘ilgan sana:", answer: "" },
  { question: "📍 Yashash manzilingiz:", answer: "" },
  { question: "📞 Telefon raqamingiz:", answer: "" },
  { question: "🌐 Qanday xorijiy tillarni bilasiz?", answer: "" },
  { question: "💻 Qanday kompyuter dasturlarini bilasiz?", answer: "" },
  { question: "👪 Oilangiz haqida ma’lumot bering:", answer: "" },
  { question: "🏢 Oxirgi ish joyingiz?", answer: "" },
  {
    question: "❓ Nima uchun oldingi ish joyingizdan bo‘shagansiz?",
    answer: "",
  },
  { question: "💼 Nima uchun bu ish sizni qiziqtirmoqda?", answer: "" },
  {
    question:
      "📢 Ish haqi haqida qayerdan bilib oldingiz? (OLX, Telegram, internetda, do‘stlaringiz, shu yerda ishlaganlar...)",
    answer: "",
  },
  {
    question: "🧩 Xarakteringiz va qiziqishlaringiz haqida ma’lumot bering:",
    answer: "",
  },
  { question: "🎯 Qanday kitoblarni mutolaa qilgansiz?", answer: "" },
  { question: "🏆 Yutuqlaringiz:", answer: "" },
  {
    question:
      "🚀 Qaysi yo'nalishda ishlamoqchisiz? (Konsultat, Kassir, SMM, Marketolog, Moliyachi, Omborxona xodimi (WMS)",
    answer: "",
  },
  {
    question:
      "Nima uchun bu yo'nalishni tanladingiz. Shu haqida qisqacha ma'lumot yozing",
    answer: "",
  },
  {
    question:
      "Qaysi smenada ishlamoqchisiz. 1) 09:00 - 17:30  2) 14:45 - 23:00",
    answer: "",
  }
];

const Fillials = [
  {
    name: "Buxoro",
    address: "Buxoro kitoblar olami, 1-qavat. Zarafshon mehmonxonasi ro'parasida",
    phone: "+998906376007",
    workingHours: "Dushanba-Juma, 09:00-22:00",
  },
  {
    name: "Buxoro",
    address: "Minor mall 2-qavat bolalar kasalxonasi ro'parasida",
    phone: "+998906376007",
    workingHours: "Dushanba-Juma, 09:30-23:00",
  },
];

module.exports = (bot, existingUserKeyboard) => {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const state = userStates[chatId];

    // Global "Ortga" tugmasi tekshiruvini qo'shamiz:
    if (text === "🔙 Ortga") {
      // Agar kerakli jarayonlar bo'lsa – ularni tozalaymiz.
      userStates[chatId].step = "main_menu";
      userStates[chatId].applicationData = null;
      userStates[chatId].feedbackMessages = [];
      return bot.sendMessage(chatId, "Asosiy menyu:", existingUserKeyboard);
    }
    // "📞 Talab va taklif" bo'limi: Foydalanuvchi ushbu tugmani bosganda, 
    // holat feedback yig'ish uchun o'rnatiladi va kerakli javob klaviaturasi ko'rsatiladi.
    if (text === "📞 Talab va taklif") {
      userStates[chatId].feedbackMessages = [];
      userStates[chatId].step = "collect_feedback";

      return bot.sendMessage(
        chatId,
        "✍️ Fikringizni matn, ovozli yoki video xabar shaklida yuboring.",
        {
          reply_markup: {
            keyboard: [["🔙 Ortga"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );
    }


    // Agar foydalanuvchi tizimdan chiqib ketsa yoki state bo'sh bo'lsa
    if (!userStates[chatId] || Object.keys(userStates[chatId]).length === 0) {
      userStates[chatId] = { step: "get_name" };

      return bot.sendMessage(
        chatId,
        "❗ Siz tizimdan chiqdingiz. Iltimos, ma'lumotlaringizni qayta yuboring.",
        { reply_markup: { remove_keyboard: true } }
      );
    }

    if (text === "📲 Mening jamg‘arma kartam") {
      const userCode = userStates[chatId]?.userCode;
      if (!userCode)
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      return showBonusCard(bot, chatId, userCode);
    }

    if (text === "🏢 Filliallar ro‘yxati") {
      const fillialList = Fillials.map((fillial) => {
        return `🏢 ${fillial.name}\n📍 Manzil: ${fillial.address}\n📞 Telefon: ${fillial.phone}\n⏰ Ish vaqti: ${fillial.workingHours}`;
      }).join("\n\n");
      return bot.sendMessage(chatId, fillialList, {
        reply_markup: existingUserKeyboard.reply_markup,
      });
    }

    // TALAB VA TAKLIF: Endi foydalanuvchi xabari yuborilganda, uni srazu kanalga jo‘natamiz.
    if (state?.step === "collect_feedback" && text !== "🔙 Ortga") {
      const channelId = "-1002689337016";
      // Kanalda kimdan xabar kelgani haqida ma'lumot beramiz.
      await bot.sendMessage(channelId, `📝 Yangi murojaat:\nUser: ${chatId}`);

      if (msg.text) {
        await bot.sendMessage(channelId, msg.text);
      }
      if (msg.voice) {
        await bot.sendVoice(channelId, msg.voice.file_id);
      }
      if (msg.video) {
        await bot.sendVideo(channelId, msg.video.file_id);
      }
      if (msg.video_note) {
        await bot.sendVideoNote(channelId, msg.video_note.file_id);
      }
      return bot.sendMessage(
        chatId,
        "✅ Xabar qabul qilindi. Davom eting"
      );
      
    }

    if (text === "🎁 Bonuslar") {
      return bot.sendMessage(
        chatId,
        "🎁 Bonuslar bo'yicha ma'lumotlar:\n\n1. Har 1000 so'm uchun 1 ball.\n2. 100 ball to'planganda 10% chegirma.\n3. 500 ball to'planganda 50% chegirma.\n4. 1000 ball to'planganda 100% chegirma.",
        { reply_markup: existingUserKeyboard.reply_markup }
      );
    }

    if (text === "📤 Apply Application" && state?.step === "job_application") {
      const applicationAnswers = state.applicationData.answers;
      const channelId = "-1002410783063";

      let applicationText = "📝 Yangi ishga kirish arizasi:\n\n";
      applicationQuestions.forEach((q, index) => {
        applicationText += `${q.question} ${applicationAnswers[index]}\n`;
      });

      await bot.sendMessage(channelId, applicationText);

      // Foydalanuvchiga tasdiq xabari yuboramiz
      await bot.sendMessage(
        chatId,
        "✅ Arizangiz yuborildi! Biz siz bilan tez orada bog'lanamiz.",
        existingUserKeyboard
      );

      // State tozalash
      userStates[chatId].step = "main_menu";
      userStates[chatId].applicationData = null;
      return;
    }

    if (text === "💼 Ishga kirish") {
      if (!userStates[chatId]) {
        userStates[chatId] = {};
      }
      userStates[chatId].step = "job_application";
      userStates[chatId].applicationData = {
        currentQuestionIndex: 0,
        answers: [],
      };

      // Foydalanuvchiga "🔙 Ortga" tugmasi bilan javob klaviaturasini ko'rsatamiz.
      await bot.sendMessage(
        chatId,
        "📝 Ishga kirish uchun quyidagi ma'lumotlarni to'ldiring:",
        {
          reply_markup: {
            keyboard: [["🔙 Ortga"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );
      const firstQuestion = applicationQuestions[0].question;
      return bot.sendMessage(chatId, firstQuestion);
    }

    if (text === "📲 Jamg‘arma kartasi") {
      const userCode = userStates[chatId]?.userCode;
      if (!userCode)
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      return showBonusCard(bot, chatId, userCode);
    }

    // Foydalanuvchi "get_name" bosqichida bo'lsa:
    if (state?.step === "get_name") {
      userStates[chatId].fullName = text;
      userStates[chatId].step = "get_phone";

      await bot.sendMessage(
        chatId,
        "📞 Endi telefon raqamingizni yuboring (masalan: +998901234567):",
        {
          reply_markup: {
            keyboard: [
              [{ text: "📱 Telefon raqamni yuborish", request_contact: true }],
              ["🔙 Ortga"],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    } else if (msg.contact && state?.step === "get_phone") {
      const rawPhone = msg.contact.phone_number;
      const fullName = state.fullName.trim();
      const code = `TG-${uuidv4().slice(0, 8)}`;
      const normalizedPhone = rawPhone.replace(/\D/g, "").replace(/^998/, "");
      const searchPhone = `998${normalizedPhone}`;

      const requiredChannelUsername = "faskids";
      userStates[chatId].step = "verify_channel";

      await moysklad.createCustomer({
        name: fullName,
        phone: searchPhone,
        code,
      });

      await bot.sendMessage(
        chatId,  "📢 Davom etish uchun kanalga qo'shiling!",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📲 Kanalga qo'shilish",
                  url: `https://t.me/${requiredChannelUsername}`,
                },
              ],
              [{ text: "✅ Tekshirish", callback_data: "check_subscription" }],
            ],
          },
        }
      );
      userStates[chatId].userCode = code;
      userStates[chatId].phone = rawPhone;
      userStates[chatId].name = fullName;
      return;
    }

    // JO'NATILMAGAN QOLGAN HOLATLAR (masalan: job_application qismi)
    if (state?.step === "job_application" && text !== "📤 Arizani yuborish") {
      const currentIndex = state.applicationData.currentQuestionIndex;
      userStates[chatId].applicationData.answers[currentIndex] = text;

      const nextIndex = currentIndex + 1;
      if (nextIndex < applicationQuestions.length) {
        userStates[chatId].applicationData.currentQuestionIndex = nextIndex;
        const nextQuestion = applicationQuestions[nextIndex].question;
        return bot.sendMessage(chatId, nextQuestion);
      } else {
        await bot.sendMessage(
          chatId,
          "✅ Barcha savollarga javob berdingiz! Arizani yuborish uchun '📤 Arizani yuborish' tugmasini bosing.)",
          {
            reply_markup: {
              keyboard: [["📤 Apply Application"], ["🔙 Ortga"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          }
        );
      }
    }

    // Qo'shimcha: Kanalga obuna tekshiruvi va boshqa jarayonlar shu yerda qo'shilishi mumkin...
  });
};
