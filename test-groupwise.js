const imaps = require('imap-simple');

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
};

const config = {
  imap: {
    user: required('IMAP_USERNAME'),
    password: required('IMAP_PASSWORD'),
    host: required('IMAP_HOST'),
    port: Number(process.env.IMAP_PORT || 993),
    tls: process.env.IMAP_TLS !== 'false',
    authTimeout: 30000,
  },
};

console.log('Probando conexión a GroupWise...');
imaps
  .connect(config)
  .then((connection) => {
    console.log('✅ Conectado!');
    return connection.openBox('INBOX');
  })
  .then(() => {
    console.log('✅ Bandeja abierta correctamente');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    console.error('Código:', err.code);
    process.exit(1);
  });
