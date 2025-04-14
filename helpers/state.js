// helpers/state.js
const UserState = require("../models/UserState");

async function getOrCreateUserState(chatId) {
  const state = await UserState.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { step: "main_menu" } },
    { new: true, upsert: true }
  );
  return state;
}

module.exports = { getOrCreateUserState };
