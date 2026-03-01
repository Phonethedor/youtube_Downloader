const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        resizable: false,
        center: true,
        frame: false,          // Elimina la barra de título
        titleBarStyle: 'hidden', // Oculta la barra de título en macOS
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // 🎯 CREAR MENÚ CONTEXTUAL
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Cortar',
            accelerator: 'CmdOrCtrl+X',
            role: 'cut'
        },
        {
            label: 'Copiar',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
        },
        {
            label: 'Pegar',
            accelerator: 'CmdOrCtrl+V',
            role: 'paste'
        },
        { type: 'separator' },
        {
            label: 'Seleccionar todo',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
        },
        { type: 'separator' },
        {
            label: 'Deshacer',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
        },
        {
            label: 'Rehacer',
            accelerator: 'CmdOrCtrl+Y',
            role: 'redo'
        }
    ]);

    // 🖱️ MOSTRAR MENÚ AL HACER CLICK DERECHO
    mainWindow.webContents.on('context-menu', (event, params) => {
        // Solo mostrar en campos de texto editables o cuando hay texto seleccionado
        if (params.isEditable || params.selectionText) {
            contextMenu.popup({
                window: mainWindow,
                x: params.x,
                y: params.y
            });
        }
    });

    // Abrir DevTools en desarrollo (para debug)
    if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Modo desarrollo - abriendo DevTools');
        mainWindow.webContents.openDevTools();
    }
}

// Manejar obtención de información del video
ipcMain.handle('get-video-info', async (event, url) => {
    try {
        console.log('\n🔍 =================================');
        console.log('🔍 INICIANDO BÚSQUEDA DE VIDEO (yt-dlp)');
        console.log('🔍 URL:', url);
        console.log('🔍 =================================');

        if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
            console.log('❌ URL no válida');
            throw new Error('URL de YouTube no válida');
        }

        console.log('📡 Obteniendo información del video...');
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            extractorArgs: 'youtube:player_client=tv,android'
        });

        console.log('📹 Video encontrado:', info.title);
        console.log('👤 Canal:', info.uploader);
        console.log('⏱️ Duración:', info.duration, 'segundos');

        // En lugar de depender de los formatos que YouTube nos censura en la búsqueda (Android API oculta >360p),
        // simplemente enviamos al frontend las calidades estándar que pediste.
        // yt-dlp al momento de descargar con `bestvideo[height<=X]` se encargará de buscar internamente la mejor 
        // manera de obtener esa resolución o la más cercana posible sin arrojar error.
        const uniqueQualities = [
            { value: '1080p', label: '1080p Full HD', height: 1080, hasVideo: true, hasAudio: true },
            { value: '720p', label: '720p HD', height: 720, hasVideo: true, hasAudio: true },
            { value: '480p', label: '480p', height: 480, hasVideo: true, hasAudio: true },
            { value: '360p', label: '360p', height: 360, hasVideo: true, hasAudio: true },
            { value: 'audio', label: 'Solo Audio (MP3)', hasVideo: false, hasAudio: true }
        ];

        console.log('\n✅ CALIDADES ENVIADAS AL RENDERER:', uniqueQualities.length);

        return {
            success: true,
            videoInfo: {
                title: info.title,
                author: info.uploader,
                lengthSeconds: info.duration,
                thumbnail: info.thumbnail,
                viewCount: info.view_count,
                uploadDate: info.upload_date,
                description: info.description || ''
            },
            qualities: uniqueQualities
        };

    } catch (error) {
        console.log('\n❌ ERROR EN BÚSQUEDA:');
        console.error('❌ Error obteniendo info del video:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
});

// Manejar selección de carpeta
ipcMain.handle('select-folder', async () => {
    try {
        console.log('📁 Abriendo selector de carpeta...');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Seleccionar carpeta de destino'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            console.log('📁 Carpeta seleccionada:', result.filePaths[0]);
            return result.filePaths[0];
        }
        console.log('📁 Selección cancelada');
        return null;
    } catch (error) {
        console.error('📁 Error seleccionando carpeta:', error);
        return null;
    }
});

// Manejar apertura de archivo
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        console.log('📂 Abriendo archivo:', filePath);
        const result = await shell.openPath(filePath);

        if (result) {
            console.log('⚠️ Error abriendo archivo:', result);
            return { success: false, error: result };
        }

        console.log('✅ Archivo abierto exitosamente');
        return { success: true };
    } catch (error) {
        console.error('❌ Error abriendo archivo:', error);
        return { success: false, error: error.message };
    }
});

// Manejar apertura de carpeta
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        console.log('📁 Abriendo carpeta:', folderPath);
        const result = await shell.openPath(folderPath);

        if (result) {
            console.log('⚠️ Error abriendo carpeta:', result);
            return { success: false, error: result };
        }

        console.log('✅ Carpeta abierta exitosamente');
        return { success: true };
    } catch (error) {
        console.error('❌ Error abriendo carpeta:', error);
        return { success: false, error: error.message };
    }
});

// Mostrar archivo en explorador
ipcMain.handle('show-in-folder', async (event, filePath) => {
    try {
        console.log('🔍 Mostrando archivo en explorador:', filePath);
        shell.showItemInFolder(filePath);
        console.log('✅ Archivo mostrado en explorador');
        return { success: true };
    } catch (error) {
        console.error('❌ Error mostrando en explorador:', error);
        return { success: false, error: error.message };
    }
});

// Manejar descarga de video
ipcMain.handle('download-video', async (event, url, quality, outputPath) => {
    try {
        console.log('\n⬇️ =================================');
        console.log('⬇️ INICIANDO DESCARGA (yt-dlp)');
        console.log('⬇️ URL:', url);
        console.log('⬇️ Calidad:', quality);
        console.log('⬇️ Carpeta:', outputPath);
        console.log('⬇️ =================================');

        if (!outputPath) throw new Error('Debe seleccionar una carpeta de destino');
        if (!quality) throw new Error('Debe seleccionar una calidad');

        console.log('📡 Obteniendo título del video...');
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            extractorArgs: 'youtube:player_client=tv,android'
        });

        // Limpiamos el título para que Windows lo permita como nombre de archivo
        const cleanTitle = info.title.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
        let formatStr = '';
        let ext = 'mp4';

        if (quality === 'audio') {
            formatStr = 'bestaudio';
            ext = 'mp3';
            console.log('🎵 Formato seleccionado: Solo audio (MP3)');
        } else {
            const height = quality.replace('p', '');
            // yt-dlp selector: intentará descargar el video igual o menor a tu altura 
            // y mezclarlo con el audio en un contenedor mp4.
            formatStr = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
            ext = 'mp4';
            console.log(`📹 Formato seleccionado: Video máximo ${height}p + mejor audio`);
        }

        const filename = `${cleanTitle}_${quality}.${ext}`;
        const outputFile = path.join(outputPath, filename);

        console.log('💾 Archivo de salida:', outputFile);

        const ytDlpOptions = {
            noWarnings: true,
            noCheckCertificate: true,
            extractorArgs: 'youtube:player_client=tv,android',
            format: formatStr,
            output: outputFile
        };

        if (quality === 'audio') {
            ytDlpOptions.extractAudio = true;
            ytDlpOptions.audioFormat = 'mp3';
            ytDlpOptions.audioQuality = 0;
        } else {
            ytDlpOptions.mergeOutputFormat = 'mp4';
        }

        console.log('⬇️ Iniciando proceso de descarga...');
        const subprocess = youtubedl.exec(url, ytDlpOptions);

        // yt-dlp arroja el progreso constante en la salida estándar, la leemos:
        subprocess.stdout.on('data', (data) => {
            const output = data.toString();
            // Match para atrapar mensajes estilo "[download]  10.0% of ~ 10.00MiB"
            const progressMatch = output.match(/\[download\]\s+([\d.]+)%/);
            if (progressMatch) {
                const percent = parseFloat(progressMatch[1]);
                const mainWindowList = BrowserWindow.getAllWindows();
                if (mainWindowList.length > 0) {
                    mainWindowList[0].webContents.send('download-progress', {
                        progress: Math.floor(percent),
                        filename: filename
                    });
                }
            }
        });

        await subprocess;

        console.log('✅ DESCARGA COMPLETADA:');
        console.log('✅ Archivo:', outputFile);
        console.log('⬇️ =================================\n');

        return {
            success: true,
            filename: filename,
            path: outputFile
        };

    } catch (error) {
        console.log('\n❌ ERROR EN DESCARGA:');
        console.error('❌ Error en descarga:', error.message);
        console.log('⬇️ =================================\n');
        return {
            success: false,
            error: error.message
        };
    }
});

// Manejar cierre de aplicación
ipcMain.handle('close-app', () => {
    console.log('🚪 Cerrando aplicación...');
    app.quit();
});

app.whenReady().then(() => {
    console.log('🚀 Electron listo, creando ventana...');
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('🚪 Todas las ventanas cerradas');
    if (process.platform !== 'darwin') {
        console.log('🚪 Saliendo de la aplicación...');
        app.quit();
    }
});

app.on('activate', () => {
    console.log('🔄 Aplicación activada');
    if (BrowserWindow.getAllWindows().length === 0) {
        console.log('🆕 Creando nueva ventana...');
        createWindow();
    }
});