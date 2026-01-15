require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const publicDir = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/remove-bg') {
      await handleRemoveBackground(req, res);
      return;
    }

    // 处理认证回调
    if (req.url.startsWith('/auth/callback')) {
      await handleAuthCallback(req, res);
      return;
    }

    await serveStaticAsset(req, res);
  } catch (error) {
    console.error('[server] unexpected error', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '服务器开小差了，请稍后再试。' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

async function serveStaticAsset(req, res) {
  const safePath = sanitizePath(req.url);
  const filePath = path.join(publicDir, safePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let finalPath = resolvedPath;
  if (safePath.endsWith('/')) {
    finalPath = path.join(resolvedPath, 'index.html');
  }

  let stat;
  try {
    stat = fs.statSync(finalPath);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  if (stat.isDirectory()) {
    finalPath = path.join(finalPath, 'index.html');
  }

  fs.readFile(finalPath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }

    const ext = path.extname(finalPath);
    let content = data;

    // 如果是 HTML 文件，注入 Supabase 配置
    if (ext === '.html') {
      content = Buffer.from(
        data.toString()
          .replace('{{SUPABASE_URL}}', SUPABASE_URL)
          .replace('{{SUPABASE_ANON_KEY}}', SUPABASE_ANON_KEY)
      );
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

async function handleAuthCallback(req, res) {
  // 重定向回首页，Supabase 会自动处理认证状态
  res.writeHead(302, { 'Location': '/' });
  res.end();
}

function sanitizePath(urlPath = '/') {
  const cleaned = decodeURI(urlPath.split('?')[0]);
  if (cleaned === '/' || cleaned === '') {
    return 'index.html';
  }

  const withoutLeadingSlash = cleaned.replace(/^\/+/, '');
  let normalized = path.normalize(withoutLeadingSlash);

  if (normalized.startsWith('..')) {
    normalized = 'index.html';
  }

  if (normalized.endsWith(path.sep)) {
    normalized = path.join(normalized, 'index.html');
  }

  return normalized;
}

async function handleRemoveBackground(req, res) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '缺少 remove.bg API Key，请先配置环境变量。' }));
    return;
  }

  const body = await readJSONBody(req);
  const { imageData, fileName } = body || {};

  if (!imageData) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '请提供有效的图片数据。' }));
    return;
  }

  const base64Payload = imageData.replace(/^data:[^;]+;base64,/, '');
  const imageBuffer = Buffer.from(base64Payload, 'base64');

  // 使用 Node.js 原生的 multipart/form-data 格式
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const CRLF = '\r\n';
  
  const parts = [];
  
  // image_file 字段
  parts.push(Buffer.from(`--${boundary}${CRLF}`, 'utf8'));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="image_file"; filename="${fileName || 'upload.png'}"${CRLF}`, 'utf8'));
  parts.push(Buffer.from(`Content-Type: image/png${CRLF}${CRLF}`, 'utf8'));
  parts.push(imageBuffer);
  parts.push(Buffer.from(CRLF, 'utf8'));
  
  // size 字段
  parts.push(Buffer.from(`--${boundary}${CRLF}`, 'utf8'));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="size"${CRLF}${CRLF}`, 'utf8'));
  parts.push(Buffer.from('auto', 'utf8'));
  parts.push(Buffer.from(CRLF, 'utf8'));
  
  // 结束边界
  parts.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf8'));
  
  const formDataBuffer = Buffer.concat(parts);

  const removeBgResponse = await fetch(REMOVE_BG_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formDataBuffer.length.toString()
    },
    body: formDataBuffer
  });

  if (!removeBgResponse.ok) {
    const errorText = await removeBgResponse.text();
    console.error('[remove.bg] error', errorText);
    res.writeHead(removeBgResponse.status, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        message: '去背景失败，请稍后再试。',
        details: tryParseJSON(errorText)
      })
    );
    return;
  }

  const arrayBuffer = await removeBgResponse.arrayBuffer();
  const processedBase64 = Buffer.from(arrayBuffer).toString('base64');

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      processedImage: `data:image/png;base64,${processedBase64}`
    })
  );
}

function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

