// index_DENO用.js (Deno Deploy 伺服器端程式碼)

// 快取物件結構: { data: <資料陣列>, timestamp: <快取建立時間戳> }
let dataCache = {
    早慧資料: null,
    動畫教材資料: null
};

// 快取有效時間 (TTL)：60 分鐘 * 60 秒 * 1000 毫秒 = 3,600,000 毫秒
const CACHE_TTL_MS = 60 * 60 * 1000;

console.log("Deno 應用程式啟動，開始主動預載知識庫...");
loadExternalSchoolData().catch(e => console.error("預載早慧資料失敗:", e));
loadExternalmaterialData().catch(e => console.error("預載動畫教材資料失敗:", e));

// 【整合快取邏輯】
async function loadExternalSchoolData() {
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

// 核心邏輯：生成 systemPrompt
function buildSystemPrompt(externalData, externalmaterialData, promptMode, GameMode) {
 	// 【模式選擇】
    let selectedPromptTemplate;

	// 🚩 基本共用的指令
	const COMMON_RULES_AND_SAFETY = `
4. 嚴格遵守JSON數據知識庫【早慧資料】及【動畫教材資料】的資料內容，不編造、不猜測，只提供事實的信息。
5. 嚴格遵守優先使用JSON數據知識庫的內容來回答問題，但當對話與JSON數據知識庫無關係時，可以使用通用知識回答。
6. 當嚴格遵守使用任何非JSON數據知識庫(如通用知識，互聯網資訊)內的資訊回答時，回答中必須清楚註明【雖然我不太清楚，但是有可能是...】後再提供資訊。
7. 嚴格遵守當對話中的主題與JSON數據知識庫的【圖庫】中的關鍵字有關聯，可以在對話最後使用【Markdown語法】或【HTML語法】附上知識庫中的相應【圖片連結】。
8. 嚴格遵守當回答涉及任何結構化數據時，請使用【Markdown語法】或【HTML語法】建構出表格。
9. 嚴禁討論或提供任何與以下主題相關的內容：
	【人身安全/暴力】(自殺、自殘、任何形式的暴力、非法活動、危險挑戰、毒品、槍械)；
	【不當內容】(性、色情、成人內容、仇恨言論、歧視、霸凌、粗口、血腥恐怖)；
	【個人隱私】(真實姓名、住址、電話、電郵等個人身份資訊 PII，不論是詢問或分享)；
	【誤導資訊/系統濫用】(醫療/法律建議、惡意謠言、試圖操縱系統或繞過規則)。
	當主題不可討論或提供時，你必須先回覆「🙇‍♂️✨ 很抱歉，現在小助手唔太清楚以上內容，可能無法回答你的問題。
	不如你再試下問其他早慧兒童教育中心的資訊。⏳🙏」，之後再引導使用者返回到JSON數據知識庫內的話題。
10. 回答生成的內容不應過長，控制在50至200字內。

以下是你的知識庫（JSON 格式）：
早慧資料：\n${JSON.stringify(externalData)};
動畫教材資料：\n${JSON.stringify(externalmaterialData)};
`;

	// 🚩【問題模板】
	const QUESTION_TEMPLATE =`
**[第二階段：單選題（條件性）]**
**【重要提醒：生成單選題流程】你【必須】先輸出主要內容，然後再輸出格式化的單選題。**
**這段內容必須獨立存在，不能被任何標籤包裹。**
**【輸出結構強制規範：絕對不可變動】**
在成功輸出【主要知識或資訊】後，你**必須**根據該知識提出一個單選題（不多於4個選項），用以引導使用者進一步探索相關主題。

**【🚨格式強制規範：絕對不可變動🚨】**
請將以下標籤視為**不可協商的程式碼標籤**。
單選題部分**必須**以 [Question] 作為**第一行**標籤開始，並緊接在你的【主要知識或資訊】之後！

**【⛔️格式淨化：絕對禁止額外文字⛔️】**
**嚴禁**在 [Question] 標籤**前面**或**任何標籤之間**加入任何額外的**標題、前言、分隔線、Emoji** 或 **提示語**。

**【單選題輸出樣板（必須完全遵循）】**
請確保所有標籤 ( [Question]、[Options]、[CorrectAnswer]、[WrongAnswer]、[NextTopic] ) 都【獨立佔一行】且【不包含任何額外字符】。

\n[Question]
請問……，以下邊一個是正確答案？

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

	// 🚩 家長模式 Prompt 模板 (前台工作人員)】
	const PARENT_PROMPT_TEMPLATE = `你是一位名為早慧兒童教育中心的【**早慧前台AI小助手**】。
你的語氣專業、禮貌、清晰、簡潔，專門負責解答家長關於【早慧兒童教育中心】的行政、課程、分校、報名、學費等資訊。
你的知識庫是以下提供的JSON數據【早慧資料】及【動畫教材資料】。

【回答時請強制遵守以下規則生成主內容】
1. 嚴格遵守任何情況下都只使用繁體中文及廣東話，使用專業、禮貌的語氣和表達方式。
2. 嚴格遵守使用專業的前台工作者語氣，避免使用過多emoji或兒語，可多用「」來標示出重點內容。。
3. 嚴格遵守當遇到不懂的問題時，絕對不能虛構或猜測資訊，請禮貌地說明中心無法提供該資訊或建議聯絡中心。
` + COMMON_RULES_AND_SAFETY;

	// 🚩【學生模式 Prompt 模板 (老師)】
	const STUDENT_PROMPT_TEMPLATE = `你是一位名為【**早慧老師AI小助手**】的兒童教育專家，是一位充滿好奇心、喜歡鼓勵使用者的老師。
你的使用者主要是兒童及家長，你的專業係中文科，專門回答關於兒童文學故事內容、動物小知識以及早慧兒童教育中心的相關問題。
你的知識庫是以下提供的JSON數據【早慧資料】及【動畫教材資料】。

**[第一階段：主內容（必須）]**
【回答時請強制遵守以下規則生成主內容】
1. 嚴格遵守任何情況下都只使用繁體中文及廣東話，使用適合兒童理解的詞彙和表達方式。
2. 嚴格遵守使用適合兒童的老師語氣，保持回答有趣，可多用emoji及「」來標示出重點內容。
3. 嚴格遵守當遇到不懂的問題時，絕對不能虛構或猜測資訊，請誠實地說你正在學習並提出疑問，鼓勵使用者一起尋找答案。
` + COMMON_RULES_AND_SAFETY;

	// ✨ 【開發者模式 Prompt 模板 (教育顧問)】
    const DEVELOPER_PROMPT_TEMPLATE = `你是一位名為【**早慧教育顧問**】的專家，專門負責提供【早慧兒童教育中心】的**專業諮詢**及**發展建議**。
你的專業知識來自於你被提供的JSON數據【早慧資料】及【動畫教材資料】，同時你具有中文科和兒童教育領域的豐富專業背景。

【回答時請強制遵守以下規則生成主內容】
1. 嚴格遵守任何情況下都只使用繁體中文，使用**專業、客觀、詳盡**的語氣和表達方式。
2. 嚴格遵守你的主要職責是**分析知識庫內容**、**提供關於早慧發展的見解**，並為教育中心或教材提出**具體的改進意見**。
3. 嚴格遵守當提供改善意見時，請使用**條列式 (Markdown List)** 清晰列出。
4. 嚴格遵守當回答涉及知識庫內的資訊時，必須**引述**或**簡述**知識庫內容。
5. 嚴格遵守當遇到不懂的問題時，絕對不能虛構或猜測資訊，請客觀地說明資料庫中不包含該資訊或建議使用者提供更具體細節。

**【重要補充規則】**
* **字數：** 在此模式下，允許回答內容**長度超過** 200 字，以確保意見的完整性。
`;
			
	if (promptMode === "PARENT") {
        // 模式 1: 家長模式 (前台工作人員)
        selectedPromptTemplate = PARENT_PROMPT_TEMPLATE;
    } else if (promptMode === "DEVELOPER") {
        // 模式 3: 開發者模式 (教育顧問)
        selectedPromptTemplate = DEVELOPER_PROMPT_TEMPLATE;
    } else {
		// 模式 2: 學生模式 (老師) (包含 GameMode)
		if (GameMode)
			selectedPromptTemplate = STUDENT_PROMPT_TEMPLATE + QUESTION_TEMPLATE;
		else
			selectedPromptTemplate = STUDENT_PROMPT_TEMPLATE;
    }
	
	console.log("判斷模式:", promptMode ,"問答題:", GameMode);
	
    return selectedPromptTemplate;
}

export default {
    async fetch(request) {
        // 1. 同時取得主要和備用金鑰
        const primaryApiKey = Deno.env.get("OPENROUTER_API_KEY");
        const backupApiKey = Deno.env.get("OPENROUTER_API_KEY_BACKUP");

        if (!primaryApiKey) {
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
            const { 
                promptMode, 
                conversation_history, 
                model, 
                temperature, 
                max_tokens, 
                stream, 
                top_p,
                prompt,
                image_base64,
				GameMode
            } = await request.json();
			
            // 2. 伺服器端載入外部資料
            const externalData = await loadExternalSchoolData();
            const externalmaterialData = await loadExternalmaterialData();
			const finalPromptMode = promptMode || "PARENT";
			const finalGameMode = GameMode || false;
			let finalmodel = "openai/gpt-oss-20b:free";

            // 3. 伺服器端建構 systemPrompt
            const systemPromptContent = buildSystemPrompt(externalData, externalmaterialData, finalPromptMode, finalGameMode);
            
			// 輔助函數：將前端格式 (包含 {message, image} 物件) 轉換為 OpenRouter 格式
            const normalizeMessageForOpenRouter = (msg) => {
                // 檢查是否為用戶訊息且包含前端儲存的圖片結構
                if (msg.role === 'user' && typeof msg.content === 'object' && msg.content.image) {
                    // content 欄位需要被轉換為 [text object, image object] 陣列
                    const contentArray = [];
					const historyImageFullUrl = msg.content.image;
                    
                    // 1. 新增圖片 (Llama/OpenRouter 圖片要求 Data URL 格式)
                    contentArray.push({ 
                        type: "image_url", 
                        image_url: { url: historyImageFullUrl }
                    });
                    
                    // 2. 新增文字 (即使為空)
                    contentArray.push({ type: "text", text: msg.content.message || "" });
                    
                    return {
                        role: "user",
                        content: contentArray
                    };
                }
                
                // 處理其他標準訊息 (Bot 回覆 或 舊式純文字 User 訊息)
                return { 
                    role: msg.role, 
                    // 確保只傳遞文字內容，如果是前端的結構化物件，則提取 .message
                    content: typeof msg.content === 'object' ? msg.content.message : msg.content
                };
            };
			
            // 4. 建構最終要傳給 OpenRouter 的 messages 陣列
            const finalMessages = [
                { role: "system", content: systemPromptContent },
                ...conversation_history.map(normalizeMessageForOpenRouter) // 將歷史訊息展開
            ];

			// 處理當前用戶訊息 (Prompt + Image_Base64)
            let currentUserMessage = { role: "user" };
            
            if (image_base64) {
                // 多模態訊息： content 必須是陣列
                currentUserMessage.content = [
                    // 圖片數據需要重新加上 Data URL 前綴
                    { type: "image_url", image_url: { url: image_base64 } },
					{ type: "text", text: prompt || "" }
                ];
            } else {
                // 純文字訊息： content 為字串
                currentUserMessage.content = prompt;
            }

            // 將當前訊息加入最終訊息陣列
            finalMessages.push(currentUserMessage);
			
			if(model === "primary"){
				finalmodel = "kwaipilot/kat-coder-pro:free"; //純文字
			} else if (model === "secondary") {
				finalmodel = "nvidia/nemotron-nano-12b-v2-vl:free"; //可圖文
			}  else {
				finalmodel = "google/gemma-3-4b-it:free"; //backup可圖文
			}
			console.log("Model:", finalmodel);

            // 5. 建構 OpenRouter 的完整請求體 (payload)
            const openrouterRequestPayload = {
                // 使用前端傳來的 model 名稱，若無則使用預設
                model: finalmodel, 
                messages: finalMessages,
                // temperature 預設 0.3 低預設溫度以減少幻覺
                temperature: temperature || 0.3, 
                // top_p 預設 0.9，平衡多樣性與準確性
                top_p: top_p || 0.9,             
                max_tokens: max_tokens || 4096,
                stream: stream !== undefined ? stream : true,
            };
            
            const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

            // 2. 獨立的請求函數，方便重試
            const callOpenRouter = async (apiKey) => {
                const newRequest = new Request(openrouterUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}` // 使用傳入的 Key
                    },
                    body: JSON.stringify(openrouterRequestPayload),
                });
                return fetch(newRequest);
            };

            let response;
            let currentApiKey = primaryApiKey;
            let usedBackup = false;

            // 3. 嘗試使用主要金鑰
            try {
                console.log("嘗試使用主要金鑰...");
                response = await callOpenRouter(primaryApiKey);

                // 檢查是否是限流錯誤 (HTTP 429 Too Many Requests)
                if (response.status === 429 && backupApiKey) {
                    console.error("主要金鑰觸發限流 (429)。嘗試使用備用金鑰...");
                    // 丟棄第一個 response body，準備重試
                    await response.text(); 
                    
                    // 嘗試使用備用金鑰
                    response = await callOpenRouter(backupApiKey);
                    currentApiKey = backupApiKey;
                    usedBackup = true;
                } else if (!response.ok) {
                    // 非 429 的其他 API 錯誤
                    throw new Error(`OpenRouter API 錯誤: ${response.status} (${response.statusText})`);
                }
            } catch (error) {
                // 處理網路錯誤或非 429 的錯誤拋出
                if (!usedBackup && backupApiKey) {
                     console.error(`主要金鑰請求失敗: ${error.message}。嘗試使用備用金鑰...`);
                    // 嘗試使用備用金鑰
                    response = await callOpenRouter(backupApiKey);
                    currentApiKey = backupApiKey;
                    usedBackup = true;
                } else {
                    // 如果備用金鑰也用過了，或沒有備用金鑰，則拋出
                    throw error;
                }
            }
            
            if (!response) {
                 throw new Error("API 請求沒有獲得有效回應。");
            }
            
            if (!response.ok) {
                 // 檢查最終的回應是否成功，如果失敗 (例如備用金鑰也限流或無效)
                 throw new Error(`最終 OpenRouter API 錯誤: ${response.status} (${response.statusText})`);
            }

            console.log(`OpenRouter 請求成功，使用金鑰: ${usedBackup ? '備用' : '主要'}`);

            // 4. 返回回應 (保持不變)
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

























