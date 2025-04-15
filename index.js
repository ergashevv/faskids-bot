/** @format */
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

// Import modul va komponentlar
const showBonusCard = require("./components/showBonusCard");
const moysklad = require("./services/moysklad");

// ===== MongoDB ULASH VA MODEL =====
// .env faylida MONGODB_URI ni toʻgʻri sozlang, masalan:
// mongodb+srv://edevzi:Pulotjon1234@faskids.obso50p.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Faskids
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
    applicationData: { type: Object, default: {} },
    // Adminlar yuborgan reklama xabarlarining message_id larini saqlash
    adMessages: { type: [Number], default: [] }
}, { timestamps: true });
const UserState = mongoose.model("UserState", userStateSchema);

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portda ishlamoqda...`);
});

// ===== TELEGRAM BOT =====
// Faqat bitta bot instansiyasi polling qilsin
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Administratorlar ro'yxati (Telegram user ID-lari) – qo'lda kiritiladi
const adminIds = [5737309471, 523589911, 537750824];

// 1) Oddiy foydalanuvchi menyusi
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

// 2) Admin menyusi – adminlar uchun qo'shimcha "📢 Reklama" tugmasi
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
    }
    state.step = "get_name";
    await state.save();
    return bot.sendMessage(chatId, "👋 Iltimos, ismingiz va familiyangizni yuboring (masalan: Abdullayev John).");
});

// ===== ASOSIY MESSAGE HANDLER =====
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const state = await getOrCreateUserState(chatId);
    const isAdmin = adminIds.includes(msg.from.id);

    // Global "🔙 Ortga" tugmasi – asosiy menyuga qaytish (foydalanuvchi va admin uchun)
    if (text === "🔙 Ortga") {
        state.step = "main_menu";
        state.applicationData = {};
        state.feedbackMessages = [];
        await state.save();
        return bot.sendMessage(chatId, "Asosiy menyu:", getUserMenu(isAdmin));
    }

    // ==== ADMIN REKLAMA FUNKSIYASI ====
    // Agar admin "📢 Reklama" tugmasini bossagina, reklama xabarini qabul qilish uchun step "admin_waiting_ad" ga o‘tadi.
    if (isAdmin && text === "📢 Reklama") {
        state.step = "admin_waiting_ad";
        await state.save();
        return bot.sendMessage(chatId, "Iltimos, reklama xabaringizni yuboring. (Matn, rasm, video, forward bo‘lsa ham)");
    }
    // Agar admin "admin_waiting_ad" bosqichida bo‘lsa, yuborgan xabarini barcha foydalanuvchilarga copyMessage orqali jo‘natamiz.
    if (isAdmin && state.step === "admin_waiting_ad") {
        const allUsers = await UserState.find({}, "chatId");
        for (const user of allUsers) {
            try {
                const sentMsg = await bot.copyMessage(user.chatId, chatId, msg.message_id);
                // Har bir foydalanuvchi yozuviga yuborilgan reklama xabarlarining message_id sini qo‘shamiz
                user.adMessages.push(sentMsg.message_id);
                await user.save();
            } catch (err) {
                console.error(`Reklama xabarini chat ${user.chatId} ga yuborishda xatolik:`, err.message);
            }
        }
        state.step = "main_menu";
        await state.save();
        return bot.sendMessage(chatId, "✔ Reklama xabari barcha foydalanuvchilarga yuborildi.", getUserMenu(isAdmin));
    }

    // ==== FOYDALANUVCHI BUYRUQLARI ====
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
        const username = msg.from.username ? `@${msg.from.username}` : "(username mavjud emas)";
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

    // ==== ADMIN /broadcast HANDLER (oldingi /broadcast komandasi) ====
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
            return bot.sendMessage(chatId, "Xatolik: message_id raqam shaklida bo'lishi kerak.");
        }
        const channelChatId = process.env.REKLAMA_CHANNEL_CHAT_ID || "-1001316855543";
        const allUsers = await UserState.find({}, "chatId");
        allUsers.forEach((user) => {
            bot.forwardMessage(user.chatId, channelChatId, channelMessageId)
                .catch((error) => {
                    console.error(`Xabar yuborishda xatolik (chat: ${user.chatId}):`, error.message);
                });
        });
        return bot.sendMessage(chatId, "Reklama xabari barcha foydalanuvchilarga yuborildi.");
    }
});

// ==== ADMIN REKLAMA XABARLARINI O'CHIRISH (DELETE AD) ====
// Admin "/delete_ad" buyrug‘i orqali barcha foydalanuvchilarga yuborilgan reklama xabarlarini o'chiramiz.
bot.onText(/\/delete_ad/, async (msg) => {
    const chatId = msg.chat.id;
    if (!adminIds.includes(msg.from.id)) {
        return bot.sendMessage(chatId, "Sizga reklama xabarlarini o'chirish huquqi berilmagan.");
    }
    try {
        const users = await UserState.find({ adMessages: { $exists: true, $ne: [] } });
        let totalDeleted = 0;
        for (const user of users) {
            for (const adMsgId of user.adMessages) {
                try {
                    await bot.deleteMessage(user.chatId, adMsgId);
                    totalDeleted++;
                } catch (delErr) {
                    console.error(`Chat ${user.chatId} uchun reklama xabarini o'chirishda xatolik (message_id: ${adMsgId}):`, delErr.message);
                }
            }
            user.adMessages = [];
            await user.save();
        }
        bot.sendMessage(chatId, `Barcha foydalanuvchilardan ${totalDeleted} reklama xabari o'chirildi.`);
    } catch (err) {
        console.error("Reklama xabarlarini o'chirishda xatolik:", err.message);
        bot.sendMessage(chatId, "Reklama xabarlarini o'chirishda xatolik yuz berdi.");
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
            return bot.sendMessage(chatId, "Kanalga obuna bo'lishni tekshirishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    if (data === "check_balance") {
        try {
            const customer = await moysklad.findCustomerByCode(state.userCode);
            if (!customer) {
                await bot.answerCallbackQuery(query.id, { text: "❌ Kontragent topilmadi", show_alert: true });
                return;
            }
            const bonus = customer.bonusPoints || 0;
            const phone = customer.phone;
            const newCaption = `💳 Sizning jamg‘arma kartangiz\n💰 Bonus: ${bonus} ball\n📞 Telefon: ${phone}`;
            await bot.editMessageCaption(newCaption, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Balansni qayta tekshirish', callback_data: 'check_balance' }],
                    ]
                }
            });
            await bot.answerCallbackQuery(query.id, { text: "Balans yangilandi" });
        } catch (error) {
            if (error.response && error.response.description && error.response.description.includes("message is not modified")) {
                await bot.answerCallbackQuery(query.id, { text: "Balans hozirgi qiymatda" });
            } else {
                console.error("Balansni yangilashda xatolik:", error);
                await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
            }
        }
    }

    if (data === "branch_minor") {
        await bot.sendPhoto(
            chatId,
            "https://www.spot.uz/media/img/2020/12/3Z3MRs16070828252775_b.jpg",
            {
                caption: `<b>"Minor Mall"dagi fillialimiz.</b>\n\n<b>Manzil:</b> Bolalar kasalxonasi ro'parasidagi "Minor mall" 2-qavat\n<b>Ish vaqti:</b> 09:30-23:00\n\n<b>Telefon:</b> +998906376007\n<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
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
                caption: `<b>Zarafshon mehmonxonasi ro'parasidagi Buxoro kitoblar olamining 1-qavatida.</b>\n\n<b>Manzil:</b> Alisher Navoi Avenue, 5\n<b>Ish vaqti:</b> 09:00-22:00\n\n<b>Telefon:</b> +998906376007\n<b>Telegram:</b> <a href="https://t.me/faskids">Telegram</a>\n<b>Instagram:</b> <a href="https://instagram.com/faskids_uz">Instagram</a>`,
                parse_mode: "HTML"
            }
        );
        const kitoblarLatitude = 39.763188;
        const kitoblarLongitude = 64.425435;
        await bot.sendLocation(chatId, kitoblarLatitude, kitoblarLongitude);
        return bot.answerCallbackQuery(query.id);
    }
    // BONUSNI QAYTA TEKSHIRISH (CHECK BALANCE) – bonusHandler modulida alohida bajarilgan.
    // Biz eski /check_balance callbackini ham shu faylga qo'shmaymiz, chunki bonusHandler modulida alohida ishlanadi.
});