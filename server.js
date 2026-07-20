const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- CARTELLE ---
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./users.json')) fs.writeFileSync('./users.json', '[]');
if (!fs.existsSync('./orders.json')) fs.writeFileSync('./orders.json', '[]');

// --- CONFIGURAZIONE MULTER (per selfie) ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// --- FILE JSON ---
function getUsers() {
    return JSON.parse(fs.readFileSync('./users.json'));
}
function saveUsers(data) {
    fs.writeFileSync('./users.json', JSON.stringify(data, null, 2));
}
function getOrders() {
    return JSON.parse(fs.readFileSync('./orders.json'));
}
function saveOrders(data) {
    fs.writeFileSync('./orders.json', JSON.stringify(data, null, 2));
}

// --- CONFIGURAZIONE NODEMAILER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jacopo.pazzano10@gmail.com',    // INSERISCI LA TUA EMAIL
        pass: 'dwin dsrk kwgk benr'            // INSERISCI LA PASSWORD APP
    }
});

// --- REGISTRAZIONE ---
app.post('/register', upload.single('selfie'), (req, res) => {
    const { nome, telegram, whatsapp, email, instagram, password } = req.body;
    const selfiePath = req.file ? req.file.path : '';

    const users = getUsers();
    if (users.find(u => u.telegram === telegram)) {
        return res.json({ success: false, message: 'Telegram già registrato' });
    }

    const newUser = {
        nome,
        telegram,
        whatsapp,
        email,
        instagram: instagram || 'non fornito',
        password,
        selfie: selfiePath,
        approved: false,
        registeredAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);

    // --- INVIA EMAIL ---
    const mailOptions = {
        from: 'tuaemail@gmail.com',
        to: 'brucomortale@proton.me',
        subject: '🔔 Nuova registrazione SmokeLab',
        html: `
            <h2>Nuova registrazione in attesa</h2>
            <p><b>Nome:</b> ${nome}</p>
            <p><b>Telegram:</b> ${telegram}</p>
            <p><b>WhatsApp:</b> ${whatsapp}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Instagram:</b> ${instagram || 'non fornito'}</p>
            <p><b>Password:</b> ${password}</p>
            <p><b>Selfie:</b> allegato</p>
            <hr>
            <p>Vai al pannello admin: <a href="https://tuosito.netlify.app/admin.html">admin.html</a></p>
        `,
        attachments: selfiePath ? [{ filename: path.basename(selfiePath), path: selfiePath }] : []
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) console.error('Errore invio email:', err);
    });

    res.json({ success: true, message: 'Registrazione inviata! In attesa di approvazione.' });
});

// --- LOGIN ---
app.post('/check', (req, res) => {
    const { telegram, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.telegram === telegram && u.password === password);
    if (user && user.approved) {
        res.json({ approved: true, nome: user.nome });
    } else if (user && !user.approved) {
        res.json({ approved: false, pending: true });
    } else {
        res.json({ approved: false, pending: false });
    }
});

// --- ADMIN: richieste in attesa ---
app.get('/admin/pending', (req, res) => {
    const users = getUsers();
    res.json(users.filter(u => !u.approved));
});

// --- ADMIN: utenti approvati ---
app.get('/admin/approved', (req, res) => {
    const users = getUsers();
    res.json(users.filter(u => u.approved));
});

// --- ADMIN: approva ---
app.post('/admin/approve', (req, res) => {
    const { telegram } = req.body;
    const users = getUsers();
    const user = users.find(u => u.telegram === telegram);
    if (user) {
        user.approved = true;
        saveUsers(users);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Utente non trovato' });
    }
});

// --- ADMIN: rimuovi ---
app.post('/admin/remove', (req, res) => {
    const { telegram } = req.body;
    let users = getUsers();
    const user = users.find(u => u.telegram === telegram);
    if (user) {
        user.approved = false;
        saveUsers(users);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Utente non trovato' });
    }
});

// --- ADMIN: ordini ---
app.get('/admin/orders', (req, res) => {
    res.json(getOrders());
});

// --- AGGIUNGI ORDINE ---
app.post('/order', (req, res) => {
    const { telegram, prodotti, totale } = req.body;
    const orders = getOrders();
    orders.push({
        telegram,
        prodotti,
        totale,
        data: new Date().toISOString(),
        stato: 'in attesa'
    });
    saveOrders(orders);
    res.json({ success: true });
});

// --- AVVIA SERVER ---
app.listen(PORT, () => {
    console.log(`✅ Server attivo su porta ${PORT}`);
});