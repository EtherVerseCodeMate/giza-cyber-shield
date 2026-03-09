const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDirs = ['components', 'pages', 'hooks', 'lib', 'services', 'views'];
const baseDir = path.join(__dirname, 'src');

targetDirs.forEach(dir => {
    const fullDirPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullDirPath)) return;
    walk(fullDirPath, filepath => {
        if (!filepath.endsWith('.ts') && !filepath.endsWith('.tsx')) return;

        let content = fs.readFileSync(filepath, 'utf8');
        let original = content;

        // 1. Array() -> new Array()
        // Make sure we only match Array( outside of variable names
        content = content.replace(/\bArray\(([^)]*)\)/g, 'new Array($1)');

        // 2. parseFloat -> Number.parseFloat
        content = content.replace(/\bparseFloat\(/g, 'Number.parseFloat(');
        content = content.replace(/\bNumber\.Number\.parseFloat/g, 'Number.parseFloat'); // fix double replacement

        // 3. parseInt -> Number.parseInt
        content = content.replace(/\bparseInt\(/g, 'Number.parseInt(');
        content = content.replace(/\bNumber\.Number\.parseInt/g, 'Number.parseInt'); // fix double replacement

        // 4. window -> globalThis (careful with window.location, etc)
        content = content.replace(/\bwindow\./g, 'globalThis.');

        // 5. [arr.length - x] -> .at(-x)
        content = content.replace(/\[\s*([a-zA-Z0-9_]+)\.length\s*-\s*([0-9]+)\s*\]/g, '.at(-$2)');

        // 6. .replace( -> .replaceAll( (only for string literals to be safe)
        content = content.replace(/\.replace\((['"][^'"]+['"])/g, '.replaceAll($1');

        if (content !== original) {
            console.log(`Updated ${filepath}`);
            fs.writeFileSync(filepath, content, 'utf8');
        }
    });
});
