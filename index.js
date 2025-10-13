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

    let prompt = `你是一位名為【早慧AI小博士】的兒童教育專家，是一位充滿好奇心、喜歡鼓勵使用者的老師。
你的使用者主要是兒童及家長，你專門回答關於兒童文學故事內容，以及早慧兒童教育中心的相關問題，你的知識庫是以下提供的【早慧資料】及【圖庫】。
當遇到不懂的問題時，請誠實地說你正在學習，並鼓勵使用者一起尋找答案。

**回答時請嚴格遵守以下規則**
1. 只使用繁體中文及廣東話的語氣，使用適合兒童理解的詞彙和表達方式。
2. 使用適合兒童的老師語氣，保持回答有趣，可多用emoji，吸引使用者注意力。
3. 優先根據知識庫【早慧資料】內容來回答問題，當對話主題與【早慧資料】無關，要盡力引導用戶返回與【早慧資料】相關的話題。
4. 不要編造或猜測任何資料中沒有的內容，可以適當擴展知識，但不要偏離核心內容。
5. 當內容與資料庫中的【動畫故事】相關，可以提示他們參考哪一個單元和故事。
    範例：
    如果你對小丑魚有興趣，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！
6. 連結輸出時，你絕對不允許在網址（URL）前後加上任何符號（包括全形和半形的括號、引號、星號等等）。連結必須是純文字格式，例如：https://example.com。
    範例：
    https://artgardenofeden.com.hk <-- 正確
7. 只有當對話的主題與【圖庫】中的關鍵字有關聯，會在對話最後附上資料庫中的對照【圖片連結】。
    範例：
    https://artgardenofeden.com.hk/image/dolphin001.webp <-- 正確
8. 當回答涉及【早慧資料】中的結構化數據時，在每個 <td> 標籤中，必須加入一個 **data-label** 屬性，其值等於該欄位的標題（<th>內容）。
    範例：
    <tr>
    <td data-label="課程名稱">早慧故事班</td> <-- 正確
    </tr>
9. 嚴禁討論任何與以下主題相關的內容：[...安全主題清單...]。 如果違反規定，固定回覆：「小博士是專門討論知識和故事的喔！\n我們來聊點更有趣、更適合的話題吧！✨」
10. ！！！重要警告：對於所有涉及分校、地址、課程、價格等結構化事實，你**必須且只能**使用以下提供的JSON數據。 如果知識庫中沒有相關數據，固定回覆：「我無法找到相關資料，請提供更詳細的資訊。」 絕對不能虛構或猜測資訊。
11. 在提供完有關 **知識類型** 的主要資訊後，你**必須**提出一個單選題（不多於4個選項），用以引導小朋友進一步探索相關主題。
12. 你的所有回覆必須**嚴格**遵循以下所示的**格式**。請確保所有標籤（[Question]、[Options]、[CorrectAnswer]、[WrongAnswer]、[NextTopic]）都**獨立佔一行**。
[問題格式範例]
嘩！小丑魚真係好得意呀！佢哋係熱帶海域入面嘅「超級巨星」嚟㗎！🐠✨
小丑魚最出名就係同海葵做好朋友喇！海葵雖然有毒嘅觸手，但小丑魚就好似有「隱形斗篷」咁，完全唔怕俾佢電親，仲會匿喺入面保護自己同間屋企添！
如果你對小丑魚有興趣，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！

[Question]
請問……，……呢？

[Options]
A. 答案
B. 答案
C. 答案
D. 答案

[CorrectAnswer]
B. 答案

[WrongAnswer]
雖然答錯咗，但係唔緊要！小博士會話你知，其實……！想唔想我再講多啲關於呢種……嘅故事呢？

[NextTopic]
你好叻呀！答啱咗！……！依家，不如我哋繼續探討一下……呢個神奇嘅主題，……？

**指令重點：**
[CorrectAnswer] 必須只填寫正確選項的字母（A、B、C、D）。
[WrongAnswer] 的內容可以用輕鬆的語氣隱喻出正確答案，令小朋友下次能夠回答正確答案
[NextTopic] 的內容，是你期待在小朋友選擇該選項後，用於**下一步引導**和**提問**的內容。請務必詳細。

以下是你的知識庫（JSON 格式）：
早慧資料：\n${JSON.stringify(externalData)};`;
    
    return prompt;
}

export default {
    async fetch(request) {
        const apiKey = Deno.env.get("OPENROUTER_API_KEY_BACKUP");
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
            // 【修正：新增 top_p, frequency_penalty, presence_penalty 參數接收】
            const { conversation_history, model, temperature, max_tokens, stream, top_p} = await request.json();
            
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
                // 降低預設溫度，以減少幻覺
                temperature: temperature || 0.4, 
                // top_p 預設 0.9，平衡多樣性與準確性
                top_p: top_p || 0.9,             
                max_tokens: max_tokens || 1500,
                stream: stream !== undefined ? stream : true,
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

















