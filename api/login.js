const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- READ JSON BODY (HANDLING VERCEL AUTO-PARSING) ---
    let body = req.body;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
        let rawBody = "";
        await new Promise(resolve => {
            req.on("data", chunk => rawBody += chunk);
            req.on("end", () => resolve());
        });
        if (rawBody) {
            try {
                body = JSON.parse(rawBody);
            } catch (err) {
                return res.status(400).json({ error: "Invalid JSON body" });
            }
        }
    }

    const { username, password } = body || {};

    if (!password) {
        return res.status(400).json({ error: "Missing password" });
    }

    const validHash = process.env.AUTH_PASSWORD_HASH;
    if (!validHash) {
        return res.status(500).json({ error: 'Error interno: AUTH_PASSWORD_HASH no configurado' });
    }

    // Hash the received password
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');

    if (inputHash === validHash) {
        const secret = process.env.JWT_SECRET || 'default_secret';
        const token = jwt.sign({ user: username || "punjiga" }, secret, { expiresIn: '7d' });
        return res.status(200).json({ token });
    } else {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
};
