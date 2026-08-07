const fs = require('fs');
const path = require('path');

const PRISMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');
const FRONTEND_PATH = path.join(__dirname, '..', 'gtu_ventures_frontend', 'src', 'pages', 'WebsiteManagement');
const BACKEND_PATH = path.join(__dirname, 'src', 'modules', 'website-management');

function parsePrisma() {
  const content = fs.readFileSync(PRISMA_PATH, 'utf-8');
  const models = {};
  
  const regex = /model (Web[A-Za-z0-9]+) {([\s\S]*?)}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const fields = {};
    
    body.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) return;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        fields[parts[0]] = parts[1];
      }
    });
    
    models[modelName] = fields;
  }
  return models;
}

function parseFrontend(dir) {
  const modules = {};
  if (!fs.existsSync(dir)) return modules;
  
  const dirs = fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory());
  for (const mod of dirs) {
    const modPath = path.join(dir, mod);
    const files = fs.readdirSync(modPath).filter(f => f.endsWith('Form.jsx') || f.endsWith('Form.tsx'));
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(modPath, file), 'utf-8');
      const stateMatch = content.match(/useState\(\{\s*([\s\S]*?)\s*\}\)/);
      if (stateMatch) {
        const lines = stateMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
        modules[mod] = lines.map(l => l.split(':')[0].trim());
      }
    }
  }
  return modules;
}

function runAudit() {
  const models = parsePrisma();
  const frontend = parseFrontend(FRONTEND_PATH);
  
  console.log('=== PRISMA MODELS ===');
  Object.keys(models).forEach(k => {
    if (k.startsWith('Web')) {
       console.log(`\nModel ${k}:`);
       console.log(Object.keys(models[k]).join(', '));
    }
  });
  
  console.log('\n=== FRONTEND FORMS ===');
  Object.keys(frontend).forEach(k => {
    console.log(`\nModule ${k}:`);
    console.log(frontend[k].join(', '));
  });
}

runAudit();
