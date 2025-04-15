/** @format */
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

// Import modullar
const showBonusCard = require("./components/showBonusCard");
const moysklad = require("./services/moysklad");
const Ad = require("./models/Ad");

// ===== MongoDB ga ULASH =====
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error("MongoDB ulanish URI topilmadi. Iltimos, MONGODB_URI ni sozlang.");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB ga ulandi"))
  .catch((err) => {
    console.error("MongoDB ulanish xatosi:", err);
    process.exit(1);
  });

// ===== UserState MODEL =====
const userStateSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  fullName: { type: String, default: "" },
  phone: { type: String, default: "" },
  userCode: { type: String, default: "" },
  step: { type: String, default: "main_menu" },
  feedbackMessages: { type: [String], default: [] },
  applicationData: { type: Object, default: {} },
}, { timestamps: true });

const UserState = mongoose.model("UserState", userStateSchema);

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda...`);
});

// ===== TELEGRAM BOT =====
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ADMINLAR RO'YXATI – o'zingizning admin telegram IDlaringizni kiriting
const adminIds = [537750824,523589911, 5737309471]; // Masalan, admin IDlaringiz

// MENYU KEYBOARDLARI
const regularUserKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa"],
    ],
    resize_keyboard: true,
  },
};

const adminKeyboard = {
  reply_markup: {
    keyboard: [
      ["📲 Jamg‘arma kartasi", "📞 Talab va taklif"],
      ["🏢 Filliallar ro‘yxati", "💼 Ishga kirish"],
      ["📞 Aloqa", "📢 Reklama"],
    ],
    resize_keyboard: true,
  },
};

function getUserMenu(isAdmin) {
  return isAdmin ? adminKeyboard : regularUserKeyboard;
}

async function getOrCreateUserState(chatId) {
  const state = await UserState.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { step: "main_menu" } },
    { new: true, upsert: true }
  );
  return state;
}

/** 
 * Inline tugma matnlarini qayta ishlash:
 * Yangi qatorlar olib tashlanadi, trim qilinadi va maksimal 30 belgi olinadi.
 */
function sanitizeButtonText(text) {
  if (!text) return "";
  return text.normalize("NFC").replace(/[\r\n]+/g, " ").trim().slice(0, 30);
}

/** 
 * Sana formatlash: kun/oy/yil soat:minut 
 */
function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Reklama ro'yxatini ko'rsatish funksiyasi
 * Har bir reklamaning tugma matnida reklama yaratilgan sanasi ham ko'rsatiladi.
 */
async function showAdList(chatId, isAdmin) {
  const ads = await Ad.find().sort({ createdAt: -1 });
  if (ads.length === 0) {
    const adMenu = {
      inline_keyboard: [
        [{ text: "➕ Yangi reklama", callback_data: "ad_new" }],
        [{ text: "Ortga", callback_data: "admin_back" }]
      ]
    };
    return bot.sendMessage(chatId, "Hozircha reklamalar mavjud emas.\n➕ Yangi reklama qo'shish:", { reply_markup: adMenu });
  } else {
    const inlineRows = ads.map((ad) => {
      let shortText = "";
      if (ad.media) {
        if (ad.media.type === "photo") {
          shortText = "[RASM] ";
        } else if (ad.media.type === "video") {
          shortText = "[VIDEO] ";
        }
        if (ad.media.caption) {
          shortText += ad.media.caption;
        } else if (ad.originalText) {
          shortText += ad.originalText;
        } else {
          shortText += "(Matn yo'q)";
        }
      } else {
        shortText = ad.originalText || "(Matn yo'q)";
      }
      // Qo'shimcha: yaratilgan sanani qo'shamiz
      const created = formatDate(ad.createdAt);
      shortText += ` (${created})`;

      // Tugma matni uchun sanitasiyadan o'tkazamiz
      shortText = sanitizeButtonText(shortText) || "(Matn yo'q)";
      return [{
        text: shortText,
        callback_data: `ad_detail_${ad.adId}`
      }];
    });

    inlineRows.push([{ text: "➕ Yangi reklama", callback_data: "ad_new" }]);
    inlineRows.push([{ text: "Ortga", callback_data: "admin_back" }]);
    const adMenu = { inline_keyboard: inlineRows };

    return bot.sendMessage(chatId, "Mavjud reklamalar ro'yxati:", { reply_markup: adMenu });
  }
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
  }
  state.step = "get_name";
  await state.save();
  return bot.sendMessage(chatId, "👋 Iltimos, ismingiz va familiyangizni yuboring (masalan: Abdullayev John).");
});

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(msg.from.id);

  // Global "🔙 Ortga" tugmasi – asosiy menyuga qaytish
  if (text === "🔙 Ortga") {
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
  }

  // Agar admin "📢 Reklama" tugmasini bosganda (reply keyboard orqali)
  if (isAdmin && text === "📢 Reklama") {
    return showAdList(chatId, isAdmin);
  }

  // Foydalanuvchi menyusi:
  if (text === "📲 Jamg‘arma kartasi") {
    if (!state.userCode) {
      return bot.sendMessage(chatId, "❗ Siz hali ro'yxatdan o'tmagansiz. /start buyrug'ini bosing.");
    }
    return showBonusCard(bot, chatId, state.userCode);
  }
  if (text === "📞 Aloqa") {
    if (!state.userCode) {
      return bot.sendMessage(chatId, "❗ Ro'yxatdan o'tmagansiz. Iltimos, /start buyrug'ini bosing.");
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
  if (text === "💼 Ishga kirish") {
    return bot.sendMessage(
      chatId,
      "Iltimos, quyidagi botga o'ting va arizani to'ldiring:\n👉 https://t.me/faskidsjob_bot\n\nQo'shimcha ma'lumot uchun @faskidsuz_admin bilan bog'laning.",
      {
        reply_markup: {
          keyboard: [["🔙 Ortga"]],
          resize_keyboard: true
        }
      }
    );
  }
  if (text === "📞 Talab va taklif") {
    state.step = "collect_feedback";
    await state.save();
    return bot.sendMessage(
      chatId,
      "✍️ Iltimos, talab yoki taklifingizni matn, ovoz, video yoki rasm shaklida yuboring.",
      {
        reply_markup: {
          keyboard: [["🔙 Ortga"]],
          resize_keyboard: true
        }
      }
    );
  }

  // Ro'yxatdan o'tish steplari:
  if (state.step === "get_name" && text && text !== "/start") {
    state.fullName = text;
    state.step = "get_phone";
    await state.save();
    return bot.sendMessage(
      chatId,
      "📞 Iltimos, telefon raqamingizni yuboring (masalan: +998901234567).",
      {
        reply_markup: {
          keyboard: [
            [{ text: "📱 Telefon raqamni yuborish", request_contact: true }],
            ["🔙 Ortga"]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  }
  if (state.step === "get_phone") {
    let rawPhone = "";
    if (msg.contact && msg.contact.phone_number) {
      rawPhone = msg.contact.phone_number;
    } else if (text && text !== "/start") {
      rawPhone = text.trim();
    } else {
      return bot.sendMessage(chatId, "Iltimos, telefon raqamingizni kontakt yoki matn shaklida yuboring.");
    }
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
          return bot.sendMessage(chatId, "❗ Ushbu telefon raqam boshqa ism/familiyaga bog'langan. Iltimos, boshqa telefon raqamini kiriting yoki /start ni bosing.");
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

  // Feedback bosqichi (Talab va taklif)
  if (state.step === "collect_feedback") {
    if (text === "🔙 Ortga") {
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
    }
    const feedbackChannel = process.env.FEEDBACK_GROUP_ID || "-1000000000000";
    const username = msg.from.username ? `@${msg.from.username}` : "(username yo'q)";
    const firstName = msg.from.first_name || "(Ism yo'q)";
    const lastName = msg.from.last_name || "";
    const feedbackText =
      `📝 Yangi talab/taklif:\n` +
      `👤 <b>Foydalanuvchi:</b> ${state.fullName}\n` +
      `💡 <b>Username:</b> ${username}\n` +
      `📱 <b>Telefon:</b> ${state.phone}\n` +
      `👀 <b>Ism:</b> ${firstName} ${lastName}\n\n` +
      `<b>Xabar:</b> ${text}`;
    await bot.sendMessage(feedbackChannel, feedbackText, { parse_mode: "HTML" });
    if (msg.photo && msg.photo.length > 0) {
      const photoFileId = msg.photo[msg.photo.length - 1].file_id;
      await bot.sendPhoto(feedbackChannel, photoFileId);
    }
    if (msg.voice) {
      await bot.sendVoice(feedbackChannel, msg.voice.file_id);
    }
    if (msg.video) {
      await bot.sendVideo(feedbackChannel, msg.video.file_id);
    }
    if (msg.video_note) {
      await bot.sendVideoNote(feedbackChannel, msg.video_note.file_id);
    }
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "✅ Xabar qabul qilindi. Rahmat!", getUserMenu(isAdmin));
  }

  // Yangi reklama bosqichi (admin_creating_ad)
  if (isAdmin && state.step === "admin_creating_ad") {
    const newAdId = uuidv4();
    let mediaData = null;
    if (msg.photo && msg.photo.length > 0) {
      mediaData = {
        type: "photo",
        media: msg.photo[msg.photo.length - 1].file_id,
        caption: msg.caption || (msg.text || "")
      };
    } else if (msg.video) {
      mediaData = {
        type: "video",
        media: msg.video.file_id,
        caption: msg.caption || (msg.text || "")
      };
    }
    const adDoc = new Ad({
      adId: newAdId,
      originalText: (msg.text || "").slice(0, 4096),
      media: mediaData
    });
    await adDoc.save();
    const allUsers = await UserState.find({}, { chatId: 1 });
    for (const user of allUsers) {
      try {
        const sentMsg = await bot.copyMessage(user.chatId, chatId, msg.message_id);
        adDoc.broadcastedMessages.set(String(user.chatId), sentMsg.message_id);
      } catch (err) {
        console.error(`Reklama yuborishda xato (chatId ${user.chatId}):`, err.message);
      }
    }
    await adDoc.save();
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, "✅ Yangi reklama barcha foydalanuvchilarga yuborildi.", getUserMenu(isAdmin));
  }

  // Reklama tahrirlash bosqichi (admin_editing_ad_<adId>)
  if (isAdmin && state.step.startsWith("admin_editing_ad_")) {
    const adId = state.step.replace("admin_editing_ad_", "");
    const adDoc = await Ad.findOne({ adId });
    if (!adDoc) {
      state.step = "main_menu";
      await state.save();
      return bot.sendMessage(chatId, "Tahrirlash xatosi: reklama topilmadi.");
    }
    let newMedia = null;
    if (msg.photo && msg.photo.length > 0) {
      newMedia = {
        type: "photo",
        media: msg.photo[msg.photo.length - 1].file_id,
        caption: msg.caption || (msg.text || "")
      };
    } else if (msg.video) {
      newMedia = {
        type: "video",
        media: msg.video.file_id,
        caption: msg.caption || (msg.text || "")
      };
    }
    if (newMedia) {
      adDoc.media = newMedia;
      adDoc.originalText = newMedia.caption || "";
    } else {
      const newText = msg.text || "";
      adDoc.originalText = newText.slice(0, 4096);
      adDoc.media = null;
    }
    let totalEdited = 0;
    for (const [uChatIdKey, messageId] of adDoc.broadcastedMessages.entries()) {
      const uChatId = parseInt(uChatIdKey, 10);
      try {
        if (adDoc.media) {
          await bot.editMessageMedia(
            {
              type: adDoc.media.type,
              media: adDoc.media.media,
              caption: adDoc.media.caption || ""
            },
            { chat_id: uChatId, message_id: messageId }
          );
        } else {
          await bot.editMessageText(adDoc.originalText, {
            chat_id: uChatId,
            message_id: messageId
          });
        }
        totalEdited++;
      } catch (err) {
        console.error(`Tahrirlashda xato: ChatID ${uChatId}, MsgId ${messageId}`, err.message);
      }
    }
    await adDoc.save();
    state.step = "main_menu";
    await state.save();
    return bot.sendMessage(chatId, `Reklama tahrirlandi.`, getUserMenu(isAdmin));
  }
});

// ===== CALLBACK QUERY HANDLER =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const state = await getOrCreateUserState(chatId);
  const isAdmin = adminIds.includes(query.from.id);

  // Kanal obunasini tekshirish
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

  // Filliallar ro'yxati callbacklari
  if (data === "branch_minor") {
    return bot.sendMessage(chatId, "FAS kids Minor: Toshkent shahridagi filial manzili ...");
  }
  if (data === "branch_kitoblar") {
    return bot.sendMessage(chatId, "FAS kids Kitoblar Olami: Toshkent shahridagi filial manzili ...");
  }

  // ADMIN: "admin_back" – asosiy menyuga qaytish
  if (data === "admin_back") {
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
  }

  // CALLBACK: "📢 Reklama" – agar inline tugma sifatida yuborilsa
  if (data === "📢 Reklama") {
    return showAdList(chatId, isAdmin);
  }

  // Yangi reklama: "ad_new"
  if (data === "ad_new") {
    state.step = "admin_creating_ad";
    await state.save();
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    return bot.sendMessage(chatId, "Yangi reklama xabaringizni yuboring (matn, rasm, video va hk.).");
  }

  // Reklama tafsilotlari: "ad_detail_<adId>"
  if (data.startsWith("ad_detail_")) {
    const adId = data.replace("ad_detail_", "");
    const adDoc = await Ad.findOne({ adId });
    if (!adDoc) {
      return bot.sendMessage(chatId, "Ushbu reklama topilmadi yoki o'chirilgan bo'lishi mumkin.");
    }
    let detailText = "";
    if (adDoc.media) {
      if (adDoc.media.type === "photo") {
        detailText += "[RASM] ";
      } else if (adDoc.media.type === "video") {
        detailText += "[VIDEO] ";
      }
      detailText += adDoc.media.caption || adDoc.originalText || "(Matn yo'q)";
    } else {
      detailText += adDoc.originalText || "(Matn yo'q)";
    }
    // Sanani qo'shamiz
    const created = formatDate(adDoc.createdAt);
    detailText += `\n\nYaratilgan: ${created}`;
    
    const detailMenu = {
      inline_keyboard: [
        [
          { text: "📝 Tahrirlash", callback_data: `ad_edit_${adId}` },
          { text: "🗑 O‘chirish", callback_data: `ad_delete_${adId}` }
        ],
        [{ text: "Ortga", callback_data: "admin_back" }]
      ]
    };
    return bot.editMessageText(
      `Reklama:\n\n${detailText}\n\nQaysi amalni bajarasiz?`,
      { chat_id: chatId, message_id: query.message.message_id, reply_markup: detailMenu }
    );
  }

  // Reklama tahriri: "ad_edit_<adId>"
  if (data.startsWith("ad_edit_")) {
    const adId = data.replace("ad_edit_", "");
    const adDoc = await Ad.findOne({ adId });
    if (!adDoc) {
      return bot.sendMessage(chatId, "Reklama topilmadi.");
    }
    state.step = `admin_editing_ad_${adId}`;
    await state.save();
    // Avvalgi reklamaning media yoki matnini ko'rsatamiz admin uchun
    if (adDoc.media) {
      if (adDoc.media.type === "photo") {
        await bot.sendPhoto(chatId, adDoc.media.media, {
          caption: adDoc.media.caption || "(Matn yo'q)"
        });
      } else if (adDoc.media.type === "video") {
        await bot.sendVideo(chatId, adDoc.media.media, {
          caption: adDoc.media.caption || "(Matn yo'q)"
        });
      }
    } else {
      await bot.sendMessage(chatId, "Hozirgi reklama matni:\n\n" + (adDoc.originalText || "(Matn yo'q)"));
    }
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    return bot.sendMessage(chatId, "Yangi reklama matnini va/yoki media faylini yuboring. Agar faqat matn kiritilsa, rasm/video olib tashlanadi.");
  }

  // Reklama o'chirish: "ad_delete_<adId>"
  if (data.startsWith("ad_delete_")) {
    const adId = data.replace("ad_delete_", "");
    const adDoc = await Ad.findOne({ adId });
    if (!adDoc) {
      return bot.sendMessage(chatId, "Reklama topilmadi.");
    }
    let totalDeleted = 0;
    for (const [uChatIdKey, messageId] of adDoc.broadcastedMessages.entries()) {
      const uChatId = parseInt(uChatIdKey, 10);
      try {
        await bot.deleteMessage(uChatId, messageId);
        totalDeleted++;
      } catch (err) {
        console.error(`O'chirishda xato: ChatID ${uChatId}, MsgId ${messageId}`, err.message);
      }
    }
    await adDoc.deleteOne();
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    return bot.sendMessage(chatId, `Reklama o'chirildi.`, getUserMenu(isAdmin));
  }
});
