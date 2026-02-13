const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Verificar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado - Falta Token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET || 'default_secret';
        jwt.verify(token, secret);
    } catch (e) {
        return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
    }

    const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
    const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        return res.status(500).json({ error: 'Falta configuración en el servidor.' });
    }

    const binUrl = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

    // Helper para fetch con timeout (8 segundos para JSONBin)
    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    // GET: Leer datos
    if (req.method === 'GET') {
        try {
            const fetchUrl = `${binUrl}?timestamp=${Date.now()}`;
            let response = await fetchWithTimeout(fetchUrl, {
                method: 'GET',
                headers: { 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Meta': 'false' }
            });

            if (!response.ok) {
                response = await fetchWithTimeout(fetchUrl, {
                    method: 'GET',
                    headers: { 'X-Access-Key': JSONBIN_API_KEY, 'X-Bin-Meta': 'false' }
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `JSONBin Error: ${response.status}`);
            }

            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            console.error("GET sync error:", error.name === 'AbortError' ? 'Timeout' : error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Guardar datos
    if (req.method === 'POST') {
        try {
            let body = req.body;
            if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
                let rawBody = '';
                await new Promise(resolve => {
                    req.on('data', chunk => rawBody += chunk);
                    req.on('end', () => resolve());
                });
                if (rawBody) {
                    try { body = JSON.parse(rawBody); } catch (e) { /* ignore */ }
                }
            }

            if (!body || Object.keys(body).length === 0) {
                return res.status(400).json({ error: 'Body vacío' });
            }

            let response = await fetchWithTimeout(binUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                response = await fetchWithTimeout(binUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Access-Key': JSONBIN_API_KEY
                    },
                    body: JSON.stringify(body)
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `JSONBin Error: ${response.status}`);
            }

            const data = await response.json();
            return res.status(200).json({ success: true, record: data.record || data });
        } catch (error) {
            console.error("POST sync error:", error.name === 'AbortError' ? 'Timeout' : error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
};
