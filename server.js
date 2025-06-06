require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const API_URL = process.env.API_URL;
const API_TOKEN = process.env.API_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const PORT = process.env.PORT || 3000;

// Middleware для защиты маршрутов
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Недействительный токен' });
    }
};

// POST /api/login-start
app.post('/api/login-start', async (req, res) => {
    const { phone } = req.body;
    try {
        const buyerInfo = await axios.post(`${API_URL}/buyer-info`,
            { identificator: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        const data = buyerInfo.data;

        if (data.blocked) {
            return res.status(403).json({ success: false, message: 'Пользователь заблокирован' });
        }

        if (!data.is_registered) {
            return res.status(404).json({ success: false, message: 'Пользователь не зарегистрирован' });
        }

        await axios.post(`${API_URL}/send-register-code`,
            { phone: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        res.json({ success: true, message: 'Код отправлен' });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// POST /api/login-verify
app.post('/api/login-verify', async (req, res) => {
    const { phone, code } = req.body;

    try {
        const verifyResp = await axios.post(`${API_URL}/verify-confirmation-code`,
            { phone: phone, code: code },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        if (verifyResp.data.success) {
            const token = jwt.sign(
                { phone: phone },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 3600000
            });

            res.json({ success: true, message: 'Вход выполнен' });
        } else {
            res.status(401).json({ success: false, message: 'Неверный код' });
        }

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка проверки кода' });
    }
});

// GET /api/user-info (защищенный маршрут)
app.get('/api/user-info', authenticate, async (req, res) => {
    const phone = req.user.phone;

    try {
        const userInfo = await axios.post(`${API_URL}/buyer-info-detail`,
            { identificator: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        res.json(userInfo.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка получения данных' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
