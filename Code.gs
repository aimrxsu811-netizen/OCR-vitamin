// ==========================================
// 1. CONFIGURATION
// ==========================================
const props = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = props.getProperty("GEMINI_API_KEY"); 
const LIFF_ID = props.getProperty("LIFF_ID");

// ==========================================
// 2. WEB APP ENTRY
// ==========================================
function doGet(e) {
  try {
    const template = HtmlService.createTemplateFromFile("index");
    template.LIFF_ID = LIFF_ID;
    return template
      .evaluate()
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setTitle("Vitamin AI Scanner")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return ContentService.createTextOutput("System Error: " + error.message);
  }
}

// ==========================================
// 3. MAIN FUNCTION (Gemini Vision with Auto-Retry)
// ==========================================
function processVitaminOCR(base64Input) {
  
  if (typeof safeLog === 'function') safeLog("🚀 เริ่มต้นวิเคราะห์ภาพ...");
  
  if (!GEMINI_API_KEY) {
    return { status: "error", message: "ไม่พบ GEMINI_API_KEY ใน Script Properties" };
  }

  // --- 🔥 รายชื่อโมเดล (อัปเดตใหม่ตาม Log ของคุณ) ---
  const modelsToTry = [
    "gemini-2.0-flash-lite-001", // ตัวที่ 1: Lite (ประหยัดสุด)
    "gemini-2.0-flash",          // ตัวที่ 2: Flash 2.0 (ตัวใหม่ มีในบัญชีคุณแน่ๆ)
    "gemini-flash-latest",       // ตัวที่ 3: Flash Generic (ชื่อกลางๆ มักจะใช้ได้เสมอ)
    "gemini-1.5-pro"             // ตัวที่ 4: Pro (ไม้ตายสุดท้าย)
  ];

  // --- Clean Base64 ---
  var cleanBase64 = base64Input;
  if (base64Input.indexOf("base64,") > -1) {
    cleanBase64 = base64Input.split("base64,")[1];
  }

  // วนลูปเพื่อลองโมเดลทีละตัว
  for (var i = 0; i < modelsToTry.length; i++) {
    var modelName = modelsToTry[i];
    
    try {
      if (typeof safeLog === 'function') safeLog(`🔄 กำลังลองใช้โมเดล: ${modelName} ...`);
      
      // เรียก API
      var result = callGeminiAPI(modelName, cleanBase64);
      
      // ถ้าสำเร็จ
      if (typeof safeLog === 'function') safeLog(`✅ สำเร็จด้วยโมเดล: ${modelName}`);
      return { status: "success", result: result };
      
    } catch (err) {
      // Log Error
      if (typeof safeLog === 'function') safeLog(`⚠️ โมเดล ${modelName} ล้มเหลว: ${err.message}`);
      
      // ถ้าเจอปัญหา Quota (429) ให้พักแป๊บนึงก่อนลองตัวถัดไป (1 วินาที)
      if (err.message.includes("429")) {
        Utilities.sleep(1000); 
      }

      // ถ้าเป็นตัวสุดท้ายแล้วยังไม่ได้อีก
      if (i === modelsToTry.length - 1) {
         return { status: "error", message: "ระบบ AI กำลังทำงานหนัก (Quota เต็มชั่วคราว) กรุณารอสักครู่ (1 นาที) แล้วลองใหม่อีกครั้งครับ" };
      }
    }
  }
}

// ฟังก์ชันย่อยสำหรับยิง API
function callGeminiAPI(modelName, base64Image) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  
  const promptText = `
คุณคือเภสัชกร AI อัจฉริยะ หน้าที่คือวิเคราะห์รูปภาพฉลากผลิตภัณฑ์
1. อ่านข้อความทั้งหมดในภาพ (OCR)
2. วิเคราะห์ว่าเป็น "วิตามิน/อาหารเสริม" หรือไม่

เงื่อนไขการตอบ:
- ถ้า **ไม่ใช่** วิตามิน/อาหารเสริม ให้ตอบสั้นๆ ว่า "❌ ภาพนี้ไม่ใช่วิตามินหรืออาหารเสริมครับ"
- ถ้า **ใช่** ให้สรุปข้อมูลเป็น HTML Format ที่สวยงาม (ไม่ต้องมี tag <html> หรือ <body>) ดังนี้:
  <h3>[ใส่ชื่อผลิตภัณฑ์]</h3>
  <ul>
    <li><b>สารอาหารหลัก:</b> ...</li>
    <li><b>สรรพคุณ:</b> ...</li>
    <li><b>วิธีรับประทาน:</b> ...</li>
    <li><b>⚠️ ข้อควรระวัง:</b> ...</li>
  </ul>
`;

  const payload = {
    "contents": [{
      "parts": [
        { "text": promptText },
        { "inline_data": { "mime_type": "image/jpeg", "data": base64Image } }
      ]
    }]
  };

  const options = {
    "method": "post",
    "headers": { "Content-Type": "application/json" },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    // โยน Error พร้อม Code เพื่อให้ Loop ข้างบนจับได้
    throw new Error(`Code ${responseCode}: ${responseText}`);
  }

  const json = JSON.parse(responseText);
  if (!json.candidates || json.candidates.length === 0) {
    throw new Error("AI ไม่ตอบกลับ");
  }

  return json.candidates[0].content.parts[0].text;
}
