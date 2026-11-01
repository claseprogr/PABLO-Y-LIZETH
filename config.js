// Configuración de la conexión con la base de datos (Supabase).
// Estos dos valores son PÚBLICOS por diseño: la seguridad está en la base de datos.
// Se pegan desde Supabase > Project Settings > API (ver README, paso 3).
window.APP_CONFIG = {
  SUPABASE_URL: 'https://akduwvptdtfxkirceuhv.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZHV3dnB0ZHRmeGtpcmNldWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjkwNzcsImV4cCI6MjEwOTE0NTA3N30.TRla0m9t_4tL1SG0Toi100EBU95GK3TFQlsug7eXFs4',

  // Mensaje que se abre en WhatsApp desde el panel. {nombre} y {enlace} se reemplazan solos.
  WHATSAPP_MESSAGE: 'Hola {nombre}, con mucho cariño los invitamos a nuestra boda, Pablo y Lizeth. Aquí está su invitación personal: {enlace}'
};
