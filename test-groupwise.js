const imaps = require('imap-simple');

const config = {
  imap: {
    user: 'sistemas3',
    password: 'As3c0n2026i#',
    host: '192.168.8.201',
    port: 143,
    tls: false,
    authTimeout: 30000,
  },
};

console.log('Probando conexión a GroupWise...');
imaps.connect(config)
  .then(connection => {
    console.log('✅ Conectado!');
    return connection.openBox('INBOX');
  })
  .then(() => {
    console.log('✅ Bandeja abierta correctamente');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error('Código:', err.code);
    process.exit(1);
  });