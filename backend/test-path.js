const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const p = path.join(__dirname, 'bin/ffmpeg.exe');
console.log('Target Path:', p);
console.log('Exists:', fs.existsSync(p));

const command = `"${p}" -version`;
console.log('Running Command:', command);

exec(command, (err, stdout, stderr) => {
    if (err) {
        console.log('Exec Error:', err.message);
        // Try another format
        const altCommand = `""${p}" -version"`;
        console.log('Trying Alternative Command:', altCommand);
        exec(altCommand, (err2) => {
            console.log('Alt Exec Result:', err2 ? 'FAILED' : 'SUCCESS');
        });
    } else {
        console.log('Exec Success!');
        console.log('Output:', stdout.split('\n')[0]);
    }
});
