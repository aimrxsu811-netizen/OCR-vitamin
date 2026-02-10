// ==========================================
// LOGGING CONFIGURATION
// ==========================================
const LOG_SHEET_ID = "1dr7oWK2OwgrDJ39dBm-OhG28CAlmclVqsMQzolXWpsg"; 

// ==========================================
// LOGGING FUNCTION (Safe Mode)
// ==========================================
function safeLog(message) {
  try {
    // 1. ลง Log ในระบบ Apps Script ก่อน
    Logger.log(message);
    
    // 2. พยายามลง Log ใน Google Sheet (ถ้ามี Library)
    if (typeof BetterLog !== 'undefined') {
      BetterLog.useSpreadsheet(LOG_SHEET_ID).info(message);
    }
  } catch (e) {
    Logger.log("⚠️ Log Error: " + e.toString());
  }
}
