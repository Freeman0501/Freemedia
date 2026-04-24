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
    let originalPdfDoc = null;
    let originalFileName = '';
    let aspectRatio = 1;
    let isAspectLocked = true;

    // PDF.js configuration
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            alert('請上傳圖片或 PDF 檔案！');
            return;
        }

        originalFileName = file.name.split('.').slice(0, -1).join('.');
        originalPdfDoc = null;

        if (file.type === 'application/pdf') {
            handlePdfFile(file);
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

    async function handlePdfFile(file) {
        const reader = new FileReader();
        reader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                const pdf = await loadingTask.promise;
                originalPdfDoc = pdf;
                const pageCount = pdf.numPages;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;
                
                const dataUrl = canvas.toDataURL('image/png');
                const img = new Image();
                img.onload = () => {
                    originalImage = img;
                    aspectRatio = img.width / img.height;
                    
                    imagePreview.src = dataUrl;
                    uploadPlaceholder.classList.add('hidden');
                    previewContainer.classList.remove('hidden');
                    controls.classList.remove('hidden');
                    
                    widthInput.value = img.width;
                    heightInput.value = img.height;
                    
                    const fileSize = (file.size / 1024).toFixed(2);
                    originalInfo.textContent = `PDF 解析尺寸: ${Math.round(viewport.width)} x ${Math.round(viewport.height)} | 頁數: ${pageCount} | 檔案大小: ${fileSize} KB`;
                    
                    updateQualityVisibility();
                };
                img.src = dataUrl;
            } catch (err) {
                console.error('PDF 讀取錯誤:', err);
                alert('無法讀取此 PDF 檔案，請確保它是有效的 PDF。');
            }
        };
        reader.readAsArrayBuffer(file);
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

    convertBtn.addEventListener('click', async () => {
        if (!originalImage && !originalPdfDoc) return;

        const format = formatSelect.value;
        const quality = parseInt(qualityRange.value) / 100;
        const targetWidth = parseInt(widthInput.value);
        const targetHeight = parseInt(heightInput.value);
        
        // If it's a multi-page PDF, process all pages
        if (originalPdfDoc && originalPdfDoc.numPages > 1) {
            await convertMultiPagePdf(originalPdfDoc, targetWidth, targetHeight, format, quality);
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Use better scaling quality if available
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw white background for JPEGs
        if (format === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
        }
        
        ctx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
        
        let dataUrl;
        let filename = originalFileName || 'converted_image';

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
            // ICO, PDF conversion: Usually PNG-based ICO works in many modern OS. PDF is handled by jsPDF.
            // Use 256x256 if possible for best compatibility or the specified size
            dataUrl = canvas.toDataURL('image/png');
            filename += '.ico';
        } else if (format === 'application/pdf') {
            // PDF conversion: Use jsPDF to wrap the image
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [targetWidth, targetHeight]
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, targetWidth, targetHeight);
            dataUrl = pdf.output('bloburl');
            filename += '.pdf';
        } else {
            dataUrl = canvas.toDataURL(format, quality);
            const extension = format.split('/')[1].replace('jpeg', 'jpg').replace('x-icon', 'ico').replace('svg+xml', 'svg').replace('pdf', 'pdf');
            filename += `.${extension}`;
        }
        
        // Trigger download
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        
        // Clean up object URL if it was created from a blob
        if (format === 'image/svg+xml' || format === 'application/pdf') {
            setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
        }
    });

    async function convertMultiPagePdf(pdf, width, height, format, quality) {
        const zip = new JSZip();
        const extension = format.split('/')[1].replace('jpeg', 'jpg').replace('x-icon', 'ico').replace('svg+xml', 'svg').replace('pdf', 'pdf');
        
        // Show a simple loading state if possible (optional, but good for UX)
        convertBtn.disabled = true;
        const originalBtnText = convertBtn.innerHTML;
        
        try {
            for (let i = 1; i <= pdf.numPages; i++) {
                convertBtn.innerHTML = `<span>正在處理第 ${i}/${pdf.numPages} 頁...</span>`;
                
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw white background for PDF pages (since they often have transparency)
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                // PDF pages are already at the correct ratio if we scale correctly, but here we force the user's width/height
                // We draw the page onto our canvas
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                
                await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;
                ctx.drawImage(tempCanvas, 0, 0, width, height);
                
                let blob;
                if (format === 'application/pdf') {
                    // Page to individual PDF
                    const { jsPDF } = window.jspdf;
                    const singlePdf = new jsPDF({
                        orientation: width > height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [width, height]
                    });
                    singlePdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height);
                    blob = singlePdf.output('blob');
                } else if (format === 'image/svg+xml') {
                    const canvasData = canvas.toDataURL('image/png');
                    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${canvasData}" width="${width}" height="${height}" /></svg>`;
                    blob = new Blob([svgContent], { type: 'image/svg+xml' });
                } else {
                    blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
                }
                
                const pageNum = i.toString().padStart(4, '0');
                zip.file(`${originalFileName}-${pageNum}.${extension}`, blob);
            }
            
            convertBtn.innerHTML = `<span>正在打包 ZIP...</span>`;
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.download = `${originalFileName}_converted.zip`;
            link.href = URL.createObjectURL(content);
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
            
        } catch (err) {
            console.error('多頁轉換錯誤:', err);
            alert('轉換過程中發生錯誤。');
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = originalBtnText;
        }
    }

    resetBtn.addEventListener('click', () => {
        if (confirm('確定要清除所有設定並重新開始嗎？')) {
            originalImage = null;
            originalPdfDoc = null;
            originalFileName = '';
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
