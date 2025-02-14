# 使用官方 Node.js 映像檔，指定版本 22.13.1（內含 npm 10.9.2）
FROM node:22.13.1

# 設定容器內的工作目錄
WORKDIR /app

# 複製 package*.json 到容器，安裝依賴
COPY package*.json ./

# 安裝相依套件
RUN npm install

# 全域安裝 nodemon
RUN npm install -g nodemon

RUN npm install -g express-ejs-layouts

# 開放 3000 Port
EXPOSE 3000

# 預設命令（在 docker-compose.yaml 可被 command 覆蓋）
CMD ["npm", "run", "dev"]
