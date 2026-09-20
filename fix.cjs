const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      const newContent = content.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, p1) => {
        if (p1.endsWith('.js')) return match;
        return `from '${p1}.js'`;
      });
      if (content !== newContent) {
        fs.writeFileSync(p, newContent);
      }
    }
  }
}

walk('api');
