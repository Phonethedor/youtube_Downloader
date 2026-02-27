document.addEventListener('DOMContentLoaded', function () {
    console.log('YouTube Downloader - Renderer cargado');

    // Referencias a elementos DOM
    const searchForm = document.getElementById('searchForm');
    const videoCard = document.getElementById('videoCard');
    const urlInput = document.getElementById('url');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const videoDuration = document.getElementById('videoDuration');
    const videoChannel = document.getElementById('videoChannel');
    const downloadQuality = document.getElementById('downloadQuality');
    const downloadBtn = document.getElementById('downloadBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    let currentVideoInfo = null;
    let selectedOutputPath = null;

    // Manejar envío del formulario de búsqueda
    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const url = urlInput.value.trim();
        if (!url) {
            showAlert('Por favor ingresa una URL de YouTube', 'warning');
            return;
        }

        await searchVideo(url);
    });

    // Manejar click del botón de descarga
    downloadBtn.addEventListener('click', async function () {
        if (!currentVideoInfo) {
            showAlert('Primero busca un video', 'warning');
            return;
        }

        if (!selectedOutputPath) {
            // Seleccionar carpeta automáticamente
            selectedOutputPath = await window.electronAPI.selectFolder();
            if (!selectedOutputPath) {
                showAlert('Debes seleccionar una carpeta de destino', 'warning');
                return;
            }
        }

        const quality = downloadQuality.value;
        await downloadVideo(currentVideoInfo.url, quality, selectedOutputPath);
    });

    // Función para buscar video
    async function searchVideo(url) {
        try {
            // Mostrar estado de carga
            setLoadingState(true);
            videoCard.classList.add('d-none');

            console.log('🔍 Buscando video:', url);
            const result = await window.electronAPI.getVideoInfo(url);
            console.log('📋 Resultado completo:', result);

            if (result.success) {
                console.log('✅ Video encontrado');
                console.log('📹 Info del video:', result.videoInfo);
                console.log('🎬 Calidades recibidas:', result.qualities);

                // Mostrar información del video
                displayVideoInfo(result.videoInfo, result.qualities);
                currentVideoInfo = { ...result.videoInfo, url: url };
                videoCard.classList.remove('d-none');
                showAlert('Video encontrado exitosamente', 'success');
            } else {
                console.error('❌ Error en búsqueda:', result.error);
                showAlert(`Error: ${result.error}`, 'danger');
            }

        } catch (error) {
            console.error('💥 Error buscando video:', error);
            showAlert('Error buscando el video', 'danger');
        } finally {
            setLoadingState(false);
        }
    }

    // Función para mostrar información del video
    function displayVideoInfo(videoInfo, qualities) {
        console.log('🖼️ Actualizando interfaz con:', { videoInfo, qualities });

        // Actualizar thumbnail - ARREGLADO
        videoThumbnail.src = videoInfo.thumbnail;
        videoThumbnail.alt = videoInfo.title;
        // Arreglar el thumbnail cortado
        videoThumbnail.style.height = '150px';
        videoThumbnail.style.objectFit = 'contain';
        videoThumbnail.style.backgroundColor = '#f8f9fa';

        // Actualizar información
        videoTitle.textContent = videoInfo.title;
        videoChannel.textContent = `Canal: ${videoInfo.author}`;

        // Formatear duración
        const duration = formatDuration(parseInt(videoInfo.lengthSeconds));
        videoDuration.textContent = `Duración: ${duration}`;

        // Actualizar opciones de calidad - MEJORADO
        console.log('📊 Procesando calidades...');
        downloadQuality.innerHTML = '';

        if (!qualities || qualities.length === 0) {
            console.warn('⚠️ No se recibieron calidades');
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay calidades disponibles';
            downloadQuality.appendChild(option);
            return;
        }

        console.log(`🎯 Agregando ${qualities.length} calidades:`);
        qualities.forEach((quality, index) => {
            console.log(`  ${index + 1}. ${quality.value} - ${quality.label}`);
            const option = document.createElement('option');
            option.value = quality.value;
            option.textContent = quality.label;
            downloadQuality.appendChild(option);
        });

        console.log('✅ Dropdown actualizado con', downloadQuality.children.length, 'opciones');
    }

    // Función para descargar video - ACTUALIZADA CON BOTONES
    async function downloadVideo(url, quality, outputPath) {
        try {
            // Mostrar progreso
            showProgress();
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Preparando...';

            // Configurar listener para progreso
            window.electronAPI.onDownloadProgress((event, progressData) => {
                updateProgress(progressData.progress, progressData.filename);
            });

            // Iniciar descarga
            const result = await window.electronAPI.downloadVideo(url, quality, outputPath);

            if (result.success) {
                // MOSTRAR MENSAJE MEJORADO CON BOTONES
                showDownloadCompleteAlert(result.filename, result.path, outputPath);
            } else {
                showAlert(`Error descargando: ${result.error}`, 'danger');
            }

        } catch (error) {
            console.error('Error en descarga:', error);
            showAlert('Error durante la descarga', 'danger');
        } finally {
            // Limpiar
            hideProgress();
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="bi bi-download"></i> Descargar';
            window.electronAPI.removeAllListeners('download-progress');
        }
    }

    // NUEVA FUNCIÓN para mostrar alerta de descarga completada con botones
    function showDownloadCompleteAlert(filename, filePath, folderPath) {
        // Crear elemento de alerta personalizada
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-3">
                    <i class="bi bi-check-circle-fill fs-4 text-success"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="alert-heading mb-2">¡Descarga completada!</h6>
                    <p class="mb-2"><strong>Archivo:</strong> ${filename}</p>
                    <div class="d-flex gap-2 flex-wrap">
                        <button type="button" class="btn btn-outline-primary btn-sm" id="openFileBtn">
                            <i class="bi bi-play-circle"></i> Abrir archivo
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="openFolderBtn">
                            <i class="bi bi-folder2-open"></i> Abrir carpeta
                        </button>
                        <button type="button" class="btn btn-outline-info btn-sm" id="showInExplorerBtn">
                            <i class="bi bi-search"></i> Mostrar en explorador
                        </button>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
            </div>
        `;

        // Insertar después del formulario
        searchForm.insertAdjacentElement('afterend', alertDiv);

        // Agregar event listeners a los botones
        const openFileBtn = alertDiv.querySelector('#openFileBtn');
        const openFolderBtn = alertDiv.querySelector('#openFolderBtn');
        const showInExplorerBtn = alertDiv.querySelector('#showInExplorerBtn');

        // Abrir archivo
        openFileBtn.addEventListener('click', async () => {
            try {
                openFileBtn.disabled = true;
                openFileBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Abriendo...';

                const result = await window.electronAPI.openFile(filePath);

                if (!result.success) {
                    showAlert(`Error abriendo archivo: ${result.error}`, 'warning');
                }
            } catch (error) {
                showAlert('Error abriendo el archivo', 'danger');
            } finally {
                openFileBtn.disabled = false;
                openFileBtn.innerHTML = '<i class="bi bi-play-circle"></i> Abrir archivo';
            }
        });

        // Abrir carpeta
        openFolderBtn.addEventListener('click', async () => {
            try {
                openFolderBtn.disabled = true;
                openFolderBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Abriendo...';

                const result = await window.electronAPI.openFolder(folderPath);

                if (!result.success) {
                    showAlert(`Error abriendo carpeta: ${result.error}`, 'warning');
                }
            } catch (error) {
                showAlert('Error abriendo la carpeta', 'danger');
            } finally {
                openFolderBtn.disabled = false;
                openFolderBtn.innerHTML = '<i class="bi bi-folder2-open"></i> Abrir carpeta';
            }
        });

        // Mostrar en explorador
        showInExplorerBtn.addEventListener('click', async () => {
            try {
                showInExplorerBtn.disabled = true;
                showInExplorerBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Mostrando...';

                const result = await window.electronAPI.showInFolder(filePath);

                if (!result.success) {
                    showAlert(`Error mostrando en explorador: ${result.error}`, 'warning');
                }
            } catch (error) {
                showAlert('Error mostrando en explorador', 'danger');
            } finally {
                showInExplorerBtn.disabled = false;
                showInExplorerBtn.innerHTML = '<i class="bi bi-search"></i> Mostrar en explorador';
            }
        });

        // Auto-remover después de 30 segundos (más tiempo porque tiene botones)
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 30000);
    }

    // Funciones de utilidad
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    function setLoadingState(loading) {
        const submitBtn = searchForm.querySelector('button[type="submit"]');

        if (loading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Buscando...';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-search"></i> Buscar';
        }
    }

    function showProgress() {
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }

    function updateProgress(percent, filename) {
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';

        if (filename) {
            const progressLabel = progressContainer.querySelector('.text-muted');
            progressLabel.textContent = `Descargando: ${filename}`;
        }
    }

    function hideProgress() {
        progressContainer.classList.add('d-none');
    }

    function showAlert(message, type = 'info') {
        // Crear elemento de alerta simple
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="me-2">
                    ${type === 'success' ? '<i class="bi bi-check-circle-fill"></i>' :
                type === 'danger' ? '<i class="bi bi-exclamation-triangle-fill"></i>' :
                    type === 'warning' ? '<i class="bi bi-exclamation-circle-fill"></i>' :
                        '<i class="bi bi-info-circle-fill"></i>'}
                </div>
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
            </div>
        `;

        // Insertar después del formulario
        searchForm.insertAdjacentElement('afterend', alertDiv);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    const closeAppBtn = document.getElementById('closeApp');
    closeAppBtn.addEventListener('click', async () => {
        await window.electronAPI.closeApp();
    });
});