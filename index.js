export default {
    async fetch(request) {
        const apiKey = Deno.env.get("NEBULA_API_KEY");

        // ✅ 新增：在 Deno Deploy 日誌中列印 API 金鑰，方便偵錯
        console.log("從環境變數讀取到的 API 金鑰值：", apiKey);

        if (!apiKey) {
            return new Response("錯誤：找不到 NEBULA_API_KEY 環境變數。", { status: 500 });
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
            const requestBody = await request.json();
            
            const nebulablockUrl = 'https://inference.nebulablock.com/v1/chat/completions';
            
            // 讓代理伺服器更靈活，直接傳遞前端發來的所有參數
            const newRequestBody = {
                messages: requestBody.messages,
                model: requestBody.model,
                stream: requestBody.stream,
                ...requestBody // 將其他所有參數一併傳遞
            };

            const newRequest = new Request(nebulablockUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(newRequestBody),
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
            return new Response(`錯誤：處理請求時發生問題：${e.message}`, { status: 500 });
        }
    },
};
