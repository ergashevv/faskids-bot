/** @format */
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const showBonusCard = require("./components/showBonusCard");
const moysklad = require("./services/moysklad");

// ===== MongoDB ULASH VA MODEL =====
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

// UserState modeli
const userStateSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  fullName: { type: String, default: "" },
  phone: { type: String, default: "" },
  userCode: { type: String, default: "" },
  step: { type: String, default: "main_menu" },
  feedbackMessages: { type: [String], default: [] },
  applicationData: { type: Object, default: {} }
}, { timestamps: true });
const UserState = mongoose.model("UserState", userStateSchema);

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda...`);
});

// ===== TELEGRAM BOT =====
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Adminlar ro'yxati (o'zingizning admin IDlaringizni kiriting)
const adminIds = [5737309471, 523589911, 537750824];

// Foydalanuvchi menyusi
const regularUserKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa"]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Admin menyusi – qo'shimcha "📢 Reklama" tugmasi bilan
const adminKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa", "📢 Reklama"]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

function getUserMenu(isAdmin) {
  return isAdmin ? adminKeyboard : regularUserKeyboard;
}

// Reklama maʼlumotlarini bot xotirasida saqlash uchun global obyekt.
// Strukturasi: { [adId]: { content: string, broadcast: { [chatId]: messageId } } }
const adsRecord = {};

// Yordamchi funktsiya: UserState ni olish yoki yaratish
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

  if (text === "🔙 Ortga") {
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
  }

  // Admin uchun: "📢 Reklama" tugmasi, reklama menyusi ochiladi
  if (isAdmin && text === "📢 Reklama") {
    // Reklama bo‘limi uchun inline tugmalar:
    const adMenu = {
      inline_keyboard: [
        [{ text: "📝 Yangi reklama yuborish", callback_data: "admin_new_ad" }]
      ]
    };
    await bot.sendMessage(chatId, "Reklama bo'limi:\nAdmin, yangi reklama yuborish uchun tugmani bosing.", { reply_markup: adMenu });
    return;
  }

  // Foydalanuvchi buyruqlari
  if (text === "📲 Jamg‘arma kartasi") {
    if (!state.userCode) {
      return bot.sendMessage(chatId, "❗ Siz hali ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosing.");
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
        [{ text: "FAS kids Kitoblar Olami", callback_data: "branch_kitoblar" }]
      ]
    };
    return bot.sendMessage(chatId, "Qaysi filialni tanlaysiz?", { reply_markup: inlineKeyboard });
  }
  if (text === "📞 Talab va taklif") {
    state.feedbackMessages = [];
    state.step = "collect_feedback";
    await state.save();
    return bot.sendMessage(chatId, "✍️ Iltimos, fikringizni yuboring (matn, ovoz, video yoki rasm).", {
      reply_markup: { keyboard: [["🔙 Ortga"]], resize_keyboard: true }
    });
  }
  if (text === "🎁 Bonuslar") {
    return bot.sendMessage(chatId, "🎁 Bonuslar:\n1. Har 1000 so'm uchun 1 ball\n2. 100 ball – 10% chegirma\n3. 500 ball – 50% chegirma\n4. 1000 ball – 100% chegirma", { reply_markup: getUserMenu(isAdmin).reply_markup });
  }
  if (text === "💼 Ishga kirish") {
    return bot.sendMessage(chatId, "Iltimos, quyidagi botga o'ting va arizani to'ldiring:\n👉 https://t.me/faskidsjob_bot\n\n☎️ Qo'shimcha ma'lumot uchun @faskidsuz_admin", { reply_markup: { keyboard: [["🔙 Ortga"]], resize_keyboard: true } });
  }

  // Ro'yxatdan o'tish bosqichlari
  if (state.step === "get_name" && text && text !== "/start") {
    state.fullName = text;
    state.step = "get_phone";
    await state.save();
    return bot.sendMessage(chatId, "📞 Iltimos, telefon raqamingizni yuboring (masalan: +998901234567) – kontakt yoki oddiy matn shaklida.");
  }
  if (state.step === "get_phone") {
    let rawPhone = "";
    if (msg.contact && msg.contact.phone_number) {
      rawPhone = msg.contact.phone_number;
    } else if (text && text !== "/start") {
      rawPhone = text;
    } else {
      return bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring.");
    }
    const fullName = state.fullName?.trim() || "(Ism mavjud emas)";
    const normalizedPhone = rawPhone.replace(/\D/g, "").replace(/^998/, "");
    const searchPhone = `998${normalizedPhone}`;
    let customer;
    try {
      const existingCustomers = await moysklad.findCustomerByPhone(searchPhone);
      if (existingCustomers && existingCustomers.length > 0) {
        customer = existingCustomers.find(cust => cust.name.toLowerCase() === fullName.toLowerCase());
        if (!customer) {
          return bot.sendMessage(chatId, "❗ Ushbu telefon raqam boshqa ism/familiyaga tegishli. Iltimos, boshqa telefon raqamini kiriting yoki /start buyrug'ini bosing.");
        }
      }
    } catch (error) {
      console.error("Moysklad qidiruv xatosi:", error);
      return bot.sendMessage(chatId, "❗ Telefon raqamini tekshirishda xatolik yuz berdi. Qayta urinib ko'ring.");
    }
    if (!customer) {
      const code = `TG-${uuidv4().slice(0, 8)}`;
      try {
        await moysklad.createCustomer({ name: state.fullName, phone: searchPhone, code });
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
    return bot.sendMessage(chatId, "📢 Kanalga qo'shilish uchun bosing:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📲 Kanalga qo'shilish", url: `https://t.me/${requiredChannelUsername}` }],
          [{ text: "✅ Tekshirish", callback_data: "check_subscription" }]
        ]
      }
    });
  }

  if (state.step === "collect_feedback") {
    if (text === "🔙 Ortga") {
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
    }
    const channelId = "-1002689337016";
    const username = msg.from.username ? `@${msg.from.username}` : "(Username mavjud emas)";
    const firstName = msg.from.first_name || "(Ism mavjud emas)";
    const lastName = msg.from.last_name || "";
    const fullNameFeedback = state.fullName || "(Ro'yxatdan ism mavjud emas)";
    const phone = state.phone || "(Telefon mavjud emas)";
    const feedbackText =
      `📝 Yangi murojaat:\n` +
      `👤 <b>Foydalanuvchi:</b> ${fullNameFeedback}\n` +
      `💡 <b>Username:</b> ${username}\n` +
      `📱 <b>Telefon:</b> ${phone}\n` +
      `👀 <b>Telegram First Name:</b> ${firstName}\n` +
      (lastName ? `👀 <b>Telegram Last Name:</b> ${lastName}\n` : "") +
      `\n<b>Xabar:</b> ${text}`;
    await bot.sendMessage(channelId, feedbackText, { parse_mode: "HTML" });
    if (msg.photo && msg.photo.length > 0) {
      await bot.sendPhoto(channelId, msg.photo[msg.photo.length - 1].file_id);
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

  // ==== ADMIN /broadcast HANDLER ====
  // Admin uchun: /broadcast buyrug‘i – reklama matnini yuborish.
  // Bu yerda admin reklama postini oson yuboradi; adminga kiritish uchun message_id kerak emas.
  if (text && text.startsWith("/broadcast")) {
    if (!adminIds.includes(msg.from.id)) {
      return bot.sendMessage(chatId, "Sizga bu buyruqni bajarish huquqi yo'q.");
    }
    const adText = text.substring("/broadcast".length).trim();
    if (!adText) {
      return bot.sendMessage(chatId, "Iltimos, reklama matnini yuboring. Masalan: /broadcast Yangi reklama matni");
    }
    try {
      // Reklamani maxsus kanalga yuboramiz (AD_CHANNEL_ID .env faylda belgilangan)
      const adChannelId = process.env.AD_CHANNEL_ID;
      if (!adChannelId) {
        return bot.sendMessage(chatId, "Reklama kanalining IDsi aniqlanmagan.");
      }
      const sentAd = await bot.sendMessage(adChannelId, adText, { parse_mode: "HTML" });
      // Endi, reklama kanal postiga havola:
      const adLink = `https://t.me/${adChannelId.replace("@", "")}/${sentAd.message_id}`;
      // Foydalanuvchilar uchun reklama havolasi bilan xabar yuboramiz:
      const inlineAdButton = {
        inline_keyboard: [
          [{ text: "Reklamani ko'rish", url: adLink }]
        ]
      };
      const allUsers = await UserState.find({}, "chatId");
      let count = 0;
      for (const user of allUsers) {
        try {
          await bot.sendMessage(user.chatId, `Yangi reklama:\n${adText}`, { reply_markup: inlineAdButton });
          count++;
        } catch (e) {
          console.error(`Chat ${user.chatId} ga reklama yuborishda xato:`, e.message);
        }
      }
      return bot.sendMessage(chatId, `Reklama ${count} foydalanuvchiga yuborildi.\nHavola: ${adLink}\nEndi admin Telegram kanalida postni o'zgartirib (edit) yoki oʻchirib (delete) boshqarishi mumkin.`);
    } catch (err) {
      console.error("Broadcast xatosi:", err.message);
      return bot.sendMessage(chatId, "Reklama yuborishda xatolik yuz berdi.");
    }
  }
});

// ==== CALLBACK QUERY HANDLER ====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(query.from.id);

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
      console.error("Kanal obunasini tekshirish xatosi:", err);
      return bot.sendMessage(chatId, "Obuna tekshiruvida xatolik yuz berdi. Qayta urinib ko'ring.");
    }
  }
  
  // Admin inline tugmalari: Bizning yangi yechimda, reklama postlarini tahrirlash yoki o'chirish Telegram kanalidagi post orqali amalga oshadi
  // Shuning uchun bot adminga ushbu tugmalar haqida xabar beradi va "Ortga" tugmasi bilan asosiy menyuga qaytadi.
  if (isAdmin && data === "admin_go_back") {
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "Asosiy menyu (admin):", getUserMenu(isAdmin));
  }
  
  return bot.answerCallbackQuery(query.id);
});
