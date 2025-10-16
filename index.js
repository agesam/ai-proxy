// index_DENO用.js (Deno Deploy 伺服器端程式碼)

// -----------------------------------------------------------------------
// 外部載入資料函式
// -----------------------------------------------------------------------

async function loadExternalData() {
    const apiURL = "https://script.google.com/macros/s/AKfycbw1D1AKlVr_iaArk-JkxN0YZ-NjyyxMgH-h-CatrFrprJXaSSxSsc2YZROaBxapPTEZeg/exec"; 
    try {
        const response = await fetch(apiURL);
        if (!response.ok) {
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
        throw new Error('伺服器無法載入外部知識庫。');
    }
}


// -----------------------------------------------------------------------
// 資料格式化函式 (將 JSON 轉換為帶標籤的純文本，命名為「早慧資料庫」)
// -----------------------------------------------------------------------

function formatCourseData(combinedData) {
    if (!combinedData || combinedData.length === 0) {
        return "\n\n【早慧資料庫開始】\n【早慧資料庫結束】\n\n";
    }

    let formattedText = "\n\n【早慧資料庫開始】\n";
    
    combinedData.forEach((item, index) => {
        formattedText += `--- 記錄 #${index + 1} ---\n`;
        
        for (const key in item) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                const value = (item[key] || 'N/A').toString().replace(/【|】/g, ''); 
                formattedText += `【${key}】: ${value}\n`;
            }
        }
        formattedText += '------------------\n';
    });
    
    formattedText += "【早慧資料庫結束】\n\n";
    return formattedText;
}


// -----------------------------------------------------------------------
// 核心邏輯：生成 systemPrompt
// -----------------------------------------------------------------------

function buildSystemPrompt(formattedData) {

    let prompt = `你是一位名為【**早慧AI小博士**】的兒童教育專家，是一位充滿好奇心、喜歡鼓勵使用者的老師。
你的使用者主要是兒童及家長，你專門回答關於兒童文學故事內容，以及早慧兒童教育中心的相關問題，你的知識庫是以下提供【早慧資料庫】的純文本數據。

當遇到不懂的問題時，請誠實地說你正在學習並提出疑問，鼓勵使用者一起尋找答案，絕對不能虛構或猜測資訊。

【資料庫格式說明】
你將在本次對話的開頭收到一個**帶有明確標籤的純文本資料庫**，名為【早慧資料庫】。每個數據點都以 **【欄位標籤】: 內容** 的格式顯示。
範例：
【故事名稱】: 《小墨魚和海馬》
【內容】: 探討外表與本質的差異...
請利用這些標籤來準確識別和檢索你需要的資訊。

【回答時請嚴格遵守以下規則】
1. 任何情況下都只使用繁體中文及廣東話的語氣，使用適合兒童理解的詞彙和表達方式。
2. 使用適合兒童的老師語氣，保持回答有趣，可多用emoji及「」來吸引使用者注意力。
3. **優先根據知識庫【早慧資料庫】的內容來回答問題**。當對話主題與【早慧資料庫】無關時，要盡力引導用戶返回與資料庫相關的話題，例如：【如果想知道有**小丑魚**更多的小知識，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！】。
4. 不要編造或猜測任何資料中沒有的內容，可以適當擴展知識，但不要偏離核心內容，並與使用者說明資料可能有誤，最理想可以提供參考資料的連結。
5. 當內容與資料庫中的【動畫故事】相關，可以提示他們參考哪一個單元和故事。
    範例：
    如果你對小丑魚有興趣，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！
6. 盡可能就只使用【Markdown語法】，或使用【HTML語法】。
7. 只有當對話的主題與資料庫中的【圖庫】中的關鍵字有關聯，會在對話最後附上資料庫中使用【Markdown語法】或【HTML語法】的相應【圖片連結】。
    範例：
    <img>https://artgardenofeden.com.hk/image/clownfish001.webp</img> <-- 正確
    ![小丑魚](https://artgardenofeden.com.hk/image/clownfish001.webp) <-- 正確
8. **表格輸出：** 當回答涉及【早慧資料庫】中的結構化數據時，請優先使用【Markdown語法】建構出表格。
9. 如試用【HTML語法表格】，請在每個 <td> 標籤中，必須加入一個 【data-label】 屬性，其值等於該欄位的標題（<th>內容）。
    範例：
    <tr>
    <td data-label="課程名稱">早慧故事班</td> <-- 正確
    </tr>
10. 嚴禁討論或提供任何與以下主題相關的內容：
【人身安全/暴力】、【不當內容】、【個人隱私】、【誤導資訊/系統濫用】。
如果用戶的輸入或要求觸及上述任何規定，【必須】固定回覆以下句子，【不加入任何額外解釋】：
「小博士是專門討論知識和故事的喔！\n我們來聊點更有趣、更適合的話題吧！✨」

---
**【回答格式要求 (ReAct & 單選題)】**

**當使用者的提問與【早慧資料庫】相關時，在提供完有關的主要資訊後，你【必須】提出一個單選題（不多於4個選項）**，用以引導使用者進一步探索相關主題。

**請在你的主要回答前面，先進行思考步驟，然後再給出最終回覆。**

**[思考]** 我會分析用戶的提問。如果用戶詢問了特定的課程、級別、單元或故事名稱，我會嘗試在**【早慧資料庫】**中查找相關的記錄。
**[行動]** 執行資料庫查詢（例如：在資料庫中搜尋包含「O1」和「故事名稱」的記錄）。
**[回覆]** 根據「行動」的結果，生成最終給用戶的回答，並在後面附上單選題。

**【🚨格式強制規範：絕對不可變動🚨】**
**請將以下標籤視為**不可協商的程式碼標籤**。**
**這是前端程式解析的唯一依據，任何 Markdown 列表格式 (例如：1. 選項) 代替標籤，都將導致介面崩潰。**

**【⛔️格式淨化：絕對禁止額外文字⛔️】**
**嚴禁**在 [Question] 標籤**前面**或**任何標籤之間**加入任何額外的**標題、前言、分隔線、Emoji** 或 **提示語**。
單選題部分**必須**以 [Question] 作為**第一行**標籤開始！

**【單選題輸出樣板（必須完全遵循）】**
請確保所有標籤 ( [Question]、[Options]、[CorrectAnswer]、[WrongAnswer]、[NextTopic] ) 都【獨立佔一行】且【不包含任何額外字符】。

[Question]
請問……，……呢？

[Options]
A. 答案
B. 答案
C. 答案
D. 答案

[CorrectAnswer]
B

[WrongAnswer]
雖然答錯咗，但係唔緊要！小博士會話你知，其實……！想唔想我再講多啲關於呢種「……」嘅故事呢？

[NextTopic]
你好叻呀！答啱咗！「……」！依家，不如我哋繼續探討一下「……」呢個嘅主題？

---
${formattedData}`; 
    
    return prompt;
}


// -----------------------------------------------------------------------
// 新增：加強版串流過濾與錯誤處理函數 (解決前端 TypeError)
// -----------------------------------------------------------------------

function streamFilter(originalStream) {
    const decoder = new TextDecoder("utf-8");
    const encoder = new TextEncoder();
    let buffer = ""; 

    const transformStream = new TransformStream({
        transform(chunk, controller) {
            buffer += decoder.decode(chunk);

            const lines = buffer.split('\n');
            buffer = lines.pop() || ""; 

            for (const line of lines) {
                if (line.trim() === "") continue; 
                
                if (line.startsWith("data:")) {
                    const dataContent = line.substring(5).trim();
                    
                    if (dataContent === '[DONE]') {
                        controller.enqueue(encoder.encode(line + '\n'));
                        continue; 
                    }
                    
                    try {
                        const json = JSON.parse(dataContent);
                        
                        // 【關鍵修復】：檢查是否為 OpenRouter 錯誤物件
                        if (json.error) {
                            console.error("OpenRouter/Provider Error Detected:", json.error.message, "Code:", json.error.code);
                            
                            // 1. 構建友好的錯誤訊息
                            const providerName = json.error.metadata?.provider_name || '未知';
                            const errorMessage = `【錯誤通知】服務供應商錯誤 (${json.error.code} - ${providerName}): ${json.error.message}。小博士暫時未能回應，請稍後再試。`;
                            
                            // 2. 構建一個前端 AI.js 預期格式的合成錯誤 Chunk
                            // 這樣 AI.js 就不會因為缺少 choices[0] 而崩潰
                            const syntheticChunk = {
                                choices: [{
                                    index: 0,
                                    delta: { content: errorMessage },
                                    finish_reason: "stop" 
                                }]
                            };

                            // 3. 轉發合成錯誤 Chunk
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(syntheticChunk)}\n`));
                            
                            // 4. 轉發 [DONE] 標記
                            controller.enqueue(encoder.encode("data: [DONE]\n"));
                            
                            // 5. 立即終止串流，不再處理後續數據
                            controller.terminate(); 
                            return;
                        }

                        // 正常數據區塊 (有 choices/delta 內容)
                        if (json.choices && json.choices.length > 0) {
                             controller.enqueue(encoder.encode(line + '\n'));
                        } 

                    } catch (e) {
                        // 處理 JSON 解析失敗，避免串流中斷
                        console.error("Deno 串流解析 JSON 失敗:", e.message, "Line:", line);
                    }
                } else {
                    // 忽略非 data: 開頭的行 (例如 OPENROUTER PROCESSING)
                    console.warn("Deno 過濾掉非標準串流行:", line);
                }
            }
        },
        flush(controller) {
            if (buffer) {
                console.warn("Deno 串流結束時有剩餘緩衝:", buffer);
            }
        }
    });

    return originalStream.pipeThrough(transformStream);
}


// -----------------------------------------------------------------------
// Deno 核心服務邏輯
// -----------------------------------------------------------------------
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
            const { conversation_history, model, temperature, max_tokens, stream, top_p } = await request.json();
            
            const externalData = await loadExternalData(); 
            const formattedData = formatCourseData(externalData);

            const finalSystemPrompt = buildSystemPrompt(formattedData);
            
            const systemMessage = { role: "system", content: finalSystemPrompt };
            const finalMessages = [
                systemMessage, 
                ...conversation_history 
            ];

            const openrouterRequestPayload = {
                model: model || "openai/gpt-oss-20b:free",
                messages: finalMessages, 
                temperature: temperature || 0.4,
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
                body: JSON.stringify(openrouterRequestPayload), 
            });

            const response = await fetch(newRequest);

            // 處理 CORS Headers
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'POST');
            newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            // 【關鍵處】：將原始串流通過加強版過濾器
            const filteredStream = response.body ? streamFilter(response.body) : null;

            return new Response(filteredStream, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });

        } catch (e) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
};
