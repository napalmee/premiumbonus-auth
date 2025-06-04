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
          'Authorization': PB_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const isRegistered = pbRes.data?.is_registered === true;

    res.json({
  success: true,
  registered: isRegistered,
  redirect: isRegistered
    ? '/lk'
    : 'https://project13547195.tilda.ws/page70247263.html'
});
  } catch {
    res.status(500).json({ success: false, message: 'Ошибка Premium Bonus API' });
  }
});

// ✅ /api/register
app.post('/api/register', async (req, res) => {
  const { phone, name, email, birth_date, gender, source } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');

  if (!/^79\d{9}$/.test(cleanPhone) || !name || !email) {
    return res.status(400).json({ success: false, message: 'Неверные или неполные данные' });
  }

  try {
    const response = await axios.post(
      'https://site-v2.apipb.ru/buyer-register',
      {
        phone: cleanPhone,
        name,
        email,
        ...(birth_date && { birth_date }),
        ...(gender && { gender }),
        ...(source && { source })
      },
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    console.log('Ответ от Premium Bonus:', response.data);

    if (response.data.success === true) {
      res.json({ success: true });
    } else {
      // Специальная обработка повторной регистрации
      const msg = response.data.message?.toLowerCase() || '';
      if (msg.includes('пользователь') && msg.includes('существует')) {
        res.json({ success: false, message: 'Пользователь с таким номером уже существует' });
      } else {
        res.status(400).json({ success: false, message: response.data.message || 'Ошибка при регистрации' });
      }
    }
  } catch (error) {
    console.error('Ошибка buyer-register:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Ошибка при регистрации. Попробуйте позже.' });
  }
});

app.get('/api/pb-test', async (req, res) => {
  const testPhone = '9001234567'; // ← замени на нужный номер

  try {
    const response = await axios.post(
      'https://site-v2.apipb.ru/buyer-info',
      { identificator: testPhone },
      {
        headers: {
          Authorization: process.env.PB_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Ошибка PB_TOKEN:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Ошибка проверки токена' });
  }
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
