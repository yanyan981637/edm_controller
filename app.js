require('dotenv').config();
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const i18n = require('i18n');
const path = require('path');
const crypto = require('crypto');
const sessionSecret = crypto.randomBytes(64).toString('hex');
const app = express();

/* 
 |---------------------------------------------------------------------------
 | 1) 先使用 express-session
 |---------------------------------------------------------------------------
*/
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true
}));

/* 
 |---------------------------------------------------------------------------
 | 2) 設定 i18n 並啟用
 |---------------------------------------------------------------------------
*/
i18n.configure({
    // 支援的語系
    locales: ['en', 'zh-TW'],
    // 預設語系
    defaultLocale: 'zh-TW',
    // 放翻譯檔的資料夾
    directory: path.join(__dirname, 'locales'),
    // 允許使用 queryString ?lang=xx
    queryParameter: 'lang',
    // 以物件模式存取 key
    objectNotation: true
});

// 讓每個 request 都能使用 `req.__()`
app.use(i18n.init);

/* 
 |---------------------------------------------------------------------------
 | 3) 中介層：若 session 裡有 lang，就依照它切換
 |---------------------------------------------------------------------------
*/
app.use((req, res, next) => {
    if (req.session?.userData?.lang) {
        const sLang = req.session.userData.lang.toLowerCase();
        req.setLocale(sLang === 'zh-tw' ? 'zh-TW' : 'en');
    }
    next();
});

/* 
 |---------------------------------------------------------------------------
 | 4) 靜態資源、EJS、layout
 |---------------------------------------------------------------------------
*/
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layout');

/* 
 |---------------------------------------------------------------------------
 | 5) /edm/unsubscribe 
 |    => 讀取 ?email=...&lang=... → 存 session → redirect /confirm
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe', (req, res) => {
    const { email, first_name, last_name, is_news, website, lang } = req.query;

    // 若未帶參數，改用 redirect 到 thanks.ejs
    if (!email || !first_name || !last_name || !is_news || !website || !lang) {
        return res.redirect('/edm/unsubscribe/thanks');
    }

    // 根據 lang 參數，設定本次請求的語系
    if (lang && lang.toLowerCase() === 'zh-tw') {
        req.setLocale('zh-TW');
    } else {
        req.setLocale('en');
    }

    // 將參數存入 session
    req.session.userData = { email, first_name, last_name, is_news, website, lang };
    console.log("[/edm/unsubscribe] 接收到的資料：", req.session.userData);

    // 導向確認頁面
    res.redirect('/edm/unsubscribe/confirm');
});

/* 
 |---------------------------------------------------------------------------
 | 6) /edm/unsubscribe/confirm
 |    => 從 session 拿資料，渲染 confirm.ejs
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe/confirm', (req, res) => {
    const sessionData = req.session.userData;

    // 如果 sessionData 不存在或重要欄位缺失
    if (!sessionData || !sessionData.email || !sessionData.first_name || !sessionData.last_name || !sessionData.is_news || !sessionData.website || !sessionData.lang) {
        return res.redirect('/edm/unsubscribe/thanks');
    }

    // 以 i18n 取得標題翻譯（示範 key: 'title_unsubscribe_confirm'）
    const pageTitle = req.__('title_unsubscribe_confirm');

    res.render('confirm', {
        title: pageTitle,
        sessionData
    });
});

/* 
 |---------------------------------------------------------------------------
 | 7) /edm/unsubscribe/check
 |    => 取消訂閱 (PUT)，成功 -> /success，失敗 -> /fail
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe/check', async (req, res) => {
    const { email, first_name, last_name, is_news, website, lang } = req.session.userData || {};

    // 若缺關鍵欄位，轉址到 thanks
    if (!email) {
        return res.redirect('/edm/unsubscribe/thanks');
    }

    // is_news 字串轉布林值
    const isNewsBool = (is_news === 'true');

    try {
        // Step 1: 取得 access_token
        const authResponse = await fetch("https://open-nms-api.mio.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
                "account": process.env.ACCOUNT,
                "pswd":   process.env.PSWD
            })
        });
        const authData = await authResponse.json();
        const accessToken = authData.access_token || null;

        console.log("[/edm/unsubscribe/check] token data:", authData);

        // Step 2: 發送 PUT
        const putResponse = await fetch("https://open-nms-api.mio.com/mdtapi/customer/subscribe/newsletter", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                email,
                first_name,
                last_name,
                is_news: isNewsBool,
                website,
                lang
            })
        });
        const putResult = await putResponse.json();
        console.log("[/edm/unsubscribe/check] PUT return:", putResult);

        // 判斷結果
        if (putResult.status === 200) {
            return res.redirect('/edm/unsubscribe/success');
        } else {
            req.session.errorData = {
                sessionData: { email, first_name, last_name, is_news, website, lang },
                status: putResult.status,
                msg: putResult.msg
            };
            return res.redirect('/edm/unsubscribe/fail');
        }
    } catch (error) {
        console.error("Error:", error);
        return res.redirect('/edm/unsubscribe/thanks');
    }
});

/* 
 |---------------------------------------------------------------------------
 | 8) /edm/unsubscribe/success
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe/success', (req, res) => {
    const sessionData = req.session.userData;
    if (!sessionData) {
        return res.redirect('/edm/unsubscribe/thanks');
    }
    console.log("[/edm/unsubscribe/success] sessionData:", sessionData);

    // 以 i18n 取得成功頁面的標題
    const pageTitle = req.__('title_unsubscribe_success');

    res.render('success', {
        title: pageTitle,
        sessionData
    });

    // 清除 session
    req.session.userData = null;
});

/* 
 |---------------------------------------------------------------------------
 | 9) /edm/unsubscribe/fail
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe/fail', (req, res) => {
    const errorData = req.session.errorData;
    if (!errorData) {
        return res.redirect('/edm/unsubscribe/thanks');
    }
    console.log("[/edm/unsubscribe/fail] errorData:", errorData);

    // 以 i18n 取得失敗頁面的標題
    const pageTitle = req.__('title_unsubscribe_fail');

    res.render('fail', {
        title: pageTitle,
        errorData
    });

    // 清除 errorData
    req.session.errorData = null;
});

/*
 |---------------------------------------------------------------------------
 | 10) /edm/unsubscribe/thanks
 |     => 顯示 thanks.ejs
 |---------------------------------------------------------------------------
*/
app.get('/edm/unsubscribe/thanks', (req, res) => {
    // 可自行加翻譯 key，如 'title_unsubscribe_thanks'
    // 這裡簡單示範
    const pageTitle = req.__('title_unsubscribe_thanks') || 'Thanks';

    res.render('thanks', {
        title: pageTitle
    });
});

/* 
 |---------------------------------------------------------------------------
 | 11) 啟動應用
 |---------------------------------------------------------------------------
*/
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Node.js app listening on port ${port}`);
});
