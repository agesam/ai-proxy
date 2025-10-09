// index_DENO用.js (Deno Deploy 伺服器端程式碼)

// URL Regex (與前端 AI.js 使用的最新版本相同)
const urlRegex = /(https?:\/\/[^\s]+?)(?=[^\w\s]*(\s|$))/gi;

// 輔助函式：獲取網頁標題
async function getPageTitle(url) {
    // 使用 try/catch 處理網路錯誤和超時
    try {
        const controller = new AbortController();
        // 設置 3 秒超時，防止單個無響應連結拖垮整個 API
        const timeoutId = setTimeout(() => controller.abort(), 3000); 
        
        // 限制只接受 HTML 內容
        const response = await fetch(url, { 
            signal: controller.signal, 
            headers: { 'Accept': 'text/html', 'User-Agent': 'Deno AI Proxy' } 
        });
        clearTimeout(timeoutId);

        if (!response.ok) return url; 

        // 讀取響應文本
        const html = await response.text();
        // 使用正則表達式從 HTML 中提取 <title> 標籤內容
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        
        if (titleMatch && titleMatch[1]) {
            // 返回 Markdown 格式的連結 [Title](URL)
            const title = titleMatch[1].trim().replace(/\s+/g, ' '); 
            
            // 由於 AI.js 前端是基於 Markdown 處理，我們返回 Markdown 格式
            return `[${title}](${url})`; 
        }

        return url; // 未找到標題，返回原始 URL
    } catch (error) {
        // console.error(`獲取標題失敗 (${url}):`, error.message); // 可以在 Deno Log 中查看錯誤
        return url; // 發生錯誤，返回原始 URL
    }
}

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
1. 盡可能只使用繁體中文及廣東話的語氣，使用適合兒童理解的詞彙和表達方式
2. 使用適合兒童的老師語氣，保持回答有趣，可多用emoji，吸引使用者注意力
3. 優先根據知識庫【早慧資料】內容來回答問題，當對話主題與【早慧資料】無關，要盡力引導用戶返回與【早慧資料】相關的話題
4. 不要編造或猜測任何資料中沒有的內容，可以適當擴展知識，但不要偏離核心內容。
5. 回答有關故事的內容時，要求用戶提供【級】【單元】【課】三樣中最少兩種資訊才能準確回答相關故事內容
    範例：
        「O1 L03」or「O1 單元1」or「單元1 L03」     
6. 在回答的結尾，如果與【動畫故事】的內容相關，可以禮貌地提示他們可以參考哪一個單元和故事
7. 當回應中有任何連結時，不要加入任何符號
    範例：
        **https://artgardenofeden.com.hk** <-- 錯誤
        (https://artgardenofeden.com.hk) <-- 錯誤
        https://artgardenofeden.com.hk <-- 正確
8. 當對話的主題與【圖庫】中的關鍵字有關聯，會在對話最後附上資料庫中的對照【圖片連結】
    範例： 
        https://artgardenofeden.com.hk/image/dolphin001.webp <-- 正確
        https://www.sog.edu.hk/uploads/image/202401/e2d3529a3827298b299feeedb4ec4bba.jpg <-- 正確
        https://www.sog.edu.hk/uploads/image/202401/e2d3529a3827298b299feeedb4ec4bba <-- 錯誤
9. 當回答涉及【早慧資料】中的結構化數據時，你必須使用標準的 **HTML TABLE** 標籤來呈現表格資料，並非使用Markdown語法構成表格。請確保使用 <thead>、<tbody>、<tr>、<th> 和 <td>來製作表格，而非|及---。
10. 在每個 <td> 標籤中，必須加入一個 **data-label** 屬性，其值等於該欄位的標題（<th>內容）。
    範例：
        <tr>
           <td>...</td>  <-- 錯誤
           <td data-label="課程名稱">早慧故事班</td> <-- 正確
        </tr>
11. 嚴禁討論任何與以下主題相關的內容：
    - 暴力、血腥或危險行為
    - 成人話題或不雅用語
    - 仇恨言論、歧視或霸凌
    - 涉及毒品、酒精或武器
    如果用戶的提問違反以上的規定，你必須禮貌地拒絕回答，並使用以下固定回覆：
    「小博士是專門討論知識和故事的喔！\n我們來聊點更有趣、更適合的話題吧！✨」
    
    以下是你的知識庫（JSON 格式）：
    早慧資料：\n${JSON.stringify(externalData)};`;
    
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
                ...conversation_history 
            ];

            // 5. 建構 OpenRouter 的完整請求體 (payload)
            const openrouterRequestPayload = {
                model: model || "openai/gpt-oss-20b:free", 
                messages: finalMessages,
                temperature: temperature || 0.6,
                max_tokens: max_tokens || 1500,
                // *** 【修改點 1】為實現連結標題替換，必須關閉串流 ***
                stream: false, 
            };
            
            const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

            const newRequest = new Request(openrouterUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(openrouterRequestPayload), 
            });

            // 6. 發送請求並等待完整的 JSON 響應
            const response = await fetch(newRequest);

            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'POST');
            newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            newHeaders.set('Content-Type', 'application/json'); // 確保回傳 JSON

            if (!response.ok) {
                // 如果 OpenRouter 返回錯誤，直接返回錯誤響應
                return new Response(response.body, { status: response.status, headers: newHeaders });
            }
            
            // 7. 讀取完整的 AI 響應 JSON
            const openrouterResponseJson = await response.json();
            let aiContent = openrouterResponseJson.choices[0].message.content;

            // 8. *** 【核心邏輯】處理 URL 轉標題 ***
            const urls = aiContent.match(urlRegex) || [];
            const uniqueUrls = [...new Set(urls)];

            // 並行獲取所有標題
            const titlePromises = uniqueUrls.map(url => getPageTitle(url));
            const replacements = await Promise.all(titlePromises);

            // 替換文本中的原始 URL 為帶有標題的 Markdown 連結
            for (let i = 0; i < uniqueUrls.length; i++) {
                // 替換時需要轉義特殊字符
                const regex = new RegExp(uniqueUrls[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                aiContent = aiContent.replace(regex, replacements[i]);
            }
            // *** 處理結束 ***

            // 9. 將處理後的內容放回 JSON 結構中
            openrouterResponseJson.choices[0].message.content = aiContent;

            // 10. 返回最終的 JSON 響應給前端
            return new Response(JSON.stringify(openrouterResponseJson), {
                status: 200,
                headers: newHeaders,
            });

        } catch (e) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
};
