// utils/barcode.js
const bwipjs = require('bwip-js');
const fs = require('fs');

module.exports = async function generateBarcode(phone, code) {
  const barcodePath = `./barcodes/${code}.png`;
  if (fs.existsSync(barcodePath)) return barcodePath;

  if (!fs.existsSync('./barcodes')) fs.mkdirSync('./barcodes');

  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: phone,
    scale: 4,
    height: 40,
    includetext: true,
    textxalign: 'center',
    textsize: 15,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 20,
    paddingheight: 20,
  });

  fs.writeFileSync(barcodePath, png);
  return barcodePath;
};
