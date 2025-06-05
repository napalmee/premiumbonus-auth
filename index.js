import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',         // или ограничь конкретным доменом
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const codes = new Map();

const SMS_API_ID = process.env.SMS_API_ID;
const PB_TOKEN = '';

// 📤 /api/send-code
app.post('/api/send-code', async (req, res) => {
  const { phone } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');

  if (!/^79\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Неверный номер' });
  }

  const code = Math.floor(1000 + Math.random() * 9000);
  codes.set(cleanPhone, code);

  try {
    const smsRes = await axios.get('https://sms.ru/sms/send', {
      params: {
        api_id: process.env.SMS_API_ID,
        to: cleanPhone,
        msg: `Ваш код подтверждения: ${code}`,
        json: 1
      }
    });

    console.log("Ответ SMS.ru:", smsRes.data);

    if (smsRes.data.status !== 'OK') {
      return res.status(500).json({ success: false, message: 'Ошибка SMS', sms: smsRes.data });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка при отправке SMS:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Ошибка отправки' });
  }
});


// ✅ /api/verify-code
app.post('/api/verify-code', async (req, res) => {
  const { phone, code } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');

  if (Number(codes.get(cleanPhone)) !== Number(code)) {
    return res.status(401).json({ success: false, message: 'Неверный код' });
  }

  codes.delete(cleanPhone);

  try {
    const pbRes = await axios.post(
      'https://site-v2.apipb.ru/buyer-info',
      { identificator: cleanPhone },
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    const isRegistered = pbRes.data?.is_registered === true;

    return res.json({
      success: true,
      registered: isRegistered,
      redirect: isRegistered ? '/lk' : '/register'
    });

  } catch (err) {
    console.error("Ошибка buyer-info:", err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Ошибка Premium Bonus API' });
  }
});


// ✅ /api/register
app.post('/api/register', async (req, res) => {
  const { phone, name, email, birth_date, gender, source, phone_checked } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');

  // Email не обязателен, но phone, name и подтверждение — да
  if (!/^79\d{9}$/.test(cleanPhone) || !name || phone_checked !== true) {
    return res.status(400).json({ success: false, message: 'Неверные или неполные данные' });
  }

  // Проверка: уже зарегистрирован по телефону
  try {
    const check = await axios.post(
      'https://site-v2.apipb.ru/buyer-info',
      { identificator: cleanPhone },
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    if (check.data?.is_registered === true) {
      return res.json({ success: false, message: 'Такой пользователь уже существует' });
    }
  } catch (err) {
    console.error('Ошибка buyer-info:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Ошибка проверки номера' });
  }

  // Попытка регистрации
  try {
    const payload = {
      phone: cleanPhone,
      name,
      phone_checked: true,
      ...(email && { email }),
      ...(birth_date && { birth_date }),
      ...(gender && { gender }),
      ...(source && { source })
    };

    const response = await axios.post(
      'https://site-v2.apipb.ru/buyer-register',
      payload,
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    if (response.data.success === true) {
      return res.json({ success: true });
    }

    // Обработка дубликатов
    const msg = (
      response.data.message ||
      response.data.error_description ||
      ''
    ).toLowerCase();

    if (
      msg.includes('пользователь') && msg.includes('существует') ||
      msg.includes('email') && msg.includes('зарегистрирован')
    ) {
      return res.json({ success: false, message: 'Такой пользователь уже существует' });
    }

    return res.status(400).json({
      success: false,
      message: response.data.message || 'Ошибка при регистрации'
    });

  } catch (error) {
    console.error('Ошибка buyer-register:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Ошибка при регистрации. Попробуйте позже.' });
  }
});

// /api/user
app.post('/api/user', async (req, res) => {
  const { phone } = req.body;
  const cleanPhone = phone?.replace(/\D/g, '');

  if (!/^79\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Неверный номер телефона' });
  }

  try {
    const response = await axios.post(
      'https://site-v2.apipb.ru/buyer-info',
      { identificator: cleanPhone },
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    return res.json({ success: true, data: response.data });
  } catch (err) {
    console.error('Ошибка buyer-info:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Ошибка получения данных пользователя' });
  }
});


app.post('/api/update-user', async (req, res) => {
  const { phone, name, email, birth_date, gender } = req.body;
  const cleanPhone = phone?.replace(/\D/g, '');

  if (!/^79\d{9}$/.test(cleanPhone) || !name) {
    return res.status(400).json({ success: false, message: 'Некорректные данные' });
  }

  try {
    const payload = {
      phone: cleanPhone,
      name,
      ...(email && { email }),
      ...(birth_date && { birth_date }),
      ...(gender && { gender })
    };

    const response = await axios.post(
      'https://site-v2.apipb.ru/buyer-update',
      payload,
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    if (response.data?.success === true) {
      return res.json({ success: true });
    }

    return res.status(400).json({
      success: false,
      message: response.data?.message || 'Ошибка при обновлении'
    });

  } catch (err) {
    console.error('Ошибка buyer-update:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Ошибка при обновлении данных' });
  }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
