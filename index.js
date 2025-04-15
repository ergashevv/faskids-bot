/** @format */
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const showBonusCard = require("./components/showBonusCard");
const moysklad = require("./services/moysklad");

// ===== MongoDB ULASH VA MODEL =====
// Masalan, .env faylda:
// mongodb+srv://foydalanuvchi:parol@faskids.obso50p.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Faskids
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error("MongoDB ulanish URI topilmadi. Iltimos, MONGODB_URI environment variable ni sozlang.");
  process.exit(1);
}
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB ga ulandi"))
  .catch((err) => {
    console.error("MongoDB ulanish xatosi:", err);
    process.exit(1);
});

// UserState modeli – admindan yuborilgan reklamalar uchun adMessages maydoni qo'shilgan.
// adMessages – har bir element { adId: String, messageId: Number } shaklida.
const userStateSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  fullName: { type: String, default: "" },
  phone: { type: String, default: "" },
  userCode: { type: String, default: "" },
  step: { type: String, default: "main_menu" },
  feedbackMessages: { type: [String], default: [] },
  applicationData: { type: Object, default: {} },
  adMessages: { type: [{ adId: String, messageId: Number }], default: [] }
}, { timestamps: true });
const UserState = mongoose.model("UserState", userStateSchema);

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda...`);
});

// ===== TELEGRAM BOT =====
// Faqat bitta bot instansiyasi polling orqali ishlaydi
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Administratorlar ro'yxati – adminlar IDlari (o'zingizga moslashtiring)
const adminIds = [5737309471, 523589911, 537750824];

// Foydalanuvchi menyusi
const regularUserKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa"],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Admin menyusi – adminlar uchun qo'shimcha "📢 Reklama" tugmasi kiritiladi
const adminKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa", "📢 Reklama"],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Reklama bo‘limi – admin inline tugmalarini kiritamiz.
// Bu tugmalarda: "➕ Yangi reklama", "✏ Reklamani tahrirlash", "❌ Reklamani o'chirish", "🔙 Ortga"
const adminAdInlineKeyboard = {
  inline_keyboard: [
    [{ text: "➕ Yangi reklama", callback_data: "admin_create_ad" }],
    [{ text: "✏ Reklamani tahrirlash", callback_data: "admin_edit_ad" }],
    [{ text: "❌ Reklamani o'chirish", callback_data: "admin_delete_ad" }],
    [{ text: "🔙 Ortga", callback_data: "admin_go_back" }]
  ],
};

function getUserMenu(isAdmin) {
  return isAdmin ? adminKeyboard : regularUserKeyboard;
}

// Yordamchi funksiya: DB (MongoDB) dan foydalanuvchi holatini olish yoki yaratish (upsert)
async function getOrCreateUserState(chatId) {
  const state = await UserState.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { step: "main_menu" } },
    { new: true, upsert: true }
  );
  return state;
}

// ===== /start HANDLER =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  let state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(msg.from.id);
  if (state.userCode) {
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
  } else {
    state.step = "get_name";
    await state.save();
    return bot.sendMessage(chatId, "👋 Iltimos, ismingiz va familiyangizni yuboring (masalan: Abdullayev John).");
  }
});

// ===== ASOSIY MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  const state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(msg.from.id);

  // Global "🔙 Ortga"
  if (text === "🔙 Ortga") {
    state.step = "main_menu";
    state.applicationData = {};
    state.feedbackMessages = [];
    await state.save();
    return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
  }

  // ==== ADMIN REKLAMA FUNKSIYASI ====
  // Admin "📢 Reklama" tugmasini bosganda: reklama bo'limi inline tugmalari chiqadi.
  if (isAdmin && text === "📢 Reklama") {
    await bot.sendMessage(chatId, "Reklama bo'limi. Quyidagi tugmalardan birini tanlang:", {
      reply_markup: adminAdInlineKeyboard,
    });
    return;
  }

  // Foydalanuvchi buyruqlari
  if (text === "📲 Jamg‘arma kartasi") {
    if (!state.userCode) {
      return bot.sendMessage(chatId, "❗ Siz hali ro'yxatdan o'tmagansiz. /start buyrug'ini bosing.");
    }
    return showBonusCard(bot, chatId, state.userCode);
  }
  if (text === "📞 Aloqa") {
    if (!state.userCode) {
      return bot.sendMessage(chatId, "❗ Siz ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosib ro'yxatdan o'ting.");
    }
    return bot.sendMessage(chatId, "+998507266007");
  }
  if (text === "🏢 Filliallar ro‘yxati") {
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: "FAS kids Minor", callback_data: "branch_minor" }],
        [{ text: "FAS kids Kitoblar Olami", callback_data: "branch_kitoblar" }],
      ],
    };
    return bot.sendMessage(chatId, "Qaysi filialni tanlaysiz?", { reply_markup: inlineKeyboard });
  }
  if (text === "📞 Talab va taklif") {
    state.feedbackMessages = [];
    state.step = "collect_feedback";
    await state.save();
    return bot.sendMessage(
      chatId,
      "✍️ Iltimos, fikringizni matn, ovozli yoki video xabar shaklida yuboring. (Rasm ham yuborishingiz mumkin.)",
      { reply_markup: { keyboard: [["🔙 Ortga"]], resize_keyboard: true, one_time_keyboard: false } }
    );
  }
  if (text === "🎁 Bonuslar") {
    return bot.sendMessage(
      chatId,
      "🎁 Bonuslar bo'yicha ma'lumotlar:\n\n1. Har 1000 so'm uchun 1 ball.\n2. 100 ball to'planganda 10% chegirma.\n3. 500 ball to'planganda 50% chegirma.\n4. 1000 ball to'planganda 100% chegirma.",
      { reply_markup: getUserMenu(isAdmin).reply_markup }
    );
  }
  if (text === "💼 Ishga kirish") {
    return bot.sendMessage(
      chatId,
      "Iltimos, quyidagi botga o'ting va arizani to'ldiring:\n👉 https://t.me/faskidsjob_bot\n\n☎️ Qo'shimcha ma'lumot uchun @faskidsuz_admin bilan bog'laning.",
      { reply_markup: { keyboard: [["🔙 Ortga"]], resize_keyboard: true } }
    );
  }

  // ==== RO'YXATDAN O'TISH BOSQICHLARI ====
  // (1) Ism va familiya so'raladigan bosqich
  if (state.step === "get_name" && text && text !== "/start") {
    state.fullName = text;
    state.step = "get_phone";
    await state.save();
    return bot.sendMessage(
      chatId,
      "📞 Iltimos, telefon raqamingizni yuboring (masalan: +998901234567). Siz kontakt yoki oddiy matn shaklida yuborishingiz mumkin:",
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
  // (2) Telefon raqamini qabul qiladigan bosqich
  if (state.step === "get_phone") {
    let rawPhone = "";
    if (msg.contact && msg.contact.phone_number) {
      rawPhone = msg.contact.phone_number;
    } else if (text && text !== "/start") {
      rawPhone = text.trim();
    } else {
      return bot.sendMessage(chatId, "Iltimos, telefon raqamingizni kontakt yoki matn shaklida yuboring.");
    }
    const fullName = state.fullName?.trim() || "(Ism mavjud emas)";
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
            "❗ Ushbu telefon raqam boshqa ism/familiyaga bog'langan. Iltimos, boshqa telefon raqamini kiriting yoki /start buyrug'ini bosing."
          );
        }
      }
    } catch (error) {
      console.error("Moysklad qidiruv xatosi:", error);
      return bot.sendMessage(chatId, "❗ Telefon raqamini tekshirishda xatolik yuz berdi. Qayta urinib ko'ring.");
    }
    if (!customer) {
      const code = `TG-${uuidv4().slice(0, 8)}`;
      try {
        await moysklad.createCustomer({
          name: state.fullName,
          phone: searchPhone,
          code,
        });
        customer = { code };
      } catch (error) {
        console.error("Yangi mijoz yaratishda xato:", error);
        return bot.sendMessage(chatId, "❗ Mijozni yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
      }
    }
    state.step = "verify_channel";
    state.userCode = customer.code;
    state.phone = rawPhone;
    await state.save();
    const requiredChannelUsername = "faskids";
    return bot.sendMessage(
      chatId,
      "📢 Davom etish uchun kanalga qo'shiling!",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📲 Kanalga qo'shilish", url: `https://t.me/${requiredChannelUsername}` }],
            [{ text: "✅ Tekshirish", callback_data: "check_subscription" }]
          ]
        }
      }
    );
  }

  // ==== FEEDBACK BOSQICHI ====
  if (state.step === "collect_feedback") {
    if (text === "🔙 Ortga") {
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
    }
    const channelId = "-1002689337016"; // O'z kanal ID
    const username = msg.from.username ? `@${msg.from.username}` : "(Username mavjud emas)";
    const firstName = msg.from.first_name || "(Ism mavjud emas)";
    const lastName = msg.from.last_name || "";
    const fullNameFeedback = state.fullName || "(Ro'yxatdan ism mavjud emas)";
    const phone = state.phone || "(Telefon mavjud emas)";
    const userMessage = text || "(Matnli xabar mavjud emas)";
    const feedbackText =
      `📝 Yangi murojaat:\n` +
      `👤 <b>Foydalanuvchi:</b> ${fullNameFeedback}\n` +
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

  // ==== ADMIN /broadcast HANDLER (OLDINGI /broadcast KOMANDASI) ====
  if (text && text.startsWith("/broadcast")) {
    if (!adminIds.includes(msg.from.id)) {
      return bot.sendMessage(chatId, "Sizga bu buyruqni bajarish uchun ruxsat yo'q.");
    }
    // Yangi reklama uchun adId yaratiladi
    const adId = uuidv4();
    const parts = text.split(" ");
    if (parts.length < 2) {
      return bot.sendMessage(chatId, "Iltimos, '/broadcast <message_id>' formatida yuboring.");
    }
    const channelMessageId = parseInt(parts[1], 10);
    if (isNaN(channelMessageId)) {
      return bot.sendMessage(chatId, "Xato: message_id raqam shaklida bo'lishi kerak.");
    }
    const channelChatId = process.env.REKLAMA_CHANNEL_CHAT_ID || "-1001316855543";
    const allUsers = await UserState.find({}, "chatId adMessages");
    let totalBroadcast = 0;
    for (const user of allUsers) {
      try {
        const sentMsg = await bot.forwardMessage(user.chatId, channelChatId, channelMessageId);
        // Har bir foydalanuvchi uchun adMessages massiviga { adId, messageId } obyektini qo'shamiz
        user.adMessages.push({ adId, messageId: sentMsg.message_id });
        await user.save();
        totalBroadcast++;
      } catch (err) {
        console.error(`Xabar yuborishda xatolik (chat: ${user.chatId}):`, err.message);
      }
    }
    return bot.sendMessage(chatId, `Reklama ${totalBroadcast} foydalanuvchiga yuborildi.\nReklama ID: ${adId}`);
  }
});

// ==== ADMIN REKLAMA XABARLARINI EDIT / DELETE QILISH ====
// Admin inline tugmalari orqali "/edit_ad" va "/delete_ad" buyruqlari chaqiriladi.
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(query.from.id);

  // Admin reklama bo'limi inline tugmalari:
  if (isAdmin) {
    if (data === "admin_create_ad") {
      state.step = "admin_creating_ad";
      await state.save();
      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      await bot.sendMessage(chatId, "Yangi reklama yuborilishini kuting. Siz yuborgan xabar hammasi copyMessage orqali tarqatiladi.");
      return bot.answerCallbackQuery(query.id);
    }
    if (data === "admin_edit_ad") {
      await bot.sendMessage(chatId, "Reklama tahriri uchun:\n`/edit_ad <adId> <yangi reklama matni>`", { parse_mode: "Markdown" });
      return bot.answerCallbackQuery(query.id);
    }
    if (data === "admin_delete_ad") {
      await bot.sendMessage(chatId, "Reklamani o'chirish uchun:\n`/delete_ad <adId>`", { parse_mode: "Markdown" });
      return bot.answerCallbackQuery(query.id);
    }
    if (data === "admin_go_back") {
      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "Asosiy menyu (admin):", getUserMenu(isAdmin));
    }
  }

  // "check_subscription" callback
  if (data === "check_subscription") {
    const channelUsername = "faskids";
    try {
      const member = await bot.getChatMember(`@${channelUsername}`, query.from.id);
      if (member.status === "left" || member.status === "kicked") {
        return bot.sendMessage(chatId, "❗ Siz kanalga qo'shilmagansiz. Iltimos, kanalga qo'shiling va qayta tekshiring.");
      }
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "✔ Kanalga a'zo bo'ldingiz! Asosiy menyu:", getUserMenu(isAdmin));
    } catch (err) {
      console.error("Kanal obunasini tekshirishda xato:", err);
      return bot.sendMessage(chatId, "Obuna tekshiruvida xatolik yuz berdi. Qayta urinib ko'ring.");
    }
  }

  // BONUSNI QAYTA TEKSHIRISH (check_balance) – bonusHandler modulida alohida bajarilgan deb qabul qilamiz
});

// ==== ADMIN KONSOL BUYRUQLARI ====
// /edit_ad <adId> <yangi reklama matni>
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  if (!adminIds.includes(msg.from.id)) return;

  if (text.startsWith("/edit_ad")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      return bot.sendMessage(chatId, "Iltimos, '/edit_ad <adId> <yangi reklama matni>' formatida yuboring.");
    }
    const adId = parts[1];
    const newAdText = text.substring(text.indexOf(adId) + adId.length).trim();
    if (!newAdText) {
      return bot.sendMessage(chatId, "Yangi reklama matni bo'sh bo'lmasligi kerak.");
    }
    try {
      const users = await UserState.find({ "adMessages.adId": adId });
      let totalEdited = 0;
      for (const user of users) {
        for (const adObj of user.adMessages) {
          if (adObj.adId === adId) {
            try {
              await bot.editMessageText(newAdText, {
                chat_id: user.chatId,
                message_id: adObj.messageId,
                parse_mode: "HTML"
              });
              totalEdited++;
            } catch (editErr) {
              console.error(`Chat ${user.chatId} uchun reklama tahrirlashda xatolik (msgId: ${adObj.messageId}):`, editErr.message);
            }
          }
        }
      }
      return bot.sendMessage(chatId, `Reklama [${adId}] bo'yicha ${totalEdited} ta xabar tahrirlandi.`);
    } catch (err) {
      console.error("Reklama tahrirlashda xatolik:", err.message);
      return bot.sendMessage(chatId, "Reklama tahrirlashda xatolik yuz berdi.");
    }
  }

  // /delete_ad <adId>
  if (text.startsWith("/delete_ad")) {
    const parts = text.split(" ");
    if (parts.length < 2) {
      return bot.sendMessage(chatId, "Iltimos, '/delete_ad <adId>' formatida yuboring.");
    }
    const adId = parts[1].trim();
    try {
      const users = await UserState.find({ "adMessages.adId": adId });
      let totalDeleted = 0;
      for (const user of users) {
        const remainingAds = [];
        for (const adObj of user.adMessages) {
          if (adObj.adId === adId) {
            try {
              await bot.deleteMessage(user.chatId, adObj.messageId);
              totalDeleted++;
            } catch (delErr) {
              console.error(`Chat ${user.chatId} uchun reklama o'chirishda xatolik (msgId: ${adObj.messageId}):`, delErr.message);
              remainingAds.push(adObj);
            }
          } else {
            remainingAds.push(adObj);
          }
        }
        user.adMessages = remainingAds;
        await user.save();
      }
      return bot.sendMessage(chatId, `Reklama [${adId}] bo'yicha ${totalDeleted} ta xabar barcha foydalanuvchilardan o'chirildi.`);
    } catch (err) {
      console.error("Reklama o'chirishda xatolik:", err.message);
      return bot.sendMessage(chatId, "Reklama o'chirishda xatolik yuz berdi.");
    }
  }
});
