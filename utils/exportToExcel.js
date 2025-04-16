// utils/exportToExcel.js
const ExcelJS = require("exceljs");

async function exportUsersToExcel(usersWithBonus) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Users");

  worksheet.columns = [
    { header: "Ism/Familiya", key: "fullName", width: 30 },
    { header: "Telefon", key: "phone", width: 20 },
    { header: "Bonus", key: "bonus", width: 15 },
  ];

  usersWithBonus.forEach((user) => {
    worksheet.addRow({
      fullName: user.fullName || "",
      phone: user.phone || "",
      bonus: user.bonus || 0,
    });
  });

  const filePath = "./users_bonus_export.xlsx";
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = exportUsersToExcel;
