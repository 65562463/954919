const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableWebSQL: false,
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // السماح بالوصول إلى الأجهزة الملحقة (USB و Serial) لطابعات الفواتير وقارئ الباركود
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'serial' || permission === 'usb') {
      return true;
    }
    return true;
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    return true;
  });

  // إخفاء شريط القوائم العلوي لتجربة POS أفضل
  mainWindow.setMenuBarVisibility(false);

  // تحميل التطبيق
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
