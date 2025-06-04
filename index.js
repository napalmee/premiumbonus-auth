import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const codes = new Map();

// 🔐 ЗАМЕНИ ЭТИ ЗНАЧЕНИЯ НА СВОИ
const SMS_API_ID = 'ВСТАВЬ_СЮДА_СВОЙ_sms.ru_API_КЛЮЧ';
const PB_TOKEN = 'test:459a9e9d73d0ccca376df9b07f230d17';

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
        api_id: SMS_API_ID,
        to: cleanPhone,
        msg: `Ваш код подтверждения: ${code}`,
        json: 1
      }
    });

    if (smsRes.data.status !== 'OK') {
      return res.status(500).json({ success: false, message: 'Ошибка SMS' });
    }

    res.json({ success: true });
  } catch {
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
      redirect: isRegistered ? '/lk' : '/register'
    });
  } catch {
    res.status(500).json({ success: false, message: 'Ошибка Premium Bonus API' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
