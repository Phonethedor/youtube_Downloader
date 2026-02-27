const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs de forma segura al renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Obtener información del video
    getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),

    // Descargar video
    downloadVideo: (url, quality, outputPath) =>
        ipcRenderer.invoke('download-video', url, quality, outputPath),

    // Seleccionar carpeta de destino
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Cerrar aplicación
    closeApp: () => ipcRenderer.invoke('close-app'),

    // NUEVAS APIs para archivos y carpetas
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

    // Escuchar progreso de descarga
    onDownloadProgress: (callback) =>
        ipcRenderer.on('download-progress', callback),

    // Remover listeners
    removeAllListeners: (channel) =>
        ipcRenderer.removeAllListeners(channel)
});