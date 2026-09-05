// Quick Telegram test — run with: node scripts/testTelegram.js
import TelegramBot from 'node-telegram-bot-api';

const TOKEN = '8777584262:AAHIojHpXachWLlcTH72OL6ccMZ2bngq-OI';
const CHAT_ID = '1935101763';

const bot = new TelegramBot(TOKEN, { polling: false });

try {
  const result = await bot.sendMessage(CHAT_ID, `✅ <b>DZ Arbitrage Monitor — Connection Test</b>\n\n🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' })}\n\nTelegram bot is working correctly!`, { parse_mode: 'HTML' });
  console.log('✅ Message sent successfully! Message ID:', result.message_id);
} catch (err) {
  console.error('❌ Failed to send message:', err.message);
}
