export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 處理 CORS 預檢請求 (OPTIONS)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        // 處理 OpenRouter API 的 POST 請求
        if (request.method !== 'POST') {
            return new Response(env.OPENROUTER_API_KEY, { status: 405 });
        }

        try {
            const requestBody = await request.json();
            const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

            const newRequest = new Request(openrouterUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`
                },
                body: JSON.stringify(requestBody),
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
