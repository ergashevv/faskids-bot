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
          "❗ Siz hali ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
        );
      }
      return showBonusCard(bot, chatId, state.userCode);
    }
    if (text === "📞 Aloqa") {
      if (!state.userCode) {
        return bot.sendMessage(chatId, "❗ Siz ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosib ro'yxatdan o'ting.");
      } else {
        return bot.sendMessage(chatId, "+998507266007");
      }
    }


    // "🏢 Filliallar ro‘yxati"
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

    // "📞 Talab va taklif"
    // "📞 Talab va taklif"
    if (text === "📞 Talab va taklif") {
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
      // Agar foydalanuvchi "🔙 Ortga" tugmasini bosmasa, demak feedback davom etadi.
      // Shuning uchun "🔙 Ortga" bosilgandagina asosiy menyuga qaytamiz:
      if (text === "🔙 Ortga") {
        state.step = "main_menu";
        return bot.sendMessage(chatId, "Asosiy menyu:", existingUserKeyboard);
      }

      // Aks holda — foydalanuvchi xoh matn, xoh media yuborsin — kanalingizga forward qilinadi:
      const channelId = "-1002689337016"; // o'z kanal IDingiz
      const username = msg.from.username ? `@${msg.from.username}` : "(username yo'q)";
      const firstName = msg.from.first_name || "(ismi yo'q)";
      const lastName = msg.from.last_name || "";
      const fullName = state.fullName || "(Ro'yxatdagi ism yo'q)";
      const phone = state.phone || "(Telefon yo'q)";
      // msg.text bo'lmasa, userMessage'ga e'tibor berilmaydi. Lekin matn bo'lsa chiqarib yuboriladi:
      const userMessage = text || "(Matnli xabar yo'q)";

      // Kanaldagi matn formati:
      const feedbackText =
        `📝 Yangi murojaat:\n` +
        `👤 <b>Foydalanuvchi:</b> ${fullName}\n` +
        `💡 <b>Username:</b> ${username}\n` +
        `📱 <b>Telefon:</b> ${phone}\n` +
        `👀 <b>Telegram First Name:</b> ${firstName}\n` +
        (lastName ? `👀 <b>Telegram Last Name:</b> ${lastName}\n` : "") +
        `\n<b>Xabar:</b> ${userMessage}`;

      // Avval matn (yoki umumiy info) ni kanalga yuboramiz
      await bot.sendMessage(channelId, feedbackText, { parse_mode: "HTML" });

      // Foydalanuvchi rasm yuborgan bo'lsa:
      if (msg.photo && msg.photo.length > 0) {
        // eng yuqori aniqlikdagi rasmni olamiz (massivning oxirgi elementi)
        const photoFileId = msg.photo[msg.photo.length - 1].file_id;
        // Istasangiz caption qo'yishingiz yoki userMessage ni caption sifatida yuborishingiz mumkin
        await bot.sendPhoto(channelId, photoFileId);
      }

      // Foydalanuvchi ovozli xabar yuborgan bo'lsa:
      if (msg.voice) {
        await bot.sendVoice(channelId, msg.voice.file_id);
      }

      // Foydalanuvchi video yuborgan bo'lsa:
      if (msg.video) {
        await bot.sendVideo(channelId, msg.video.file_id);
      }

      // Foydalanuvchi video note (dumaloq video) yuborgan bo'lsa:
      if (msg.video_note) {
        await bot.sendVideoNote(channelId, msg.video_note.file_id);
      }

      // Ushbu xabardan keyin ham foydalanuvchi feedback rejimida qoladi:
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
      // Biz bu yerda savollarni *shu botda* berish o‘rniga, 
      // foydalanuvchini *boshqa* faskidsjob_bot ga yo‘naltiramiz.
      // Masalan:
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

    // "get_phone" bosqichi:
    if (msg.contact && state.step === "get_phone") {
      const rawPhone = msg.contact.phone_number;
      const fullName = state.fullName?.trim() || "(Ism yo'q)";
      const code = `TG-${uuidv4().slice(0, 8)}`;
      const normalizedPhone = rawPhone.replace(/\D/g, "").replace(/^998/, "");
      const searchPhone = `998${normalizedPhone}`;

      try {
        const existingCustomers = await moysklad.findCustomerByPhone(searchPhone);
        if (existingCustomers && existingCustomers.length > 0) {
          // Agar bazada shu telefon raqami mavjud bo‘lsa, ism mosligini tekshiramiz
          const matchingCustomer = existingCustomers.find(
            (customer) => customer.name.toLowerCase() === fullName.toLowerCase()
          );
          if (!matchingCustomer) {
            return bot.sendMessage(
              chatId,
              "❗ Ushbu telefon raqam boshqa ism/familiyaga bog'langan. Iltimos, boshqa telefon raqamini kiriting yoki ro'yxatdan o'tgan bo'lsangiz /start buyrug'ini bosing."
            );
          }
          // Bu shart bajarilsa, keyingi bosqichga o‘tish uchun yangi mijoz yaratiladi
          try {
            await moysklad.createCustomer({
              name: fullName,
              phone: searchPhone,
              code,
            });
          } catch (error) {
            console.error("Mijoz yaratishda xato:", error);
            return bot.sendMessage(chatId, "❗ Mijozni yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
          }
        } else {
          // Agar bazada shu telefon raqami mavjud bo'lmasa, demak foydalanuvchi yangidan ro'yhatdan o'tmoqda.
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
        state.userCode = code;
        state.phone = rawPhone;
        state.fullName = fullName;
        // Kanalga qo'shilish bosqichi, masalan:
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

      } catch (error) {
        console.error("Moysklad qidiruv xatosi:", error);
        return bot.sendMessage(chatId, "❗ Telefon raqamini tekshirishda xatolik yuz berdi. Qayta urinib ko'ring.");
      }
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
    
      // Yandex maps URL: 
      // https://yandex.com/maps?whatshere%5Bpoint%5D=64.430688%2C39.780488&whatshere%5Bzoom%5D=16.0&ll=64.43089781712835%2C39.77995002113143&z=16.0&si=316h6wcxg2uvc32r2aau36t564
      // Koordinatalarni quyidagicha belgilaymiz (agar ushbu koordinatalar sizga mos kelsa):
      const minorLatitude = 39.780488;
      const minorLongitude = 64.430688;
      await bot.sendLocation(chatId, minorLatitude, minorLongitude);
    
      return bot.answerCallbackQuery(query.id);
    }
    
    if (data === "branch_kitoblar") {
      await bot.sendPhoto(
        chatId,
        "https://avatars.mds.yandex.net/get-altay/4435487/2a0000017925b1a260c491fe511a4221a666/L_height",
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
    
      // Yandex maps URL: 
      // https://yandex.com/maps/org/232508939995?si=316h6wcxg2uvc32r2aau36t564
      // Ushbu URLdan olinadigan koordinatalarni (masalan, Tashkent uchun) aniqlab kiritishingiz mumkin:
      const kitoblarLatitude = 39.763188;   // misol uchun – iltimos, to‘g‘ri koordinatani kiriting
      const kitoblarLongitude = 64.425435  // misol uchun – iltimos, to‘g‘ri koordinatani kiriting
      await bot.sendLocation(chatId, kitoblarLatitude, kitoblarLongitude);
      return bot.answerCallbackQuery(query.id);
    }
    
  });
};
