const express = require('express');
const path = require('path');
const app = express();

// 设置静态资源目录
app.use(express.static(path.join(__dirname, 'static')));

app.get('/json', (req, res) => {
    const data = {};
    res.json(data);
});

// 启动服务器
app.listen(8081, () => {
   console.log('Server running at http://127.0.0.1:8081');
});
