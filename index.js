export default {
    async fetch(request) {
        // 🔑 變更：從 Deno 環境變數取得你的 Nebulablock API 金鑰
        const apiKey = Deno.env.get("NEBULA_API_KEY");
        if (!apiKey) {
            return new Response("Missing NEBULA_API_KEY", { status: 500 });
        }

        const url = new URL(request.url);

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
            // 🔑 變更：使用 Nebulablock 的 API 端點
            const nebulablockUrl = 'https://inference.nebulablock.com/v1/chat/completions';
            
            // 🔑 變更：傳送給 Nebulablock 的請求主體
            // 你的前端會傳入 messages 和 model，你只需將它傳遞過去
            const newRequestBody = {
                messages: requestBody.messages,
                model: requestBody.model,
                // Nebulablock 範例的參數
                max_tokens: requestBody.max_tokens,
                temperature: requestBody.temperature,
                top_p: requestBody.top_p,
                // 你的前端可能需要 stream: true 來實現串流效果
                stream: requestBody.stream,
            };

            const newRequest = new Request(nebulablockUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 🔑 變更：使用 Nebulablock 的 API 金鑰
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
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
};
