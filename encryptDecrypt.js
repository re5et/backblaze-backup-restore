const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const password = process.env['BACKUP_RESTORE_PASSWORD'];

function encrypt(text){
  const cipher = crypto.createCipher(algorithm, password)
  const crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text){
  const decipher = crypto.createDecipher(algorithm, password)
  const dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

module.exports = {
  decrypt: decrypt,
  encrypt: encrypt,
  password: password,
  algorithm: algorithm,
  encryptFile: function(){
    return crypto.createCipher(algorithm, password);
  }
}
