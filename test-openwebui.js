const https = require('https');

// Игнорируем SSL ошибки
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const testEndpoint = async (url, model) => {
  const data = JSON.stringify({
    model: model,
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false
  });

  const urlObj = new URL(url);
  
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 443,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjZDAyMTFkLTZlOTYtNGMwMC1hMjNkLTE0YTBiYTE2Zjk5ZCJ9.EP9SmRoe5GlmgjrlRz5fXfG2bL531iI4ui5H292hmAk',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      console.log(`\n✅ ${url}`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.log('Body:', body.substring(0, 500));
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`\n❌ ${url}`);
      console.error('Error:', e.message);
      resolve();
    });

    req.write(data);
    req.end();
  });
};

(async () => {
  console.log('Testing Open WebUI endpoints...\n');
  
  await testEndpoint('https://llm-chat.neuraldeep.tech/api/v1/chat/completions', 'openai/gpt-5.2');
  await testEndpoint('https://llm-chat.neuraldeep.tech/api/chat/completions', 'openai/gpt-5.2');
  await testEndpoint('https://llm-chat.neuraldeep.tech/api/chat', 'openai/gpt-5.2');
  await testEndpoint('https://llm-chat.neuraldeep.tech/v1/chat/completions', 'openai/gpt-5.2');
})();
