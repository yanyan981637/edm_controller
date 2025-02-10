# 使用官方 Node.js 映像檔，指定版本 22.13.1（內含 npm 10.9.2）
FROM node:22.13.1

# 設定工作目錄
WORKDIR /app

# 複製 package.json 與 package-lock.json（若有）到工作目錄
COPY package*.json ./

# 安裝相依套件
RUN npm install

# 安裝 nodemon（全域安裝）
RUN npm install -g nodemon

# 複製所有專案檔案到工作目錄
COPY . .

# 將容器內 3000 埠號對外開放
EXPOSE 3000

# 執行 npm run dev，此腳本必須在 package.json 中定義為使用 nodemon 啟動 app.js
CMD ["npm", "run", "dev"]
