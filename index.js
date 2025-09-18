export default {
    async fetch(request) {
        const apiKey = Deno.env.get("nebulablock_key"); // ✅ 正確讀取
        if (!apiKey) {
            return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
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
            const openrouterUrl = 'https://inference.nebulablock.com/v1/chat/completions';

            const newRequest = new Request(openrouterUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': f`Bearer {os.environ.get(${apiKey})` // ✅ 改用 Deno.env.get()
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


