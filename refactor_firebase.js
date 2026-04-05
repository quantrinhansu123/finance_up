const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, 'app');
const componentsDir = path.join(__dirname, 'components');
const libDir = path.join(__dirname, 'debug_user_v2.ts'); // Also this file

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
         return [dir];
    }
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const st = fs.statSync(fullPath);
        if (st && st.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = [...walk(projectDir), ...walk(componentsDir), ...walk(libDir)];

let changedCount = 0;
files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    if (code.includes('firebase/firestore') || code.includes('@/lib/firebase')) {
        let newCode = code.replace(/['"]firebase\/firestore['"]/g, '"@/lib/firebase-compat"');
        newCode = newCode.replace(/['"]@\/lib\/firebase['"]/g, '"@/lib/firebase-compat"');
        
        fs.writeFileSync(file, newCode, 'utf8');
        changedCount++;
        console.log('Updated', file);
    }
});

console.log('Modified', changedCount, 'files.');
