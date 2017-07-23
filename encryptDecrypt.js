require('dotenv').config();
const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const password = process.env['BACKUP_RESTORE_PASSWORD'];

function createCipher(){
  return crypto.createCipher(algorithm, password);
}

function createDecipher(){
  return crypto.createDecipher(algorithm, password)
}

function encrypt(text){
  const cipher = createCipher();
  let crypted = cipher.update(text,'utf8','hex');
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text){
  const decipher = createDecipher();
  let dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = {
  decrypt: decrypt,
  encrypt: encrypt,
  password: password,
  algorithm: algorithm,
  createCipher: createCipher,
  createDecipher: createDecipher
}
