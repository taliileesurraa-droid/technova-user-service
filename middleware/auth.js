const { verifyToken } = require('../utils/jwt');
const { models } = require('../models');
require('dotenv').config();

function auth(required = true) {
return (req, res, next) => {
const header = req.headers.authorization || '';
const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
// Prefer Authorization header over query/body tokens to avoid accidental overrides
const token = bearer || req.query.token || req.body?.token || null;
if (!token) { if (required) return res.status(401).json({ message: 'Unauthorized' }); return next(); }
try {
const payload = verifyToken(token);
	// If driver, enforce sessionVersion matches DB to ensure single active session
	if (payload && payload.type === 'driver' && typeof payload.sessionVersion !== 'undefined') {
		try {
			const driver = await models.Driver.findByPk(payload.id, { attributes: ['sessionVersion'] });
			if (!driver) return res.status(401).json({ message: 'Invalid token' });
			if ((driver.sessionVersion || 0) !== (payload.sessionVersion || 0)) {
				return res.status(401).json({ message: 'Session expired. Logged in on another device.' });
			}
		} catch (_) {}
	}
req.user = payload; return next();
} catch (err) { return res.status(401).json({ message: 'Invalid token' }); }
};
}

module.exports = auth;
