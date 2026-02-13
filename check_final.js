const fs = require('fs');
const content = fs.readFileSync('/Users/gafardgnane/Downloads/icc-webradio-app/src/components/BibleReader.tsx', 'utf8');
const lines = content.split('\n');

const tags = ['div', 'section', 'aside', 'main'];

tags.forEach(tag => {
    const stack = [];
    const openRegex = new RegExp(`<${tag}(?![^>]*\\/>)`, 'g');
    const closeRegex = new RegExp(`<\\/${tag}\\s*>`, 'g');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        while ((match = openRegex.exec(line)) !== null) {
            stack.push(i + 1);
        }
        while ((match = closeRegex.exec(line)) !== null) {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`Orphan ${tag} closure at line ${i + 1}`);
            }
        }
    }

    if (stack.length > 0) {
        console.log(`\nOrphan ${tag} openings for <${tag}: Line ${stack.join(', ')}`);
    } else {
        console.log(`All <${tag}> tags are balanced!`);
    }
});
