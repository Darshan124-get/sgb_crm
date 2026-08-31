const app = require('./src/app');
const { execSync } = require('child_process');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Modular Server running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${PORT} is in use. Killing existing process...`);
        try {
            // Windows: find and kill the PID using the port
            const result = execSync(`netstat -ano | findstr :${PORT}`).toString();
            const lines = result.trim().split('\n');
            const pids = new Set();
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
            });
            pids.forEach(pid => {
                try {
                    execSync(`taskkill /PID ${pid} /F`);
                    console.log(`✅ Killed PID ${pid}`);
                } catch (e) { /* already dead */ }
            });
        } catch (e) {
            console.error('Could not auto-kill port process:', e.message);
        }
        setTimeout(() => {
            console.log(`🔄 Retrying server.listen on port ${PORT}...`);
            server.listen(PORT);
        }, 1000);
    } else {
        throw err;
    }
});
// restart trigger 2
