/** @format */
const { v4: uuidv4 } = require("uuid");
const moysklad = require("../services/moysklad");
const userStates = require("../userStates");
const showBonusCard = require("../components/showBonusCard");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda...`);
});

// Administratorlar ro'yxati (Telegram user ID-lari)
const adminIds = [5737309471]; // o'zingizga mos admin ID-larni qo'ying

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
  { question: "❓ Nima uchun oldingi ish joyingizdan bo‘shagansiz?", answer: "" },
  { question: "💼 Nima uchun bu ish sizni qiziqtirmoqda?", answer: "" },
  { question:
      "📢 Ish haqi haqida qayerdan bilib oldingiz? (OLX, Telegram, internetda, do‘stlaringiz, shu yerda ishlaganlar...)",
    answer: "",
  },
  { question: "✅ Bu ishda nimalar sizni qoniqtirdi?", answer: "" },
  { question: "🧩 Xarakteringiz va qiziqishlaringiz haqida ma’lumot bering:", answer: "" },
  { question: "🎯 Qanday ko‘nikmalarni puxta o‘zlashtirgansiz?", answer: "" },
  { question: "🏆 Yutuqlaringiz:", answer: "" },
  { question:
      "🚀 Qaysi yo‘nalishda ishda yutuqlaringiz bor? (SMM, Kassir, Buxgalteriya, Marketolog, Omborxona xodimi (WMS), Muvaffaqiyatli muhokama (Mushovi)...)",
    answer: "",
  },
  { question: "❓ Nima uchun aynan shu yo‘nalishni tanladingiz?", answer: "" },
  { question: "📝 Shu ishga qanday ma’lumot yozmoqchisiz?", answer: "" },
];

module.exports = (bot, existingUserKeyboard) => {
  // Bitta yagona message handler
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    // In-memory state mavjudligini ta'minlaymiz:
    if (!userStates[chatId]) {
      userStates[chatId] = {};
    }
    const state = userStates[chatId];

    // --- /start Komandasi ---
    // Bizning yechim: Agar foydalanuvchi allaqachon ro'yxatdan o'tgan bo'lsa,
    // ya'ni, userStates[chatId].userCode mavjud, yoki Moyskladda shunday mijoz mavjud bo'lsa,
    // unda /start bosilganda ro'yxatdan o'tish jarayoni qayta ishga tushmasdan, asosiy menyuga o'tilsin.
    // Agar in-memory state mavjud bo'lmasa yoki userCode yo'q bo'lsa, yangi ro'yxat boshlansin.
    if (text === "/start") {
      // Birinchi: Agar in-memory state da userCode mavjud bo'lsa, demak foydalanuvchi ro'yxatdan o'tgan
      if (state.userCode) {
        return bot.sendMessage(
          chatId,
          "Salom, siz allaqachon ro'yxatdan o'tgansiz. Kerakli bo'limni tanlang:",
          existingUserKeyboard
        );
      }
      // Ikkinchi: Agar in-memory state yo'q yoki userCode mavjud emas, lekin foydalanuvchi oldingi registratsiyasini Moyskladda aniqlash mumkin
      // Agar foydalanuvchi rostan ham ro'yxatdan o'tgan bo'lsa, uni telefon raqami orqali tekshirishingiz mumkin,
      // lekin telefon raqami (va ism) avval yuborilgan bo'lishi kerak.
      // Agar bu ma'lumotlar mavjud bo'lmasa, yangi ro'yxatdan o'tish jarayonini boshlaymiz.
      if (!state.phone || !state.fullName) {
        // Yangi ro'yxatdan o'tish
        state.step = "get_name";
        return bot.sendMessage(
          chatId,
          "Xush kelibsiz! Iltimos, ismingiz va familiyangizni yuboring.",
          { reply_markup: { remove_keyboard: true } }
        );
      } else {
        // Telefon va ism mavjud bo'lsa, Moyskladdan tekshiramiz
        try {
          const normalizedPhone = state.phone.replace(/\D/g, "").replace(/^998/, "");
          const searchPhone = `998${normalizedPhone}`;
          const existingCustomers = await moysklad.findCustomerByPhone(searchPhone);
          if (existingCustomers && existingCustomers.length > 0) {
            const customer = existingCustomers.find(
              (cust) =>
                cust.name.toLowerCase() === state.fullName.toLowerCase()
            );
            if (customer) {
              // Agar mavjud mijoz topilsa, in-memory state ga yangilash
              state.userCode = customer.code;
              state.step = "verify_channel";
              return bot.sendMessage(
                chatId,
                "Salom, siz allaqachon ro'yxatdan o'tgansiz. Kerakli bo'limni tanlang:",
                existingUserKeyboard
              );
            }
          }
        } catch (error) {
          console.error("Moysklad aniqlash xatosi:", error);
          // Xato bo'lsa, yangi ro'yxatdan o'tish jarayonini boshlaymiz
        }
        // Agar yuqoridagi tekshiruvdan o'tmasa, yangi ro'yxatdan o'tishni boshlaymiz
        state.step = "get_name";
        return bot.sendMessage(
          chatId,
          "Xush kelibsiz! Iltimos, ismingiz va familiyangizni yuboring.",
          { reply_markup: { remove_keyboard: true } }
        );
      }
    }
    // --- /start Tugadi ---

    // Global "Ortga" tugmasi:
    if (text === "🔙 Ortga") {
      state.step = "main_menu";
      state.applicationData = null;
      state.feedbackMessages = [];
      return bot.sendMessage(chatId, "Asosiy menyu:", existingUserKeyboard);
    }

    // "📲 Mening jamg‘arma kartam"
    if (text === "📲 Jamg‘arma kartasi") {
      if (!state.userCode) {
        return bot.sendMessage(
          chatId,
          "❗ Siz hali ro'yxatdan o'tmagansiz. /start buyrug'ini bosing."
        );
      }
      return showBonusCard(bot, chatId, state.userCode);
    }
    if (text === "📞 Aloqa") {
      if (!state.userCode) {
        return bot.sendMessage(
          chatId,
          "❗ Siz ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosib ro'yxatdan o'ting."
        );
      } else {
        return bot.sendMessage(chatId, "+998507266007");
      }
    }

    // "🏢 Filliallar ro'yxati"
    if (text === "🏢 Filliallar ro‘yxati") {
      const inlineKeyboard = {
        inline_keyboard: [
          [{ text: "FAS kids Minor", callback_data: "branch_minor" }],
          [{ text: "FAS kids Kitoblar Olami", callback_data: "branch_kitoblar" }],
        ],
      };
      return bot.sendMessage(chatId, "Qaysi filialni tanlaysiz?", {
        reply_markup: inlineKeyboard,
      });
    }

    // "📝 Talab va taklif"
    if (text === "📝 Talab va taklif") {
      state.feedbackMessages = [];
      state.step = "collect_feedback";
      return bot.sendMessage(
        chatId,
        "✍️ Fikringizni matn, ovozli yoki video xabar shaklida yuboring. (Rasm ham yuborishingiz mumkin.)",
        {
          reply_markup: {
            keyboard: [["🔙 Ortga"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );
    }

    // Feedback branch
    if (state.step === "collect_feedback") {
      if (text === "🔙 Ortga") {
        state.step = "main_menu";
        return bot.sendMessage(chatId, "Asosiy menyu:", existingUserKeyboard);
      }

      const channelId = "-1002689337016"; // o'z kanal IDingiz
      const username = msg.from.username ? `@${msg.from.username}` : "(username yo'q)";
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

      if (msg.photo && msg.photo.length > 0) {
        const photoFileId = msg.photo[msg.photo.length - 1].file_id;
        await bot.sendPhoto(channelId, photoFileId);
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

      return bot.sendMessage(chatId, "✅ Xabar qabul qilindi. Yana fikringiz bormi?");
    }

    // "🎁 Bonuslar"
    if (text === "🎁 Bonuslar") {
      return bot.sendMessage(
        chatId,
        "🎁 Bonuslar bo'yicha ma'lumotlar:\n\n1. Har 1000 so'm uchun 1 ball.\n2. 100 ball to'planganda 10% chegirma.\n3. 500 ball to'planganda 50% chegirma.\n4. 1000 ball to'planganda 100% chegirma.",
        { reply_markup: existingUserKeyboard.reply_markup }
      );
    }

    if (text === "💼 Ishga kirish") {
      return bot.sendMessage(
        chatId,
        "Ishga kirish uchun quyidagi botga o‘ting va arizani to‘ldiring:\n👉 https://t.me/faskidsjob_bot \n\n☎️ Qo‘shimcha ma’lumot uchun @faskidsuz_admin bilan bog‘laning.",
        {
          reply_markup: {
            keyboard: [["🔙 Ortga"]],
            resize_keyboard: true,
          },
        }
      );
    }

    // "get_name" bosqichi:
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

    // "get_phone" bosqichi: (O'zgartirishlar shu yerda)
    if (msg.contact && state.step === "get_phone") {
      const rawPhone = msg.contact.phone_number;
      const fullName = state.fullName?.trim() || "(Ism yo'q)";
      const normalizedPhone = rawPhone.replace(/\D/g, "").replace(/^998/, "");
      const searchPhone = `998${normalizedPhone}`;

      let customer;
      try {
        const existingCustomers = await moysklad.findCustomerByPhone(searchPhone);
        if (existingCustomers && existingCustomers.length > 0) {
          customer = existingCustomers.find(
            (cust) => cust.name.toLowerCase() === fullName.toLowerCase()
          );
          if (!customer) {
            return bot.sendMessage(
              chatId,
              "❗ Ushbu telefon raqam boshqa ism/familiyaga bog'langan. Iltimos, boshqa telefon raqamini kiriting yoki ro'yxatdan o'tgan bo'lsangiz /start buyrug'ini bosing."
            );
          }
        }
      } catch (error) {
        console.error("Moysklad qidiruv xatosi:", error);
        return bot.sendMessage(chatId, "❗ Telefon raqamini tekshirishda xatolik yuz berdi. Qayta urinib ko'ring.");
      }

      if (!customer) {
        // Agar bazada shu telefon raqami topilmasa, yangi mijoz yaratamiz
        const code = `TG-${uuidv4().slice(0, 8)}`;
        try {
          await moysklad.createCustomer({
            name: fullName,
            phone: searchPhone,
            code,
          });
          
        } catch (error) {
          console.error("Yangi mijoz yaratishda xato:", error);
          return bot.sendMessage(chatId, "❗ Mijozni yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
      }

      state.step = "verify_channel";
      state.userCode = customer.code;
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

  // Callback query handler:
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "branch_minor") {
      await bot.sendPhoto(
        chatId,
        "https://www.spot.uz/media/img/2020/12/3Z3MRs16070828252775_b.jpg",
        {
          caption: `<b>"Minor Mall"dagi fillialimiz.</b>\n\n` +
            `<b>Manzil:</b> Bolalar kasalxonasi ro'parasidagi "Minor mall" 2-qavat\n` +
            `<b>Ish vaqti:</b> 09:30-23:00\n\n` +
            `<b>Telefon:</b> +998906376007\n` +
            `<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n` +
            `<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
          parse_mode: "HTML"
        }
      );
      const minorLatitude = 39.780488;
      const minorLongitude = 64.430688;
      await bot.sendLocation(chatId, minorLatitude, minorLongitude);
      return bot.answerCallbackQuery(query.id);
    }
    
    if (data === "branch_kitoblar") {
      await bot.sendPhoto(
        chatId,
        "./images/image.jpg",
        {
          caption: `<b>Zarafshon mehmonxonasi ro'parasidagi Buxoro kitoblar olamining 1-qavatida.</b>\n\n` +
            `<b>Manzil:</b> Alisher Navoi Avenue, 5\n` +
            `<b>Ish vaqti:</b> 09:00-22:00\n\n` +
            `<b>Telefon:</b> +998906376007\n` +
            `<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n` +
            `<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
          parse_mode: "HTML"
        }
      );
      const kitoblarLatitude = 39.763188;
      const kitoblarLongitude = 64.425435;
      await bot.sendLocation(chatId, kitoblarLatitude, kitoblarLongitude);
      return bot.answerCallbackQuery(query.id);
    }
  });

  // --- Yangi: Dynamic broadcast / reklama xabarini yuborish --- //

  // Faqat administratorlarga mo'ljallangan
  // Masalan, admin botga "/broadcast <message_id>" deb yozganda
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (text && text.startsWith("/broadcast")) {
      if (!adminIds.includes(msg.from.id)) {
        return bot.sendMessage(chatId, "Sizga bu buyruqni bajarish uchun ruxsat yo'q.");
      }

      const parts = text.split(" ");
      if (parts.length < 2) {
        return bot.sendMessage(chatId, "Iltimos, '/broadcast <message_id>' formatida yuboring.");
      }
      const channelMessageId = parseInt(parts[1], 10);
      if (isNaN(channelMessageId)) {
        return bot.sendMessage(chatId, "Xato: message_id son ko‘rinishida bo‘lishi kerak.");
      }

      const channelChatId = process.env.REKLAMA_CHANNEL_CHAT_ID || "-1001316855543";
      const allUserChatIds = Object.keys(userStates);

      allUserChatIds.forEach((userChatId) => {
        bot.forwardMessage(userChatId, channelChatId, channelMessageId)
          .catch((error) => {
            console.error(`Xabar yuborishda xatolik (user: ${userChatId}):`, error);
          });
      });

      return bot.sendMessage(chatId, "Reklama xabari barcha foydalanuvchilarga yuborildi.");
    }
  });
};
