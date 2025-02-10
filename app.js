const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const sessionSecret = crypto.randomBytes(64).toString('hex');
const app = express();

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true
}));

// 設定 ejs 為 view 模板引擎，並指定 views 資料夾
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 定義 /success 路由，回傳 "vu03g4"，並可顯示從 query 傳入的參數
app.get('/success', (req, res) => {
    // 從 session 取得資料
    // const { email, first_name, last_name, is_news } = req.session.userData || {};
    // console.log("In /success route, received values:");
    // console.log("Email:", email);
    // console.log("First Name:", first_name);
    // console.log("Last Name:", last_name);
    // console.log("is_news:", is_news);

    const sessionData = req.session.userData || {
        email: '未提供',
        first_name: '未提供',
        last_name: '未提供',
        is_news: '未提供'
    };
    console.log("在 /success 路由中，從 session 取得的資料：", sessionData);
    res.render('success', { sessionData });

    // 選擇性：清除 session 中的資料
    req.session.userData = null;

    // res.send("vu03g4");
});

// 定義 /unsubscribe 路由，處理外部 GET 請求
app.get('/unsubscribe', async (req, res) => {
    // 從 URL query 取得參數
    const { email, first_name, last_name, is_news, website, lang } = req.query;
    console.log("Received values:");
    console.log("First Name:", first_name);
    console.log("Last Name:", last_name);
    console.log("Email:", email);
    console.log("is_news:", is_news);
    console.log("Website:", website);
    console.log("Lang:", lang);

    // 將 is_news 字串轉換為 Boolean
    const isNewsBool = is_news === 'true';

    try {
        // Step 1: 發送 POST 請求以取得 access_token（使用原生 fetch）
        const authResponse = await fetch("https://open-nms-api.mio.com/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                "account": "bIUOO0ZnK64DiA==",
                "pswd": "pUBX6YjOi3Yn1tP1VbqKWk7rCnsUzR2giOf1eCjnDJjFCoZlQAzFIWxJzOikrsrB5ZkfxtUxrjTLHD5FXZ4vOvTWHN5u36kEl3blS8SVm7tgDjp1FNzTQzOdMIiDwplJt+iing=="
            })
        });
        const authData = await authResponse.json();
        console.log("auth return data", authData);

        // 取得 access_token
        const accessToken = authData.access_token;

        // Step 2: 發送 PUT 請求，帶入 access_token 與其他參數
        const putResponse = await fetch("https://open-nms-api.mio.com/mdtapi/customer/subscribe/newsletter", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "is_news": isNewsBool,
                "website": website,
                "lang": lang
            })
        });
        const putResult = await putResponse.json();
        console.log("PUT return data", putResult);

        // 若 PUT 回傳 status 為 200，將參數存入 session，再導向 /success
        if (putResult.status === 200) {
            // 儲存資料到 session
            req.session.userData = { email, first_name, last_name, is_news, website, lang };
            return res.redirect('/success');
        } else {
            return res.json({
                status: putResult.status,
                msg: putResult.msg
            });
        }

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Request failed. Please try again.");
    }
});

// 啟動應用，監聽指定埠號
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Node.js app listening on port ${port}`);
});
