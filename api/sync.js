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
        return res.status(401).json({ error: 'Sesión expirada o token inválido. Por favor, inicia sesión de nuevo.' });
    }

    // Variables de entorno de JSONBin
    const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
    const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        console.error("Faltan variables de entorno: ", { hasKey: !!JSONBIN_API_KEY, hasBinId: !!JSONBIN_BIN_ID });
        return res.status(500).json({ error: 'Error de configuración en el servidor (Env Vars missing)' });
    }

    const binUrl = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

    // GET: Leer datos desde JSONBin
    if (req.method === 'GET') {
        try {
            const fetchUrl = `${binUrl}?timestamp=${Date.now()}`;
            console.log(`Intentando GET a ${fetchUrl}`);

            let response = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'X-Master-Key': JSONBIN_API_KEY,
                    'X-Bin-Meta': 'false'
                }
            });

            if (!response.ok) {
                console.warn(`GET con Master Key falló (${response.status}). Reintentando con Access Key...`);
                response = await fetch(fetchUrl, {
                    method: 'GET',
                    headers: {
                        'X-Access-Key': JSONBIN_API_KEY,
                        'X-Bin-Meta': 'false'
                    }
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Error final en GET JSONBin:", errorData);
                throw new Error(errorData.message || `Error status: ${response.status}`);
            }

            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            console.error("Error fatal en GET sync:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Guardar datos en JSONBin
    if (req.method === 'POST') {
        try {
            // Manejar body de forma segura
            let body = req.body;
            if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
                let rawBody = '';
                await new Promise(resolve => {
                    req.on('data', chunk => rawBody += chunk);
                    req.on('end', () => resolve());
                });
                if (rawBody) {
                    try { body = JSON.parse(rawBody); } catch (e) {
                        console.error("Error parseando body:", e);
                    }
                }
            }

            if (!body || Object.keys(body).length === 0) {
                return res.status(400).json({ error: 'No hay datos para guardar (Body vacío)' });
            }

            console.log("Intentando guardar en JSONBin...");

            // Intentamos guardar con Master Key
            let response = await fetch(binUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                console.warn(`PUT con Master Key falló (${response.status}). Reintentando con Access Key...`);
                response = await fetch(binUrl, {
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
                console.error("Error final en PUT JSONBin:", errorData);
                throw new Error(errorData.message || `Error status: ${response.status}`);
            }

            const data = await response.json();
            return res.status(200).json({ success: true, record: data.record || data });
        } catch (error) {
            console.error("Error fatal en POST sync:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
};
