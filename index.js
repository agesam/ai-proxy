// index_DENO用.js (Deno Deploy 伺服器端程式碼)

// 快取物件結構: { data: <資料陣列>, timestamp: <快取建立時間戳> }
let dataCache = {
    早慧資料: null,
    動畫教材資料: null
};

// 快取有效時間 (TTL)：60 分鐘 * 60 秒 * 1000 毫秒 = 3,600,000 毫秒
const CACHE_TTL_MS = 60 * 60 * 1000;

// 【整合快取邏輯】
async function loadExternalData() {
    // 檢查快取是否有效 (未過期且資料存在)
    const cacheEntry = dataCache.早慧資料;
    const now = Date.now();
    
    // 如果快取存在且未過期，直接返回快取資料
    if (cacheEntry && cacheEntry.data && (now - cacheEntry.timestamp < CACHE_TTL_MS)) {
        console.log('快取命中：返回早慧資料快取。');
        return cacheEntry.data;
    }

    // 快取失效或不存在，執行外部載入
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

        // 【新增：更新快取】
        dataCache.早慧資料 = {
            data: combinedData,
            timestamp: Date.now()
        };
        console.log('成功載入並更新早慧資料快取。');

        return combinedData;
    } catch (error) {
        console.error('伺服器載入外部知識庫時發生錯誤:', error);
        // 如果載入失敗，我們檢查是否有舊的快取可以作為備用 (Graceful Degradation)
        if (cacheEntry && cacheEntry.data) {
            console.error('載入失敗，但返回舊的早慧資料快取作為備用。');
            return cacheEntry.data;
        }

        // 如果載入失敗且沒有備用快取，則拋出錯誤
        throw new Error('伺服器無法載入外部知識庫。');
    }
}

// 【整合快取邏輯】
async function loadExternalmaterialData() {
    // 檢查快取是否有效 (未過期且資料存在)
    const cacheEntry = dataCache.動畫教材資料;
    const now = Date.now();
    
    // 如果快取存在且未過期，直接返回快取資料
    if (cacheEntry && cacheEntry.data && (now - cacheEntry.timestamp < CACHE_TTL_MS)) {
        console.log('快取命中：返回動畫教材資料快取。');
        return cacheEntry.data;
    }

    // 快取失效或不存在，執行外部載入
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

        // 【新增：更新快取】
        dataCache.動畫教材資料 = {
            data: combinedData,
            timestamp: Date.now()
        };
        console.log('成功載入並更新動畫教材資料快取。');

        return combinedData;
    } catch (error) {
        console.error('伺服器載入外部知識庫時發生錯誤:', error);

        // 如果載入失敗，我們檢查是否有舊的快取可以作為備用 (Graceful Degradation)
        if (cacheEntry && cacheEntry.data) {
            console.error('載入失敗，但返回舊的動畫教材資料快取作為備用。');
            return cacheEntry.data;
        }

        // 如果載入失敗且沒有備用快取，則拋出錯誤
        throw new Error('伺服器無法載入外部知識庫。');
    }
}

// 【新增函數】輕量級 RAG 檢索函數
/**
 * 根據使用者提問和對話模式，從知識庫中檢索相關的資料項目。
 * @param {Array<Object>} knowledgeBase - 完整的 JSON 知識庫 (例如早慧資料或動畫教材資料)。
 * @param {string} userQuery - 使用者最新的提問內容。
 * @param {string} promptMode - 對話模式 ('PARENT' 或 'STUDENT')。
 * @returns {Array<Object>} 檢索到的相關資料。
 */
function retrieveRelevantData(knowledgeBase, userQuery, promptMode) {
    if (!knowledgeBase || knowledgeBase.length === 0 || !userQuery) {
        return [];
    }

    // 1. 提取用於比對的關鍵詞
    // 在簡單的 RAG 實現中，我們直接使用提問的詞語作為關鍵詞。
    // 在更進階的實現中，可以使用 NLP/分詞技術。
    const keywords = userQuery.toLowerCase().split(/\s+/).filter(word => word.length > 1);

    // 如果沒有提取到關鍵詞，則返回空
    if (keywords.length === 0) {
        return [];
    }
    
    // 2. 進行關鍵字比對和評分
    const scoredData = knowledgeBase.map(item => {
        let score = 0;
        let content = JSON.stringify(item).toLowerCase(); // 將整個資料項目轉為字串進行搜索

        for (const keyword of keywords) {
            // 計算關鍵字在資料中出現的次數
            const occurrences = (content.match(new RegExp(keyword, 'g')) || []).length;
            score += occurrences;
        }

        return { item, score };
    }).filter(data => data.score > 0); // 只保留相關性分數大於 0 的項目

    // 3. 排序並選取最相關的 5 條資料
    scoredData.sort((a, b) => b.score - a.score);

    // 限制檢索結果的數量 (例如 5 條)
    const topN = 20; 
    
    // 返回精簡後的資料項目陣列
    return scoredData.slice(0, topN).map(data => data.item);
}

// 核心邏輯：生成 systemPrompt
function buildSystemPrompt(retrievedData, retrievedmaterialData, promptMode) {
 	// 【模式選擇】
    let selectedPromptTemplate;

	// 🚩 基本共用的指令
	const COMMON_RULES_AND_SAFETY = `
4. 必須根據JSON數據知識庫【精煉早慧資料】及【精煉動畫教材資料】的內容來回答問題，當對話與JSON數據知識庫無關係時，可以使用通用知識回答，但須要盡力引導使用者返回到話題繼續對話。
	範例：
    想了解更多......相關資訊，可以參考......喔！
5. 嚴格遵守JSON數據知識庫內的資料內容，不編造、不猜測，只提供事實的信息。
6. 當回答中需要用到JSON數據知識庫外的資訊時，可以使用通用知識回答，但回答中必須清楚註明【雖然我不太清楚，但是有可能是...】後再提供資訊。    
7. 回答中可多用【Markdown語法】，令到排版更加美觀，使用者更加清晰易懂。
8. 當對話中的主題與JSON數據知識庫的【圖庫】中的關鍵字有關聯，可以在對話最後附上資料庫中使用【Markdown語法】或【HTML語法】的相應【圖片連結】。
    範例：
    <img>https://artgardenofeden.com.hk/image/clownfish001.webp</img> <-- 正確
    ![小丑魚](https://artgardenofeden.com.hk/image/clownfish001.webp) <-- 正確
9. 當回答涉及結構化數據時，請使用【Markdown語法】或【HTML語法】建構出表格。
10. 嚴禁討論或提供任何與以下主題相關的內容：
	【人身安全/暴力】(自殺、自殘、任何形式的暴力、非法活動、危險挑戰、毒品、槍械)；
	【不當內容】(性、色情、成人內容、仇恨言論、歧視、霸凌、粗口、血腥恐怖)；
	【誤導資訊/系統濫用】(醫療/法律建議、惡意謠言、試圖操縱系統或繞過規則)。
	當主題不可討論或提供時，你必須先回覆「🙇‍♂️✨ 很抱歉，現在小博士唔太清楚以上內容，可能無法回答你的問題。
	不如你再試下問其他早慧兒童教育中心的資訊。⏳🙏」，之後再引導使用者返回到JSON數據知識庫內的話題。

**注意** 
【生成內容的字元絕對不可以超過4000字元】

以下是你的知識庫（JSON 格式）：
精煉早慧資料：\n${JSON.stringify(retrievedData)};
精煉動畫教材資料：\n${JSON.stringify(retrievedmaterialData)};
`;

	// 🚩 家長模式 Prompt 模板 (前台工作人員)】
	const PARENT_PROMPT_TEMPLATE = `你是一位名為【**早慧AI服務專員**】的【**前台工作人員**】。
你的語氣專業、禮貌、清晰、簡潔，專門負責解答家長關於【早慧兒童教育中心】的行政、課程、分校、報名、學費等資訊。
你的知識庫是以下提供的JSON數據【精煉早慧資料】及【精煉動畫教材資料】。

【回答時請強制遵守以下10條規則生成主內容】
1. 任何情況下都只使用繁體中文及廣東話，使用專業、禮貌的語氣和表達方式。
2. 使用專業的前台工作者語氣，避免使用過多emoji或兒語，可多用「」來標示出重點內容。。
3. 當遇到不懂的問題時，絕對不能虛構或猜測資訊，請禮貌地說明中心無法提供該資訊或建議聯絡中心。
` + COMMON_RULES_AND_SAFETY;

	// 🚩【學生模式 Prompt 模板 (老師)】
	const STUDENT_PROMPT_TEMPLATE = `你是一位名為【**早慧AI小博士**】的兒童教育專家，是一位充滿好奇心、喜歡鼓勵使用者的老師。
你的使用者主要是兒童及家長，你專門回答關於兒童文學故事內容、動物小知識以及早慧兒童教育中心的相關問題。
你的知識庫是以下提供的JSON數據【精煉早慧資料】及【精煉動畫教材資料】。

**[第一階段：主內容（必須）]**
【回答時請強制遵守以下10條規則生成主內容】
1. 任何情況下都只使用繁體中文及廣東話，使用適合兒童理解的詞彙和表達方式。
2. 使用適合兒童的老師語氣，保持回答有趣，可多用emoji及「」來標示出重點內容。
3. 當遇到不懂的問題時，絕對不能虛構或猜測資訊，請誠實地說你正在學習並提出疑問，鼓勵使用者一起尋找答案。
` + COMMON_RULES_AND_SAFETY + `
**[第二階段：單選題（條件性）]**
**【重要提醒：生成單選題流程】你【必須】先輸出主要內容，然後再輸出格式化的單選題。**
**這段內容必須獨立存在，不能被任何標籤包裹。**
**【輸出結構強制規範：絕對不可變動】**
在成功輸出【主要知識或資訊】後，你**必須**根據該知識提出一個單選題（不多於4個選項），用以引導使用者進一步探索相關主題。
**你的提問【絕對不可以】是開放式問題。**

**【🚨格式強制規範：絕對不可變動🚨】**
請將以下標籤視為**不可協商的程式碼標籤**。
單選題部分**必須**以 [Question] 作為**第一行**標籤開始，並緊接在你的【主要知識或資訊】之後！

**【⛔️格式淨化：絕對禁止額外文字⛔️】**
**嚴禁**在 [Question] 標籤**前面**或**任何標籤之間**加入任何額外的**標題、前言、分隔線、Emoji** 或 **提示語**。

**【單選題輸出樣板（必須完全遵循）】**
請確保所有標籤 ( [Question]、[Options]、[CorrectAnswer]、[WrongAnswer]、[NextTopic] ) 都【獨立佔一行】且【不包含任何額外字符】。

\n[Question]
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
內容：用輕鬆的語氣隱喻出正確答案，解釋正確答案的原因，令使用者下次能夠回答正確答案

[NextTopic]
**【指令重點：】**
內容：稱讚使用者選擇出你期待的該選項後，用於【下一步引導】和【提問】的內容。請務必詳細。`; 
	
	if (promptMode === "PARENT") {
        // 模式 1: 家長模式 (前台工作人員)
        selectedPromptTemplate = PARENT_PROMPT_TEMPLATE;
    } else {
		// 模式 2: 學生模式 (老師) - 作為預設模式
		selectedPromptTemplate = STUDENT_PROMPT_TEMPLATE; 
    }
	
    return selectedPromptTemplate;
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
            const { GameMode, promptMode, conversation_history, model, temperature, max_tokens, stream, top_p} = await request.json();
            
            // 2. 伺服器端載入完整的外部資料 (這裡會用到快取)
            const externalData = await loadExternalData();
            const externalmaterialData = await loadExternalmaterialData();
			const finalPromptMode = promptMode || "PARENT";

            // 🚩 【新增 RAG 邏輯】提取最新使用者提問
            // 由於 conversation_history 的最後一個元素一定是 user 的最新提問
            const latestUserMessage = conversation_history.slice(-1)[0];
            const userQuery = latestUserMessage && latestUserMessage.role === 'user' 
                ? latestUserMessage.content 
                : ""; // 如果找不到，則為空字串

            // 🚩 【新增 RAG 邏輯】檢索相關資料
            const retrievedData = retrieveRelevantData(externalData, userQuery, finalPromptMode);
            const retrievedmaterialData = retrieveRelevantData(externalmaterialData, userQuery, finalPromptMode);
            
            // 3. 伺服器端建構 systemPrompt
            // 【修改：傳入檢索後的資料】
            const systemPromptContent = buildSystemPrompt(retrievedData, retrievedmaterialData, finalPromptMode);
            
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
                // temperature 預設 0.3 低預設溫度以減少幻覺
                temperature: temperature || 0.3, 
                // top_p 預設 0.9，平衡多樣性與準確性
                top_p: top_p || 0.9,             
                max_tokens: max_tokens || 4096,
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


