// index_DENO用.js (Deno Deploy 伺服器端程式碼)

// 外部載入資料函式 - 在伺服器端獲取資料
async function loadExternalData() {
    // 這是您的 Google Apps Script URL，現在在後端執行
    const apiURL = "https://script.google.com/macros/s/AKfycbw1D1AKlVr_iaArk-JkxN0YZ-NjyyxMgH-h-CatrFrprJXaSSxSsc2YZROaBxapPTEZeg/exec"; 
    try {
        const response = await fetch(apiURL);
        if (!response.ok) {
            // 拋出 HTTP 錯誤
            throw new Error(`HTTP error! 狀態碼: ${response.status} (${response.statusText})`);
        } 
        const allSheetsData = await response.json(); 	
        let combinedData = [];
        for (const sheetName in allSheetsData) {
            if (Object.prototype.hasOwnProperty.call(allSheetsData, sheetName)) {
                combinedData = combinedData.concat(allSheetsData[sheetName]);
            }
        }	
        return combinedData;
    } catch (error) {
        console.error('伺服器載入外部知識庫時發生錯誤:', error);
        // 如果載入失敗，我們拋出錯誤，讓前端知道
        throw new Error('伺服器無法載入外部知識庫。');
    }
}

// 核心邏輯：生成 systemPrompt
function buildSystemPrompt(externalData, conversationHistory) {

    let prompt = `SYSTEM ROLE: 早慧AI小博士 — 指示（請務必精確遵守）

身份與目標：
你是「早慧AI小博士」，一位以兒童與家長為對象的教育型對話助理。你的任務是以安全、鼓勵、淺顯的方式回答關於兒童文學與早慧兒童教育中心之問題，並協助使用者學習。

語言與風格：
- 僅使用繁體中文（除非使用者要求其他語言）。
- 語氣為鼓勵、友善且專業，適合兒童閱讀；可以使用 emoji 來增進親和力。
- **不可**在回答開頭加入問候語（例如「哈囉」）。

資料來源與優先順序：
- 主要依據系統注入之「早慧資料」與「圖庫」回答。若資料能直接支援答案，請引用並指出對應單元/章節（若有）。
- 若問題不在知識庫範圍內，誠實說明：輸出「我正在學習，讓我們一起找答案」並提供 1~2 個可行的查證步驟（例如查詢哪個網頁或詢問哪位老師）。

輸出格式（必須遵守）：
1. **使用者可讀段落（人類顯示）** — 簡潔、100~150字以內（遇必要可稍長），結尾可加一行建議或參考。
2. 若回應含 **結構化表格**（分校 / 課程等），**必須**以 HTML <table> 格式輸出，包含 <thead>、<tbody>。**每個 <td> 必須包含 data-label 屬性**，其值與對應 <th> 的文字一致。
3. 若回應與 **圖庫關鍵字** 相關，於回應 **末行** 單獨列出對應圖檔 URL（每個 URL 各一行），且**該行僅包含 URL，無任何標點或文字**。
4. 網址輸出規範：只輸出純網址（例：https://artgardenofeden.com.hk/image/dolphin001.webp），不得被任何符號包圍。

內容限制（必須執行）：
- 禁止生成或協助任何暴力、成人、不雅、仇恨、毒品、武器等相關內容。
- 若使用者要求違反上述內容，請回覆固定拒絕語句：
  「小博士是專門討論知識和故事的喔！
   我們來聊點更有趣、更適合小朋友的話題吧！✨」

輸出穩定性建議（建議在伺服端加入檢核）：
- 伺服端應檢查回應末行是否為有效 JSON（若預期 quiz），並在解析失敗時回傳錯誤提示給模型以重試。
- 伺服端應檢查 HTML table 是否具有 <thead> 與 <tbody>，並確保每個 <td> 有 data-label 屬性。
- 若輸出包含 URL，伺服端可用正規表達式確認該行僅為純 URL。

錯誤與不可知處理：
- 不知道答案時，請誠實說明並給出可行的下一步（例如：「我不確定，建議向 XXX 查詢或參考 YYY」。）
- 永遠不要胡亂猜測或捏造數據。

附：若需示例輸出格式，請直接回覆「要示例」，我會以範例展示。
`;
    
    return prompt;
}

export default {
    async fetch(request) {
        const apiKey = Deno.env.get("OPENROUTER_API_KEY");
        if (!apiKey) {
            return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        if (request.method !== 'POST') {
            return new Response('NOTHING HERE', { status: 405 });
        }

        try {
            // 1. 接收前端傳來的簡化資料
            const { conversation_history, model, temperature, max_tokens, stream } = await request.json();
            
            // 2. 伺服器端載入外部資料
            const externalData = await loadExternalData();

            // 3. 伺服器端建構 systemPrompt
            const systemPromptContent = buildSystemPrompt(externalData, conversation_history);
            
            // 4. 建構最終要傳給 OpenRouter 的 messages 陣列
            const finalMessages = [
                { role: "system", content: systemPromptContent },
                ...conversation_history // 將歷史訊息展開
            ];

            // 5. 建構 OpenRouter 的完整請求體 (payload)
            const openrouterRequestPayload = {
                // 使用前端傳來的 model 名稱，若無則使用預設
                model: model || "openai/gpt-oss-20b:free", 
                messages: finalMessages,
                temperature: temperature || 0.6,
                max_tokens: max_tokens || 500,
                stream: stream !== undefined ? stream : true,
                zdr: false,
            };
            
            const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

            const newRequest = new Request(openrouterUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(openrouterRequestPayload), // 傳送伺服器建構的 payload
            });

            const response = await fetch(newRequest);

            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'POST');
            newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });

        } catch (e) {
            // 捕捉載入資料和請求 API 的錯誤，並返回給前端
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
};



