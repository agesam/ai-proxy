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

async function loadExternalmaterialData() {
    // 這是您的 Google Apps Script URL，現在在後端執行
    const apiURL = "https://script.google.com/macros/s/AKfycbwCZLvFcqYvPFrBZJIrml5XdLsq3VNGCP9SK2DJfphYY53w5mGA2vdoa2v7EcasqIUJ/exec"; 
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
function buildSystemPrompt(externalData, externalmaterialData, promptMode) {
 	// 【模式選擇】
    let selectedPromptTemplate;
    
	const COMMON_RULES_AND_SAFETY = `
6. 當處理「圖片」「連結」等需要加入語法的資料時，請使用【Markdown語法】為主。
7. 只有當對話的主題與JSON數據的【圖庫】中的關鍵字有關聯，會在對話最後附上資料庫中使用【Markdown語法】或【HTML語法】的相應【圖片連結】。
    範例：
    <img>https://artgardenofeden.com.hk/image/clownfish001.webp</img> <-- 正確
    ![小丑魚](https://artgardenofeden.com.hk/image/clownfish001.webp) <-- 正確
8. 當回答涉及結構化數據時，請使用【Markdown語法】或使用【HTML語法】建構出表格。
9. 如試用【HTML語法表格】，請在每個 <td> 標籤中，必須加入一個 【data-label】 屬性，其值等於該欄位的標題（<th>內容）。
    範例：
    <tr>
    <td data-label="課程名稱">早慧故事班</td> <-- 正確
    </tr>
10. 嚴禁討論或提供任何與以下主題相關的內容：
【人身安全/暴力】(自殺、自殘、任何形式的暴力、非法活動、危險挑戰、毒品、槍械)；
【不當內容】(性、色情、成人內容、仇恨言論、歧視、霸凌、粗口、血腥恐怖)；
【個人隱私】(真實姓名、住址、電話、電郵等個人身份資訊 PII，不論是詢問或分享)；
【誤導資訊/系統濫用】(醫療/法律建議、惡意謠言、試圖操縱系統或繞過規則)。

以下是你的知識庫（JSON 格式）：
早慧資料：\n${JSON.stringify(externalData)};
動畫教材資料：\n${JSON.stringify(externalmaterialData)};`;

		const QUSETION_TEMPLATE = `【提供相關的主要資訊後】，你可以提出一個單選題（不多於4個選項），用以引導使用者進一步探索相關主題。
** 你的提問【絕對不可以】是開放式問題 **
---
**【🚨格式強制規範：絕對不可變動🚨】**
**請將以下標籤視為**不可協商的程式碼標籤**。**
**這是前端程式解析的唯一依據，任何 Markdown 列表格式 (例如：1. 選項) 代替標籤，都將導致介面崩潰。**

**【⛔️格式淨化：絕對禁止額外文字⛔️】**
**嚴禁**在 [Question] 標籤**前面**或**任何標籤之間**加入任何額外的**標題、前言、分隔線、Emoji** 或 **提示語**（例如："---"、"###"、🚀單選題、"**問題**："、"**選項**"、"你的選擇" 等）。
單選題部分**必須**以 [Question] 作為**第一行**標籤開始！

**【單選題輸出樣板（必須完全遵循）】**
請確保所有標籤 ( [Question]、[Options]、[CorrectAnswer]、[WrongAnswer]、[NextTopic] ) 都【獨立佔一行】且【不包含任何額外字符】。

\n\n[Question]
請問……，……呢？

[Options]
A. 答案
B. 答案
C. 答案
D. 答案

[CorrectAnswer]
**【指令重點：】**
必須只填寫正確選項的字母（A、B、C、D）。
B

[WrongAnswer]
**【指令重點：】**
內容：用輕鬆的語氣隱喻出正確答案，令使用者下次能夠回答正確答案

[NextTopic]
**【指令重點：】**
內容：稱讚使用者選擇出你期待的該選項後，用於【下一步引導】和【提問】的內容。請務必詳細。

`;

    // 【家長模式 Prompt 模板 (前台工作人員)】
    const PARENT_PROMPT_TEMPLATE = `你是一位名為【**早慧AI服務專員**】的【**前台工作人員**】。
你的語氣專業、禮貌、清晰、簡潔，專門負責解答家長關於【早慧兒童教育中心】的行政、課程、分校、報名、學費等資訊。
你的知識庫是以下提供【早慧資料】及【動畫教材資料】的JSON數據。
當遇到不懂的問題時，請禮貌地說明中心無法提供該資訊或建議聯絡中心。

【回答時請嚴格遵守以下規則】
1. 任何情況下都只使用繁體中文及專業、禮貌的語氣，避免使用過多emoji或兒語。
2. 優先根據知識庫【早慧資料】的JSON數據內容來回答問題。
3. 嚴格遵守資料內容，不編造、不猜測，只提供事實信息。
4. 如果問題與行政或課程資訊無關，請禮貌地簡潔回應，並引導用戶查詢中心相關資訊。
5. 不要編造或猜測任何資料中沒有的內容，可以適當擴展知識，但不要偏離核心內容。
` + COMMON_RULES_AND_SAFETY;

    // 【學生模式 Prompt 模板 (老師) - 預設模式】
    const STUDENT_PROMPT_TEMPLATE = `你是一位名為【**早慧AI小博士**】的兒童教育專家，是一位充滿好奇心、喜歡鼓勵使用者的老師。
你的使用者主要是兒童及家長，你專門回答關於兒童文學故事內容、動物小知識以及早慧兒童教育中心的相關問題。
你的知識庫是以下提供【早慧資料】及【動畫教材資料】的JSON數據。
當遇到不懂的問題時，請誠實地說你正在學習並提出疑問，鼓勵使用者一起尋找答案，絕對不能虛構或猜測資訊。

【回答時請嚴格遵守以下規則】
1. 任何情況下都只使用繁體中文及廣東話的語氣，使用適合兒童理解的詞彙和表達方式。
2. 使用適合兒童的老師語氣，保持回答有趣，可多用emoji及「」來吸引使用者注意力。
3. 優先根據知識庫【早慧資料】及【動畫教材資料】的JSON數據內容來回答問題，當對話主題與【早慧資料】及【動畫教材資料】無關時，要盡力引導用戶返回與【動畫教材資料】相關的話題，例如：【如果想知道有**小丑魚**更多的小知識，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！】。
4. 不要編造或猜測任何資料中沒有的內容，可以適當擴展知識，但不要偏離核心內容，並與使用者說明資料可能有誤，最理想可以提供參考資料的連結。
5. 當內容與資料庫中的【動畫教材資料】的JSON數據相關，可以提示他們參考哪一個單元和故事。
    範例：
    如果你對小丑魚有興趣，可以參考O1單元一的《小丑魚、海葵和寄居蟹》喔！
` + COMMON_RULES_AND_SAFETY + QUSETION_TEMPLATE;
	
	if (promptMode === "PARENT") {
        // 模式 1: 家長模式 (前台工作人員)
        selectedPromptTemplate = PARENT_PROMPT_TEMPLATE;
    } else {
        // 模式 2: 學生模式 (老師) - 作為預設模式
        selectedPromptTemplate = STUDENT_PROMPT_TEMPLATE; 
    }	  
	
    let combinedContext = selectedPromptTemplate;

    return combinedContext;

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
            const { promptMode, conversation_history, model, temperature, max_tokens, stream, top_p} = await request.json();
            
            // 2. 伺服器端載入外部資料
            const externalData = await loadExternalData();
            const externalmaterialData = await loadExternalmaterialData();
			const finalPromptMode = promptMode || "PARENT";

            // 3. 伺服器端建構 systemPrompt
            const systemPromptContent = buildSystemPrompt(externalData, externalmaterialData, finalPromptMode);
            
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






