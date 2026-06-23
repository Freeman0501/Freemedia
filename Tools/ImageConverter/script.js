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
    const convertOriginalBtn = document.getElementById('convert-original-btn');
    const resetBtn = document.getElementById('reset-btn');

    let selectedFiles = [];
    let firstImageAspectRatio = 1;
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
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (validFiles.length === 0) {
            alert('請上傳圖片或 PDF 檔案！');
            return;
        }

        selectedFiles = validFiles;
        const firstFile = selectedFiles[0];

        if (firstFile.type === 'application/pdf') {
            previewPdf(firstFile, selectedFiles.length);
        } else {
            previewImage(firstFile, selectedFiles.length);
        }
    }

    function previewImage(file, totalCount) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                firstImageAspectRatio = img.width / img.height;
                
                imagePreview.src = e.target.result;
                uploadPlaceholder.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                controls.classList.remove('hidden');
                
                widthInput.value = img.width;
                heightInput.value = img.height;
                
                const fileSizeInfo = totalCount > 1 ? `已選擇 ${totalCount} 個檔案` : `檔案大小: ${(file.size / 1024).toFixed(2)} KB`;
                originalInfo.textContent = `原始尺寸(首圖): ${img.width} x ${img.height} | ${fileSizeInfo}`;
                
                updateQualityVisibility();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function previewPdf(file, totalCount) {
        const reader = new FileReader();
        reader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                const pdf = await loadingTask.promise;
                const pageCount = pdf.numPages;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                const dataUrl = canvas.toDataURL('image/png');
                const img = new Image();
                img.onload = () => {
                    firstImageAspectRatio = img.width / img.height;
                    
                    imagePreview.src = dataUrl;
                    uploadPlaceholder.classList.add('hidden');
                    previewContainer.classList.remove('hidden');
                    controls.classList.remove('hidden');
                    
                    widthInput.value = img.width;
                    heightInput.value = img.height;
                    
                    const fileSizeInfo = totalCount > 1 ? `已選擇 ${totalCount} 個檔案` : `頁數: ${pageCount} | 檔案大小: ${(file.size / 1024).toFixed(2)} KB`;
                    originalInfo.textContent = `PDF 解析尺寸(首圖): ${Math.round(viewport.width)} x ${Math.round(viewport.height)} | ${fileSizeInfo}`;
                    
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

    const lockIconClosed = document.getElementById('lock-icon-closed');
    const lockIconOpen = document.getElementById('lock-icon-open');
    const lockStatusLabel = document.getElementById('lock-status-label');

    aspectLockBtn.addEventListener('click', () => {
        isAspectLocked = !isAspectLocked;
        aspectLockBtn.classList.toggle('active', isAspectLocked);
        if (lockIconClosed && lockIconOpen) {
            lockIconClosed.classList.toggle('hidden', !isAspectLocked);
            lockIconOpen.classList.toggle('hidden', isAspectLocked);
        }
        if (lockStatusLabel) {
            lockStatusLabel.textContent = isAspectLocked ? '鎖定' : '解鎖';
        }
    });

    widthInput.addEventListener('input', () => {
        if (isAspectLocked && firstImageAspectRatio) {
            heightInput.value = Math.round(widthInput.value / firstImageAspectRatio);
        }
    });

    heightInput.addEventListener('input', () => {
        if (isAspectLocked && firstImageAspectRatio) {
            widthInput.value = Math.round(heightInput.value * firstImageAspectRatio);
        }
    });

    // --- Conversion Logic ---

    convertBtn.addEventListener('click', () => startConversion(false));
    if (convertOriginalBtn) {
        convertOriginalBtn.addEventListener('click', () => startConversion(true));
    }

    async function startConversion(keepOriginalDimensions) {
        if (selectedFiles.length === 0) return;

        const format = formatSelect.value;
        const quality = parseInt(qualityRange.value) / 100;
        
        // Disable UI
        const activeBtn = keepOriginalDimensions ? convertOriginalBtn : convertBtn;
        activeBtn.disabled = true;
        const originalBtnText = activeBtn.innerHTML;

        try {
            const zip = new JSZip();
            let fileCount = 0;
            let singleBlob = null;
            let singleFilename = '';
            let isSingleOutput = true;

            for (let fIdx = 0; fIdx < selectedFiles.length; fIdx++) {
                const file = selectedFiles[fIdx];
                const originalFileName = file.name.split('.').slice(0, -1).join('.');
                
                activeBtn.innerHTML = `<span>正在處理檔案 ${fIdx + 1}/${selectedFiles.length}...</span>`;
                
                if (file.type === 'application/pdf') {
                    const typedarray = new Uint8Array(await file.arrayBuffer());
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    
                    if (selectedFiles.length > 1 || pdf.numPages > 1) isSingleOutput = false;

                    for (let i = 1; i <= pdf.numPages; i++) {
                        activeBtn.innerHTML = `<span>正在處理檔案 ${fIdx + 1}/${selectedFiles.length} (第 ${i}/${pdf.numPages} 頁)...</span>`;
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 2.0 });
                        
                        const targetWidth = keepOriginalDimensions ? viewport.width : (parseInt(widthInput.value) || viewport.width);
                        const targetHeight = keepOriginalDimensions ? viewport.height : (parseInt(heightInput.value) || viewport.height);
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        if (format === 'image/jpeg') {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, targetWidth, targetHeight);
                        }

                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = viewport.width;
                        tempCanvas.height = viewport.height;
                        await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport: viewport }).promise;
                        
                        ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
                        
                        const { blob, extension } = await convertCanvasToBlob(canvas, format, quality, targetWidth, targetHeight);
                        const suffix = pdf.numPages > 1 ? `-${i.toString().padStart(4, '0')}` : '';
                        const filename = `${originalFileName}${suffix}.${extension}`;
                        
                        if (isSingleOutput && selectedFiles.length === 1 && pdf.numPages === 1) {
                            singleBlob = blob;
                            singleFilename = filename;
                        } else {
                            let finalName = filename;
                            let counter = 1;
                            while(zip.file(finalName)) {
                                finalName = `${originalFileName}${suffix}_${counter}.${extension}`;
                                counter++;
                            }
                            zip.file(finalName, blob);
                        }
                        fileCount++;
                    }
                } else {
                    if (selectedFiles.length > 1) isSingleOutput = false;
                    
                    const img = new Image();
                    img.src = await fileToDataURL(file);
                    await new Promise(r => img.onload = r);
                    
                    const targetWidth = keepOriginalDimensions ? img.width : (parseInt(widthInput.value) || img.width);
                    const targetHeight = keepOriginalDimensions ? img.height : (parseInt(heightInput.value) || img.height);
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    if (format === 'image/jpeg') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, targetWidth, targetHeight);
                    }
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    
                    const { blob, extension } = await convertCanvasToBlob(canvas, format, quality, targetWidth, targetHeight);
                    const filename = `${originalFileName}.${extension}`;
                    
                    if (isSingleOutput && selectedFiles.length === 1) {
                        singleBlob = blob;
                        singleFilename = filename;
                    } else {
                        let finalName = filename;
                        let counter = 1;
                        while(zip.file(finalName)) {
                            finalName = `${originalFileName}_${counter}.${extension}`;
                            counter++;
                        }
                        zip.file(finalName, blob);
                    }
                    fileCount++;
                }
            }

            if (isSingleOutput && singleBlob) {
                downloadBlob(singleBlob, singleFilename);
            } else if (fileCount > 0) {
                activeBtn.innerHTML = `<span>正在打包 ZIP...</span>`;
                const content = await zip.generateAsync({ type: 'blob' });
                downloadBlob(content, 'converted_files.zip');
            }

        } catch (err) {
            console.error('轉換錯誤:', err);
            alert('轉換過程中發生錯誤。');
        } finally {
            activeBtn.disabled = false;
            activeBtn.innerHTML = originalBtnText;
        }
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function convertCanvasToBlob(canvas, format, quality, width, height) {
        let extension = format.split('/')[1].replace('jpeg', 'jpg').replace('x-icon', 'ico').replace('svg+xml', 'svg').replace('pdf', 'pdf');
        let blob;
        
        if (format === 'image/svg+xml') {
            const canvasData = canvas.toDataURL('image/png');
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${canvasData}" width="${width}" height="${height}" /></svg>`;
            blob = new Blob([svgContent], { type: 'image/svg+xml' });
        } else if (format === 'application/pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height);
            blob = pdf.output('blob');
        } else {
            blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
        }
        return { blob, extension };
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    resetBtn.addEventListener('click', () => {
        if (confirm('確定要清除所有設定並重新開始嗎？')) {
            selectedFiles = [];
            firstImageAspectRatio = 1;
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
