const sharp = require('sharp');
const path = require('path');

const input = path.join(__dirname, 'client', 'public', 'logo.png');
const icoOutput = path.join(__dirname, 'client', 'public', 'favicon.ico');
const appleOutput = path.join(__dirname, 'client', 'public', 'apple-touch-icon.png');

sharp(input)
  .resize(32, 32, { fit: 'cover' })
  .toFile(icoOutput)
  .then(() => console.log('favicon created'))
  .catch(err => console.error(err));

sharp(input)
  .resize(180, 180, { fit: 'cover' })
  .toFile(appleOutput)
  .then(() => console.log('apple-touch-icon created'))
  .catch(err => console.error(err));
