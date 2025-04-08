// services/moysklad.js
const axios = require('axios');
require('dotenv').config();

const MOYSKLAD_API = 'https://api.moysklad.ru/api/remap/1.2';
const headers = {
  Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`,
  'Content-Type': 'application/json',
};

module.exports = {
  async findCustomerByPhone(phone) {
    const res = await axios.get(`${MOYSKLAD_API}/entity/counterparty?filter=phone=${phone}`, { headers });
    return res.data.rows;
  },

  async createCustomer({ name, phone, code }) {
    const res = await axios.post(`${MOYSKLAD_API}/entity/counterparty`, {
      name,
      phone,
      code,
      tags: ['накопительный бонус'],
      attributes: [
        {
          meta: {
            href: `https://api.moysklad.ru/api/remap/1.2/entity/counterparty/metadata/attributes/${process.env.BONUS_FIELD_ID}`,
            type: 'attributemetadata',
            mediaType: 'application/json',
          },
          value: 0,
        },
      ],
      discountPrograms: [
        {
          meta: {
            href: `https://api.moysklad.ru/api/remap/1.2/entity/bonusprogram/65b3c335-dd5c-11ef-0a80-10d4000a19a3`,
            type: 'bonusprogram',
            mediaType: 'application/json',
          },
        },
      ],
    }, { headers });
    return res.data;
  },

  async findCustomerByCode(code) {
    const res = await axios.get(`${MOYSKLAD_API}/entity/counterparty?filter=code=${code}`, { headers });
    return res.data.rows[0];
  }
};
