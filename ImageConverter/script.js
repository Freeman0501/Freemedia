document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const uploadPlaceholder = document.querySelector('.upload-placeholder');
    const imagePreview = document.getElementById('image-preview');
    const originalInfo = document.getElementById('original-info');
    const controls = document.getElementById('controls');
    
    const formatSelect = document.getElementById('format-select');
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const aspectLockBtn = document.getElementById('aspect-lock');
    const qualityRange = document.getElementById('quality-range');
    const qualityValue = document.getElementById('quality-value');
    const qualityContainer = document.getElementById('quality-container');
    
    const convertBtn = document.getElementById('convert-btn');
    const resetBtn = document.getElementById('reset-btn');

    let originalImage = null;
    let aspectRatio = 1;
    let isAspectLocked = true;

    // --- Upload Logic ---

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.background = 'rgba(99, 102, 241, 0.1)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--glass-border)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--glass-border)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
        
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                aspectRatio = img.width / img.height;
                
                // Update UI
                imagePreview.src = e.target.result;
                uploadPlaceholder.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                controls.classList.remove('hidden');
                
                widthInput.value = img.width;
                heightInput.value = img.height;
                
                const fileSize = (file.size / 1024).toFixed(2);
                originalInfo.textContent = `原始尺寸: ${img.width} x ${img.height} | 檔案大小: ${fileSize} KB`;
                
                // Show/Hide quality slider based on format
                updateQualityVisibility();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Controls Logic ---

    function updateQualityVisibility() {
        const format = formatSelect.value;
        if (format === 'image/jpeg' || format === 'image/webp') {
            qualityContainer.classList.remove('hidden');
        } else {
            qualityContainer.classList.add('hidden');
        }
    }

    formatSelect.addEventListener('change', updateQualityVisibility);

    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = qualityRange.value;
    });

    aspectLockBtn.addEventListener('click', () => {
        isAspectLocked = !isAspectLocked;
        aspectLockBtn.classList.toggle('active', isAspectLocked);
    });

    widthInput.addEventListener('input', () => {
        if (isAspectLocked && originalImage) {
            heightInput.value = Math.round(widthInput.value / aspectRatio);
        }
    });

    heightInput.addEventListener('input', () => {
        if (isAspectLocked && originalImage) {
            widthInput.value = Math.round(heightInput.value * aspectRatio);
        }
    });

    // --- Conversion Logic ---

    convertBtn.addEventListener('click', () => {
        if (!originalImage) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const targetWidth = parseInt(widthInput.value);
        const targetHeight = parseInt(heightInput.value);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Use better scaling quality if available
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
        
        const format = formatSelect.value;
        const quality = parseInt(qualityRange.value) / 100;
        
        let dataUrl;
        let filename = `converted_image`;

        if (format === 'image/svg+xml') {
            // SVG conversion: Wrap canvas data URL in SVG tag
            const canvasData = canvas.toDataURL('image/png');
            const svgContent = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}">
                    <image href="${canvasData}" width="${targetWidth}" height="${targetHeight}" />
                </svg>
            `.trim();
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            dataUrl = URL.createObjectURL(blob);
            filename += '.svg';
        } else if (format === 'image/x-icon') {
            // ICO conversion: Usually PNG-based ICO works in many modern OS
            // Use 256x256 if possible for best compatibility or the specified size
            dataUrl = canvas.toDataURL('image/png');
            filename += '.ico';
        } else {
            dataUrl = canvas.toDataURL(format, quality);
            const extension = format.split('/')[1].replace('jpeg', 'jpg').replace('x-icon', 'ico').replace('svg+xml', 'svg');
            filename += `.${extension}`;
        }
        
        // Trigger download
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        
        // Clean up object URL if it was created from a blob
        if (format === 'image/svg+xml') {
            setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
        }
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('確定要清除所有設定並重新開始嗎？')) {
            originalImage = null;
            fileInput.value = '';
            imagePreview.src = '';
            uploadPlaceholder.classList.remove('hidden');
            previewContainer.classList.add('hidden');
            controls.classList.add('hidden');
            widthInput.value = '';
            heightInput.value = '';
            formatSelect.selectedIndex = 0;
            updateQualityVisibility();
        }
    });
});
