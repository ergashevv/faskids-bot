/** @format */
const { v4: uuidv4 } = require("uuid");
const moysklad = require("../services/moysklad");
const userStates = require("../userStates");
const showBonusCard = require("../components/showBonusCard");

const applicationQuestions = [
  { question: "📝 Avtobiografiya (F.I.Sh.):", answer: "" },
  { question: "🎂 Tug‘ilgan sana:", answer: "" },
  { question: "📍 Yashash manzilingiz:", answer: "" },
  { question: "📞 Telefon raqamingiz:", answer: "" },
  { question: "🌐 Qanday xorijiy tillarni bilasiz? : ", answer: "" },
  { question: "💻 Qanday kompyuter dasturlarini bilasiz?: ", answer: "" },
  { question: "👪 Oilangiz haqida ma’lumot bering:", answer: "" },
  { question: "🏢 Oxirgi ish joyingiz? :", answer: "" },
  { question: "❓ Nima uchun oldingi ish joyingizdan bo‘shagansiz?: ", answer: "" },
  { question: "💼 Nima uchun bu ish sizni qiziqtirmoqda? : ", answer: "" },
  { question: "📢 Ish haqi haqida qayerdan bilib oldingiz? (OLX, Telegram, internetda, do‘stlaringiz, shu yerda ishlaganlar...) : ", answer: "" },
  { question: "🧩 Xarakteringiz va qiziqishlaringiz haqida ma’lumot bering:", answer: "" },
  { question: "🎯 Qanday kitoblarni mutolaa qilgansiz?:", answer: "" },
  { question: "🏆 Yutuqlaringiz:", answer: "" },
  { question: "🚀 Qaysi yo'nalishda ishlamoqchisiz? (Konsultat, Kassir, SMM, Marketolog, Moliyachi, Omborxona xodimi (WMS): ", answer: "" },
  { question: "Nima uchun bu yo'nalishni tanladingiz. Shu haqida qisqacha ma'lumot yozing : ", answer: "" },
  { question: "Qaysi smenada ishlamoqchisiz. 1) 09:00 - 17:30  2) 14:45 - 23:00 :", answer: "" },
];

module.exports = (bot, existingUserKeyboard) => {
  // Bitta yagona message handler
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    // Agar userStates[chatId] mavjud bo'lmasa, yarating:
    if (!userStates[chatId]) {
      userStates[chatId] = {};
    }
    const state = userStates[chatId];

    // 1) Global "Ortga" tugmasi:
    if (text === "🔙 Ortga") {
      state.step = "main_menu";
      state.applicationData = null;
      state.feedbackMessages = [];
      return bot.sendMessage(chatId, "Asosiy menyu:", existingUserKeyboard);
    }

    // 2) "📲 Mening jamg‘arma kartam"
    if (text === "📲 Jamg‘arma kartasi") {
      const userCode = state.userCode;
      if (!userCode)
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      return showBonusCard(bot, chatId, userCode);
    }

    // 3) "🏢 Filliallar ro‘yxati" – inline keyboard yaratish:
    if (text === "🏢 Filliallar ro‘yxati") {
      const inlineKeyboard = {
        inline_keyboard: [
          [{ text: "Faskids Minor", callback_data: "branch_minor" }],
          [{ text: "Faskids Kitoblar Olami", callback_data: "branch_kitoblar" }],
        ],
      };
      return bot.sendMessage(chatId, "Qaysi filialni tanlaysiz?", {
        reply_markup: inlineKeyboard,
      });
    }

    // 4) "📞 Talab va taklif"
    if (text === "📞 Talab va taklif") {
      state.feedbackMessages = [];
      state.step = "collect_feedback";
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

    // 5) Feedback branch
    if (state.step === "collect_feedback") {
      const channelId = "-1002689337016";
      const username = msg.from.username
        ? `@${msg.from.username}`
        : "(username yo'q)";
      const firstName = msg.from.first_name || "(ismi yo'q)";
      const lastName = msg.from.last_name || "";
      const fullName = state.fullName || "(Ro'yxatdagi ism yo'q)";
      const phone = state.phone || "(Telefon yo'q)";
      const userMessage = text || "(Matnli xabar yo'q)";

      const feedbackText =
        `📝 Yangi murojaat:\n` +
        `👤 <b>Foydalanuvchi:</b> ${fullName}\n` +
        `💡 <b>Username:</b> ${username}\n` +
        `📱 <b>Telefon:</b> ${phone}\n` +
        `👀 <b>Telegram First Name:</b> ${firstName}\n` +
        (lastName ? `👀 <b>Telegram Last Name:</b> ${lastName}\n` : "") +
        `\n<b>Xabar:</b> ${userMessage}`;

      await bot.sendMessage(channelId, feedbackText, { parse_mode: "HTML" });

      if (msg.voice) await bot.sendVoice(channelId, msg.voice.file_id);
      if (msg.video) await bot.sendVideo(channelId, msg.video.file_id);
      if (msg.video_note) await bot.sendVideoNote(channelId, msg.video_note.file_id);

      state.step = "main_menu";
      return bot.sendMessage(chatId, "✅ Xabar qabul qilindi. Davom eting");
    }

    // 6) "🎁 Bonuslar"
    if (text === "🎁 Bonuslar") {
      return bot.sendMessage(
        chatId,
        "🎁 Bonuslar bo'yicha ma'lumotlar:\n\n1. Har 1000 so'm uchun 1 ball.\n2. 100 ball to'planganda 10% chegirma.\n3. 500 ball to'planganda 50% chegirma.\n4. 1000 ball to'planganda 100% chegirma.",
        { reply_markup: existingUserKeyboard.reply_markup }
      );
    }

    // 7) "💼 Ishga kirish" – ishga kirish jarayonini boshlash:
    if (text === "💼 Ishga kirish") {
      state.step = "job_application";
      state.applicationData = { currentQuestionIndex: 0, answers: [] };
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
      return bot.sendMessage(chatId, applicationQuestions[0].question);
    }

    // 8) Job Application branch: agar foydalanuvchi javob yuborsa
    if (state.step === "job_application") {
      if (text === "📤 Arizani yuborish") {
        const channelId = "-1002410783063";
        let applicationText = "📝 Yangi ishga kirish arizasi:\n\n";
        state.applicationData.answers.forEach((answer, index) => {
          applicationText += `${applicationQuestions[index].question} ${answer}\n`;
        });
        await bot.sendMessage(channelId, applicationText);
        await bot.sendMessage(
          chatId,
          "✅ Arizangiz yuborildi! Biz siz bilan tez orada bog'lanamiz.",
          existingUserKeyboard
        );
        state.step = "main_menu";
        state.applicationData = null;
        return;
      }

      // Foydalanuvchining javobini saqlaymiz va keyingi savolga o‘tamiz:
      const currentIndex = state.applicationData.currentQuestionIndex;
      state.applicationData.answers[currentIndex] = text;
      const nextIndex = currentIndex + 1;
      if (nextIndex < applicationQuestions.length) {
        state.applicationData.currentQuestionIndex = nextIndex;
        return bot.sendMessage(chatId, applicationQuestions[nextIndex].question);
      } else {
        await bot.sendMessage(
          chatId,
          "✅ Barcha savollarga javob berdingiz! '📤 Arizani yuborish' tugmasini bosing.",
          {
            reply_markup: {
              keyboard: [["📤 Arizani yuborish"], ["🔙 Ortga"]],
              resize_keyboard: true,
            },
          }
        );
        return;
      }
    }

    // 9) "get_name" bosqichi:
    if (state.step === "get_name") {
      state.fullName = text;
      state.step = "get_phone";
      return bot.sendMessage(
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
    }

    // 10) "get_phone" bosqichi:
    if (msg.contact && state.step === "get_phone") {
      const rawPhone = msg.contact.phone_number;
      const fullName = state.fullName?.trim() || "(Ism yo'q)";
      const code = `TG-${uuidv4().slice(0, 8)}`;
      const normalizedPhone = rawPhone.replace(/\D/g, "").replace(/^998/, "");
      const searchPhone = `998${normalizedPhone}`;
      state.step = "verify_channel";

      await moysklad.createCustomer({
        name: fullName,
        phone: searchPhone,
        code,
      });
      state.userCode = code;
      state.phone = rawPhone;
      state.fullName = fullName;
      const requiredChannelUsername = "faskids";
      return bot.sendMessage(
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
    }
  });

  // Mustaqil callback query handler:
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "branch_minor") {
      await bot.sendPhoto(
        chatId,
        "https://www.spot.uz/media/img/2020/12/3Z3MRs16070828252775_b.jpg",
        {
          caption: `<b>6-kichik nohiya, "Chinar Mall"dagi fillialimiz.</b>\n\n` +
                   `<b>Manzil:</b> "Chinar Mall" savdo majmuasi, 6-kichik nohiya\n` +
                   `<b>Ish vaqti:</b> 10:00-23:00\n\n` +
                   `<b>Telefon:</b> +998906376007\n` +
                   `<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n` +
                   `<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
          parse_mode: "HTML"
        }
      );
      return bot.answerCallbackQuery(query.id);
    }

    if (data === "branch_kitoblar") {
      await bot.sendPhoto(
        chatId,
        "https://avatars.mds.yandex.net/get-altay/4435487/2a0000017925b1a260c491fe511a4221a666/L_height",
        {
          caption: `<b>Buxoro kitoblar olami, 1-qavat, Zarafshon mehmonxonasi ro'parasida.</b>\n\n` +
                   `<b>Manzil:</b> Buxoro kitoblar olami\n` +
                   `<b>Ish vaqti:</b> 09:00-22:00\n\n` +
                   `<b>Telefon:</b> +998906376007\n` +
                   `<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n` +
                   `<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
          parse_mode: "HTML"
        }
      );
      return bot.answerCallbackQuery(query.id);
    }
  });
};
