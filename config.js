// ============================================================
// CONFIGURACIÓN DE CORREO (para enviar el código de verificación)
// ============================================================
// Si usas Gmail:
// 1. Activa la verificación en 2 pasos en tu cuenta de Google:
//    https://myaccount.google.com/security
// 2. Genera una "Contraseña de aplicación" aquí:
//    https://myaccount.google.com/apppasswords
//    (elige "Otra" y ponle un nombre, por ejemplo "Vapos Web")
// 3. Copia esa contraseña de 16 letras en SMTP_PASS (NO tu contraseña normal de Gmail)
// ============================================================
 
module.exports = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 587,
  SMTP_USER: 'diegoyt102@gmail.com',
  SMTP_PASS: 'aigr qyka ttoi yneb',
  SMTP_FROM: 'Vapos Web <diegoyt102@gmail.com>'
};