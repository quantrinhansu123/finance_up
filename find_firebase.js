const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, 'app');
const componentsDir = path.join(__dirname, 'components');
const libDir = path.join(__dirname, 'lib'); // already refactored mostly, but keep just in case

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
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

let firebaseFiles = [];
files.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    if (code.includes('firebase/firestore') || code.includes('@/lib/firebase')) {
        firebaseFiles.push(file);
    }
});

console.log(firebaseFiles.join('\n'));
