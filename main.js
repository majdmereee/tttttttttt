const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');
const QRCode = require('qrcode');

let mainWindow = null;
let isConnected = false;
let currentQrData = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1500, height: 950, minWidth: 1200, minHeight: 750,
        title: 'Fly Chicken | لوحة التحكم، المنيو واستوديو التصميم',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.maximize();
    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        if (isConnected) mainWindow.webContents.send('status-update', 'connected');
        else if (currentQrData) {
            mainWindow.webContents.send('qr-code', currentQrData);
            mainWindow.webContents.send('status-update', 'qr_ready');
        } else mainWindow.webContents.send('status-update', 'disconnected');
    });
}

ipcMain.on('request-whatsapp-status', (event) => {
    event.reply('status-update', isConnected ? 'connected' : (currentQrData ? 'qr_ready' : 'disconnected'));
    if (currentQrData) event.reply('qr-code', currentQrData);
});

ipcMain.on('trigger-desktop-notif', (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notif = new Notification({ title, body });
        notif.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        notif.show();
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
