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
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET || 'default_secret';
        jwt.verify(token, secret);
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    // Variables de entorno de JSONBin
    const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
    const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
        return res.status(500).json({ error: 'Configuración de JSONBin faltante' });
    }

    const binUrl = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

    // GET: Leer datos desde JSONBin
    if (req.method === 'GET') {
        try {
            const response = await fetch(binUrl, {
                method: 'GET',
                headers: {
                    'X-Access-Key': JSONBIN_API_KEY
                }
            });

            if (!response.ok) {
                throw new Error('Error al leer desde JSONBin');
            }

            const data = await response.json();
            // JSONBin retorna { record: {...}, metadata: {...} }
            return res.status(200).json(data.record);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Guardar datos en JSONBin
    if (req.method === 'POST') {
        try {
            // Leer body
            let rawBody = '';
            await new Promise(resolve => {
                req.on('data', chunk => rawBody += chunk);
                req.on('end', () => resolve());
            });

            let body = {};
            try {
                body = JSON.parse(rawBody || '{}');
            } catch (err) {
                return res.status(400).json({ error: 'JSON inválido' });
            }

            const response = await fetch(binUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': JSONBIN_API_KEY
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('Error al escribir en JSONBin');
            }

            const data = await response.json();
            return res.status(200).json({ success: true, record: data.record });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
};
