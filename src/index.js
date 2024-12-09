import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import app from './app.js';

dotenv.config();
const port = process.env.PORT || 8080;

const httpsOptions = {
  key: fs.readFileSync('./security/server.key'),
  cert: fs.readFileSync('./security/server.crt')
}

const server = https.createServer(httpsOptions, app);

server.listen(port, () => {
  console.log(`Server running on ${process.env.HOST}:${port}`);
})