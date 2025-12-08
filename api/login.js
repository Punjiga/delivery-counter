const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password } = req.body;

    // Simple Hash Validation
    // The AUTH_PASSWORD_HASH env var should contain the SHA-256 hash of the password
    const validHash = process.env.AUTH_PASSWORD_HASH;

    if (!validHash) {
        return res.status(500).json({ error: 'Server configuration error: Missing AUTH_PASSWORD_HASH' });
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');

    // Compare hashes
    if (inputHash === validHash) {
        // Sign JWT
        // Uses a secret from env, or a fallback (NOT RECOMMENDED FOR PROD, BUT OK FOR DEMO/SIMPLE)
        const secret = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_prod';
        const token = jwt.sign({ user: username || 'admin', role: 'admin' }, secret, { expiresIn: '7d' });

        return res.status(200).json({ token });
    } else {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
};
