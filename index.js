import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
