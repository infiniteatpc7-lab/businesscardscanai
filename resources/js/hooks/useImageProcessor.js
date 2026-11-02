/**
 * Hook/helper to compress & downscale camera photos using HTML5 Canvas
 */
export function useImageProcessor() {
    const compressImage = (file, maxDim = 1800, quality = 0.88) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    canvas.toBlob((blob) => {
                        const optimizedFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                            { type: 'image/jpeg' }
                        );
                        resolve({ file: optimizedFile, dataUrl });
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve({ file, dataUrl: e.target.result });
                img.src = e.target.result;
            };
            reader.onerror = () => resolve({ file, dataUrl: null });
            reader.readAsDataURL(file);
        });
    };

    return { compressImage };
}
