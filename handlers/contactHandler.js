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
  { question: "👨‍👩‍👧‍👦 Oilaviy holatingiz:", answer: "" },
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
  { question: "✅ Bu ishda nimalar sizni qoniqtirdi?", answer: "" },
  {
    question: "🧩 Xarakteringiz va qiziqishlaringiz haqida ma’lumot bering:",
    answer: "",
  },
  { question: "🎯 Qanday ko‘nikmalarni puxta o‘zlashtirgansiz?", answer: "" },
  { question: "🏆 Yutuqlaringiz:", answer: "" },
  {
    question:
      "🚀 Qaysi yo‘nalishda ishda yutuqlaringiz bor? (SMM, Kassir, Buxgalteriya, Marketolog, Omborxona xodimi (WMS), Muvaffaqiyatli muhokama (Mushovi)...)",
    answer: "",
  },
  { question: "❓ Nima uchun aynan shu yo‘nalishni tanladingiz?", answer: "" },
  { question: "📝 Shu ishga qanday ma’lumot yozmoqchisiz?", answer: "" },
];

const Fillials = [
  {
    name: "Toshkent",
    address: "Toshkent shahar, Yunusobod tumani, Mustaqillik ko'chasi 1",
    phone: "+998901234567",
    workingHours: "Dushanba-Juma, 09:00-18:00",
  },
  {
    name: "Samarqand",
    address: "Samarqand viloyati, Samarqand shahar, Amir Temur ko'chasi 2",
    phone: "+998901234568",
    workingHours: "Dushanba-Juma, 09:00-18:00",
  },
];

module.exports = (bot, existingUserKeyboard) => {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const state = userStates[chatId];

    if (msg.text === "/start") {
      return;
    }

    if (!userStates[chatId] || Object.keys(userStates[chatId]).length === 0) {
      userStates[chatId] = { step: "get_name" };

      return bot.sendMessage(
        chatId,
        "❗ Siz tizimdan chiqdingiz. Iltimos, ma'lumotlaringizni qayta yuboring.",
        {
          reply_markup: {
            remove_keyboard: true,
          },
        }
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

    if (text === "👤 Profil") {
      const state = userStates[chatId];

      if (!state) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      }

      // Prepare profile info
      const fullName = state.fullName || "Noma'lum";
      const userCode = state.userCode || "Noma'lum";
      const phoneNumber = state.phone || "Noma'lum";

      const applicationStatus =
        state.applicationData?.answers?.length > 0
          ? "✅ To‘ldirilgan"
          : "❌ To‘ldirilmagan";

      const profileText = `
    👤 Profil ma'lumotlari:
    
    📛 F.I.Sh.: ${fullName}
    📞 Telefon: ${phoneNumber}
    🆔 User Code: ${userCode}
    💼 Ishga ariza holati: ${applicationStatus}
      `;

      return bot.sendMessage(chatId, profileText.trim(), {
        reply_markup: {
          keyboard: [["🔙 Back"]],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      });
    }

    if (text === "🏢 Filliallar ro‘yxati") {
      const fillialList = Fillials.map((fillial) => {
        return `🏢 ${fillial.name}\n📍 Manzil: ${fillial.address}\n📞 Telefon: ${fillial.phone}\n⏰ Ish vaqti: ${fillial.workingHours}`;
      }).join("\n\n");
      return bot.sendMessage(chatId, fillialList);
    }

    if (text === "🔙 Back") {
      return bot.sendMessage(
        chatId,
        "🏠 Asosiy menyuga qaytdingiz.",
        existingUserKeyboard
      );
    }

    if (text === "📞 Murojaatlar") {
      userStates[chatId].feedbackMessages = [];
      userStates[chatId].step = "collect_feedback";

      await bot.sendMessage(
        chatId,
        "✍️ Fikringizni matn, ovozli yoki video xabar shaklida yuboring. Tugatganingizdan so'ng 'Send!' tugmasini bosing.",
        {
          reply_markup: {
            keyboard: [["📤 Send!"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );
    }

    if (text === "🎁 Bonuslar") {
      bot.sendMessage(
        chatId,
        "🎁 Bonuslar bo'yicha ma'lumotlar:\n\n1. Har 1000 so'm uchun 1 ball.\n2. 100 ball to'planganda 10% chegirma.\n3. 500 ball to'planganda 50% chegirma.\n4. 1000 ball to'planganda 100% chegirma."
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

      // Confirm to user
      await bot.sendMessage(
        chatId,
        "✅ Arizangiz yuborildi! Biz siz bilan tez orada bog'lanamiz.",
        existingUserKeyboard
      );

      // Clear state
      userStates[chatId].step = null;
      userStates[chatId].applicationData = null;
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

      await bot.sendMessage(
        chatId,
        "📝 Ishga kirish uchun quyidagi ma'lumotlarni to'ldiring:",
        {
          reply_markup: { remove_keyboard: true },
        }
      );

      const firstQuestion = applicationQuestions[0].question;
      await bot.sendMessage(chatId, firstQuestion);

      return;
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

    if (text === "📤 Send!" && state?.step === "collect_feedback") {
      const feedbackMessages = userStates[chatId].feedbackMessages || [];

      if (feedbackMessages.length === 0) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali hech qanday fikr yubormadingiz."
        );
      }

      const channelId = "-1002689337016";

      await bot.sendMessage(channelId, `📝 Yangi murojaat: \nUser: ${chatId}`);

      for (const message of feedbackMessages) {
        if (message.type === "text") {
          await bot.sendMessage(channelId, message.content);
        } else if (message.type === "voice") {
          await bot.sendVoice(channelId, message.fileId);
        } else if (message.type === "video") {
          await bot.sendVideo(channelId, message.fileId);
        } else if (message.type === "video_note") {
          await bot.sendVideoNote(channelId, message.fileId);
        }
      }

      await bot.sendMessage(
        chatId,
        "✅ Murojaatingiz yuborildi! Rahmat.",
        existingUserKeyboard
      );

      // Clean up user state
      userStates[chatId].feedbackMessages = [];
      userStates[chatId].step = null;
    }

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

      const created = await moysklad.createCustomer({
        name: fullName,
        phone: searchPhone,
        code,
      });

      await bot.sendMessage(
        chatId,
        "📢 Davom etish uchun kanalga qo'shiling!",
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
    if (state?.step === "collect_feedback" && text !== "📤 Send!") {
      if (msg.text) {
        userStates[chatId].feedbackMessages.push({
          type: "text",
          content: msg.text,
        });
      }

      if (msg.voice) {
        userStates[chatId].feedbackMessages.push({
          type: "voice",
          fileId: msg.voice.file_id,
        });
      }

      if (msg.video) {
        userStates[chatId].feedbackMessages.push({
          type: "video",
          fileId: msg.video.file_id,
        });
      }

      if (msg.video_note) {
        userStates[chatId].feedbackMessages.push({
          type: "video_note",
          fileId: msg.video_note.file_id,
        });
      }

      bot.sendMessage(chatId, "✅ Xabar qabul qilindi. Davom eting.");
    }
    if (state?.step === "job_application" && text !== "📤 Apply Application") {
      const currentIndex = state.applicationData.currentQuestionIndex;
      userStates[chatId].applicationData.answers[currentIndex] = text;

      const nextIndex = currentIndex + 1;

      if (nextIndex < applicationQuestions.length) {
        // Move to next question
        userStates[chatId].applicationData.currentQuestionIndex = nextIndex;
        const nextQuestion = applicationQuestions[nextIndex].question;
        return bot.sendMessage(chatId, nextQuestion);
      } else {
        // All questions answered
        await bot.sendMessage(
          chatId,
          "✅ Barcha savollarga javob berdingiz! Arizani yuborish uchun '📤 Apply Application' tugmasini bosing.",
          {
            reply_markup: {
              keyboard: [["📤 Apply Application"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          }
        );
      }
    }

    // Verification of channel subscription
  });
};
