const https = require('https');

// Игнорируем SSL ошибки
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const getModels = async () => {
  const urlObj = new URL('https://llm-chat.neuraldeep.tech/api/v1/models');
  
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 443,
    path: urlObj.pathname,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjZDAyMTFkLTZlOTYtNGMwMC1hMjNkLTE0YTBiYTE2Zjk5ZCJ9.EP9SmRoe5GlmgjrlRz5fXfG2bL531iI4ui5H292hmAk'
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('\n📋 Available models:');
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach(m => console.log(`  - ${m.id || m.model || m.name}`));
          } else {
            console.log(JSON.stringify(data, null, 2));
          }
        } catch (e) {
          console.log('Raw response:', body);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('Error:', e.message);
      resolve();
    });

    req.end();
  });
};

getModels();
