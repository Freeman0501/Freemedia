document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const m3uToTxtBtn = document.getElementById('m3uToTxtBtn');
    const txtToM3uBtn = document.getElementById('txtToM3uBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusMsg = document.getElementById('statusMsg');

    // State tracking to know what we are downloading
    let currentOutputFormat = ''; // 'txt' or 'm3u'

    // Show temporary status message (like Toast notification)
    const showStatus = (msg, isError = false) => {
        statusMsg.textContent = msg;
        statusMsg.style.color = isError ? '#ef4444' : '#10b981';
        statusMsg.style.background = isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
        statusMsg.style.borderColor = isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
        statusMsg.classList.add('show');
        
        setTimeout(() => {
            statusMsg.classList.remove('show');
        }, 2200);
    };

    // Converter: M3U -> TXT
    m3uToTxtBtn.addEventListener('click', () => {
        const m3uContent = inputText.value.trim();
        if (!m3uContent) {
            showStatus('請輸入內容！', true);
            // Trigger a quick shake animation
            inputText.style.animation = 'shake 0.4s';
            setTimeout(() => inputText.style.animation = '', 400);
            return;
        }

        const lines = m3uContent.split(/\r?\n/);
        let txtOutput = '';
        const groups = new Map(); // Use Map to maintain grouping

        let tempName = '';
        let tempGroup = '未分類頻道';

        // Parse M3U
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.toUpperCase().startsWith('#EXTINF:')) {
                // Parse group-title="XYZ"
                const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
                if (groupMatch && groupMatch[1]) {
                    tempGroup = groupMatch[1];
                } else {
                    tempGroup = '未分類頻道';
                }

                // Channel name is usually after the last comma
                const lastCommaIdx = line.lastIndexOf(',');
                if (lastCommaIdx !== -1) {
                    tempName = line.substring(lastCommaIdx + 1).trim();
                } else {
                    tempName = 'Unknown Channel';
                }
            } else if (line.match(/^https?:\/\//i) || line.match(/^rtmp:\/\//i) || line.match(/^rtsp:\/\//i)) {
                // If the line is a URL
                if (tempName) {
                    if (!groups.has(tempGroup)) {
                        groups.set(tempGroup, []);
                    }
                    groups.get(tempGroup).push(`${tempName},${line}`);
                    
                    // Reset variables for next entry
                    tempName = ''; 
                }
            }
        }

        // Format map into TXT string
        for (let [groupName, channels] of groups.entries()) {
            txtOutput += `${groupName},#genre#\n`;
            txtOutput += channels.join('\n') + '\n';
        }

        if (!txtOutput.trim()) {
            showStatus('無法解析M3U格式', true);
            return;
        }

        outputText.value = txtOutput.trim();
        currentOutputFormat = 'txt';
        showStatus('轉為 TXT 成功！');
    });

    // Converter: TXT -> M3U
    txtToM3uBtn.addEventListener('click', () => {
        const txtContent = inputText.value.trim();
        if (!txtContent) {
            showStatus('請輸入內容！', true);
            // Trigger a quick shake animation
            inputText.style.animation = 'shake 0.4s';
            setTimeout(() => inputText.style.animation = '', 400);
            return;
        }

        const lines = txtContent.split(/\r?\n/);
        let m3uOutput = '#EXTM3U\n';
        let currentGroup = '未分類頻道';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Check if it's a category/genre line
            if (line.includes(',#genre#')) {
                currentGroup = line.split(',')[0].trim();
            } else if (line.includes(',')) {
                // Assume standard config: "Channel Name,URL"
                const firstCommaIndex = line.indexOf(',');
                const channelName = line.substring(0, firstCommaIndex).trim();
                const url = line.substring(firstCommaIndex + 1).trim();
                
                if (url && (url.startsWith('http') || url.startsWith('rtmp') || url.startsWith('rtsp'))) {
                    // Create M3U format
                    m3uOutput += `#EXTINF:-1 group-title="${currentGroup}",${channelName}\n`;
                    m3uOutput += `${url}\n`;
                }
            }
        }

        if (m3uOutput.trim() === '#EXTM3U') {
             showStatus('無法解析TXT格式', true);
             return;
        }

        outputText.value = m3uOutput.trim();
        currentOutputFormat = 'm3u';
        showStatus('轉為 M3U 成功！');
    });

    // Clear Input Box
    clearBtn.addEventListener('click', () => {
        inputText.value = '';
        inputText.focus();
    });

    // Copy to Clipboard
    copyBtn.addEventListener('click', async () => {
        const textToCopy = outputText.value.trim();
        if (!textToCopy) {
            showStatus('沒有內容可複製', true);
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            showStatus('已複製到剪貼簿！');
        } catch (err) {
            // Fallback for older browsers
            outputText.select();
            document.execCommand('copy');
            showStatus('已複製到剪貼簿！');
            window.getSelection().removeAllRanges();
        }
    });

    // Download Result File
    downloadBtn.addEventListener('click', () => {
        const textToDownload = outputText.value.trim();
        if (!textToDownload) {
            showStatus('沒有內容可下載', true);
            return;
        }
        
        let filename = 'playlist.txt';
        let mimeType = 'text/plain';

        if (currentOutputFormat === 'm3u') {
            filename = 'playlist.m3u';
            mimeType = 'audio/x-mpegurl';
        }

        // Create a blob and trigger download via anchor element
        const blob = new Blob([textToDownload], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        showStatus(`已下載 ${filename}！`);
    });
});

// Add a quick shake animation to document styles dynamically for error state
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}`;
document.head.appendChild(style);
