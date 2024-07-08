// Update the `demo` and `version` when building
import {GLOBALS} from './node/main-globals';
import * as path from 'path';
import {app, BrowserWindow, dialog, ipcMain, protocol, screen, systemPreferences} from 'electron';
// Methods
import {createTouchBar} from './node/main-touch-bar';
import {setUpIpcForServer} from './node/server';
import {setUpIpcMessages} from './node/main-ipc';
import {
    parseAdditionalExtensions,
    sendFinalObjectToAngular,
    setUpDirectoryWatchers,
    upgradeToVersion3,
    writeVhaFileToDisk
} from './node/main-support';

// Interfaces
import {FinalObject} from './interfaces/final-object.interface';
import {SettingsObject} from './interfaces/settings-object.interface';
import {WizardOptions} from './interfaces/wizard-options.interface';
import {preventSleep, resetAllQueues} from './node/main-extract-async';


GLOBALS.macVersion = process.platform === 'darwin';

const fs = require('fs');
const electron = require('electron');
const {nativeTheme} = require('electron');

const windowStateKeeper = require('electron-window-state');
const crypto = require('crypto')

// Variables
const pathToAppData = app.getPath('appData');
const pathToPortableApp = process.env.PORTABLE_EXECUTABLE_DIR;
GLOBALS.settingsPath = pathToPortableApp ? pathToPortableApp : path.join(pathToAppData, 'video-hub-app-2');

const English = require('./i18n/en.json');
let systemMessages = English.SYSTEM; // Set English as default; update via `system-messages-updated`

let screenWidth;
let screenHeight;

// TODO: CLEAN UP
let macFirstRun = true; // detect if it's the 1st time Mac is opening the file or something like that
let userWantedToOpen: string = null; // find a better pattern for handling this functionality

electron.Menu.setApplicationMenu(null);

// =================================================================================================

let win;
let myWindow = null;
const args = process.argv.slice(1);
const serve: boolean = args.some(val => val === '--serve');

GLOBALS.debug = args.some(val => val === '--debug');
if (GLOBALS.debug) {
    console.log('Debug mode enabled!');
}

// =================================================================================================

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// For windows -- when loading the app the first time
if (args[0]) {
    if (!serve) {
        userWantedToOpen = args[0]; // TODO -- clean up file-opening code to not use variable
    }
}

const gotTheLock = app.requestSingleInstanceLock(); // Open file on windows from file double click

if (!gotTheLock) {
    app.quit();
} else {

    app.on('second-instance', (event, argv: string[], workingDirectory: string) => {

        // dialog.showMessageBox(win, {
        //   message: 'second-instance: \n' + argv[0] + ' \n' + argv[1],
        //   buttons: ['OK']
        // });

        if (argv.length > 1) {
            console.log("We are stuck heeeeeeeeeere")
            GLOBALS.angularApp.sender.send('please-open-wizard');
            // openThisDamnFile(argv[argv.length - 1]);
        }

        // Someone tried to run a second instance, we should focus our window.
        if (myWindow) {
            if (myWindow.isMinimized()) {
                myWindow.restore();
            }
            myWindow.focus();
        }
    });
}

function createWindow() {
    const desktopSize = screen.getPrimaryDisplay().workAreaSize;

    screenWidth = desktopSize.width;
    screenHeight = desktopSize.height;
    const mainWindowState = windowStateKeeper({
        defaultWidth: 850,
        defaultHeight: 850
    });

    if (GLOBALS.macVersion) {
        electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
            {
                label: app.name,
                submenu: [
                    {role: 'quit'},
                    {role: 'hide'},
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    {role: 'selectAll'},
                    {role: 'cut'},
                    {role: 'copy'},
                    {role: 'paste'}
                ]
            },
            {
                label: "View",
                submenu: [
                    {role: "togglefullscreen"},
                ]
            },
            {
                label: "Window",
                role: 'windowMenu',
            },
        ]));
    }

    // Create the browser window.
    win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            allowRunningInsecureContent: true,
            contextIsolation: false,
            webSecurity: false  // allow files from hard disk to show up
        },
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        center: true,
        minWidth: 420,
        minHeight: 250,
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png'),
        frame: false  // removes the frame from the window completely
    });
    mainWindowState.manage(win);

    myWindow = win;

    // Open the DevTools.
    if (serve) {
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/node_modules/electron`)
        });
        win.loadURL('http://localhost:4200');
        setTimeout(() => {
            win.webContents.openDevTools();
        }, 1000);
    } else {
        const url = require('url').format({
            pathname: path.join(__dirname, 'dist/index.html'),
            protocol: 'file:',
            slashes: true
        });

        win.loadURL(url);
    }

    if (GLOBALS.macVersion) {
        const touchBar = createTouchBar();
        if (touchBar) {
            win.setTouchBar(touchBar);
        }
    }

    // Watch for computer powerMonitor
    // https://electronjs.org/docs/api/power-monitor
    electron.powerMonitor.on('shutdown', () => {
        getAngularToShutDown();
    });

    win.on('close', (event) => {
        if (!GLOBALS.readyToQuit) {
            event.preventDefault();
            getAngularToShutDown();
        }
    });

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store window
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });

    // Does not seem to be needed to remove all the Mac taskbar menu items
    // win.setMenu(null);
}


try {

    // OPEN FILE ON MAC FROM FILE DOUBLE CLICK
    // THIS RUNS (ONLY) on MAC !!!
    app.on('will-finish-launching', () => {
        app.on('open-file', (event, filePath: string) => {
            if (filePath) {
                if (!macFirstRun) {
                    openThisDamnFile(filePath, 1);
                }
            }
        });
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        // if (process.platform !== 'darwin') {
        app.quit();
        // }
    });

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });

    app.whenReady().then(() => {
        protocol.registerFileProtocol('file', (request, callback) => {
            const pathname = request.url.replace('file:///', '');
            callback(pathname);
        });
    });

} catch {
}

if (GLOBALS.macVersion) {
    systemPreferences.subscribeNotification(
        'AppleInterfaceThemeChangedNotification',
        function theThemeHasChanged() {
            if (nativeTheme.shouldUseDarkColors) {
                tellElectronDarkModeChange('dark');
            } else {
                tellElectronDarkModeChange('light');
            }
        }
    );
}

/**
 * Notify front-end about OS change in Dark Mode setting
 * @param mode
 */
function tellElectronDarkModeChange(mode: string) {
    GLOBALS.angularApp.sender.send('os-dark-mode-change', mode);
}

// =================================================================================================
// Open a vha file method
// -------------------------------------------------------------------------------------------------

/**
 * Get angular to shut down immediately - saving settings and hub if needed.
 */
function getAngularToShutDown(): void {
    GLOBALS.angularApp.sender.send('please-shut-down-ASAP');
}

const algorithm = 'aes-256-ctr';
const IV_LENGTH = 16;


/**
 * Load the .vha2 file and send it to app
 * @param pathToVhaFile full path to the .vha2 file
 */
function openThisDamnFile(pathToVhaFile: string, flag: number): void {
    console.log("I am from function Number " + flag);
    resetAllQueues();
    macFirstRun = false;

    if (userWantedToOpen) {
        pathToVhaFile = userWantedToOpen;
        userWantedToOpen = undefined;
    }
    fs.readFile(pathToVhaFile, (err, data) => {
        if (err) {
            GLOBALS.angularApp.sender.send('show-msg-dialog', systemMessages.error, systemMessages.noSuchFileFound, pathToVhaFile);
            GLOBALS.angularApp.sender.send('please-open-wizard');
        } else {
            createPasswordPrompt().then(password => {
                try {
                    const decryptedData = decryptJson(data.toString(), password); // Use the provided password
                    app.addRecentDocument(pathToVhaFile);
                    // Process the decrypted data as needed
                    GLOBALS.currentlyOpenVhaFile = pathToVhaFile;
                    GLOBALS.selectedOutputFolder = path.parse(pathToVhaFile).dir;
                    GLOBALS.hubName = decryptedData.hubName;
                    GLOBALS.enteredPassword = password.toString();
                    GLOBALS.screenshotSettings = decryptedData.screenshotSettings;
                    upgradeToVersion3(decryptedData);
                    console.log('setting inputDirs');
                    console.log(decryptedData.inputDirs);
                    GLOBALS.selectedSourceFolders = decryptedData.inputDirs;
                    sendFinalObjectToAngular(decryptedData, GLOBALS);
                    setUpDirectoryWatchers(decryptedData.inputDirs, decryptedData.images);
                } catch (decryptionError) {
                    GLOBALS.angularApp.sender.send('show-msg-dialog', systemMessages.error, 'Password is not correct.');
                }
            }).catch(err => {
                GLOBALS.angularApp.sender.send('show-msg-dialog', systemMessages.error, `Password Prompt Error: ${err.message}`);
            })
        }
    });
}

function openRecentFile(pathToVhaFile: string, password: string): void {
    resetAllQueues();
    macFirstRun = false;

    if (userWantedToOpen) {
        pathToVhaFile = userWantedToOpen;
        userWantedToOpen = undefined;
    }
    fs.readFile(pathToVhaFile, (err, data) => {
        if (err) {
            GLOBALS.angularApp.sender.send('show-msg-dialog', systemMessages.error, systemMessages.noSuchFileFound, pathToVhaFile);
            GLOBALS.angularApp.sender.send('please-open-wizard');
        } else {
            try {
                const decryptedData = decryptJson(data.toString(), password); // Use the provided password
                app.addRecentDocument(pathToVhaFile);
                // Process the decrypted data as needed
                GLOBALS.currentlyOpenVhaFile = pathToVhaFile;
                GLOBALS.selectedOutputFolder = path.parse(pathToVhaFile).dir;
                GLOBALS.hubName = decryptedData.hubName;
                GLOBALS.screenshotSettings = decryptedData.screenshotSettings;
                upgradeToVersion3(decryptedData);
                console.log('setting inputDirs');
                console.log(decryptedData.inputDirs);
                GLOBALS.selectedSourceFolders = decryptedData.inputDirs;
                sendFinalObjectToAngular(decryptedData, GLOBALS);
                setUpDirectoryWatchers(decryptedData.inputDirs, decryptedData.images);
            } catch (decryptionError) {
                GLOBALS.angularApp.sender.send('show-msg-dialog', systemMessages.error, 'Password is not correct.');
            }
        }
    });
}

function decryptJson(encryptedResult, password) {
    try {
        // Ensure GLOBALS.hubPassword is correctly set and available
        if (!password) {
            throw new Error('Password is not set.');

        }
        const secretKey = crypto.createHash('sha256').update(password).digest();

        // Parse the IV and encrypted data
        const [ivHex, encryptedHex] = encryptedResult.split(':');
        if (!ivHex || !encryptedHex) {
            throw new Error('Invalid encrypted result format.');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedData = Buffer.from(encryptedHex, 'hex');

        // Debugging: Log the key, IV, and encrypted data
        console.log('Secret Key:', secretKey.toString('hex'));
        console.log('IV:', iv.toString('hex'));
        console.log('Encrypted Data:', encryptedData.toString('hex'));

        // Create a decipher object
        const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);

        // Decrypt the data
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Parse the decrypted JSON
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error.message);
        throw new Error('Failed to decrypt data. The password might be incorrect or the data is corrupted.');
    }
}


// =================================================================================================
// Listeners for events from Angular
// -------------------------------------------------------------------------------------------------

setUpIpcMessages(ipcMain, win, pathToAppData, systemMessages);

setUpIpcForServer(ipcMain);

/**
 * Once Angular loads it sends over the `ready` status
 * Load up the settings.json and send settings over to Angular
 */
ipcMain.on('just-started', (event) => {
    GLOBALS.angularApp = event;
    GLOBALS.winRef = win;

    if (GLOBALS.macVersion) {
        tellElectronDarkModeChange(systemPreferences.getEffectiveAppearance());
    }

    // Reference: https://github.com/electron/electron/blob/master/docs/api/locales.md
    const locale: string = app.getLocale();

    fs.readFile(path.join(GLOBALS.settingsPath, 'settings.json'), (err, data) => {
        if (err) {
            win.setBounds({x: 0, y: 0, width: screenWidth, height: screenHeight});
            event.sender.send('set-language-based-off-system-locale', locale);
            event.sender.send('please-open-wizard', true); // firstRun = true!
        } else {

            try {
                const previouslySavedSettings: SettingsObject = JSON.parse(data);
                if (previouslySavedSettings.appState.addtionalExtensions) {
                    GLOBALS.additionalExtensions = parseAdditionalExtensions(previouslySavedSettings.appState.addtionalExtensions);
                }
                event.sender.send('settings-returning', previouslySavedSettings, locale);

            } catch (err) {
                event.sender.send('please-open-wizard', false);
            }
        }
    });
});

/**
 * Start extracting the screenshots into a chosen output folder from a chosen input folder
 */
ipcMain.on('start-the-import', (event, wizard: WizardOptions) => {

    preventSleep();

    const hubName = wizard.futureHubName;
    const hubPassword = wizard.password
    const outDir: string = wizard.selectedOutputFolder;

    if (fs.existsSync(path.join(outDir, hubName + '.vha2'))) { // make sure no hub name under the same name exists
        event.sender.send('show-msg-dialog', systemMessages.error, systemMessages.hubAlreadyExists, systemMessages.pleaseChangeName);
        event.sender.send('please-fix-hub-name');
    } else {
        if (!fs.existsSync(path.join(outDir, 'vha-' + hubName))) { // create the folder `vha-hubName` inside the output directory
            console.log('vha-hubName folder did not exist, creating');
            console.log(`password is ${hubPassword}`);
            fs.mkdirSync(path.join(outDir, 'vha-' + hubName));
            fs.mkdirSync(path.join(outDir, 'vha-' + hubName + '/filmstrips'));
            fs.mkdirSync(path.join(outDir, 'vha-' + hubName + '/thumbnails'));
            fs.mkdirSync(path.join(outDir, 'vha-' + hubName + '/clips'));
        }

        GLOBALS.hubName = hubName;
        GLOBALS.hubPassword = hubPassword;
        GLOBALS.selectedOutputFolder = outDir;
        GLOBALS.selectedSourceFolders = wizard.selectedSourceFolder;
        GLOBALS.screenshotSettings = {
            clipHeight: wizard.clipHeight,
            clipSnippetLength: wizard.clipSnippetLength,
            clipSnippets: wizard.extractClips ? wizard.clipSnippets : 0,
            fixed: wizard.isFixedNumberOfScreenshots,
            height: wizard.screenshotSizeForImport,
            n: wizard.isFixedNumberOfScreenshots ? wizard.ssConstant : wizard.ssVariable,
        };

        writeVhaFileAndStartExtraction();
    }
});

/**
 * Creates a FinalObject with known data (no ImageElement[])
 * Writes to disk, sends to Angular, starts watching directories
 */
function writeVhaFileAndStartExtraction(): void {

    const finalObject: FinalObject = {
        addTags: [],
        hubName: GLOBALS.hubName,
        password: GLOBALS.hubPassword,
        images: [],
        inputDirs: GLOBALS.selectedSourceFolders,
        numOfFolders: 0,
        removeTags: [],
        screenshotSettings: GLOBALS.screenshotSettings,
        version: GLOBALS.vhaFileVersion,
    };

    const pathToTheFile = path.join(GLOBALS.selectedOutputFolder, GLOBALS.hubName + '.vha2');

    writeVhaFileToDisk(finalObject, pathToTheFile, () => {

        GLOBALS.currentlyOpenVhaFile = pathToTheFile;

        sendFinalObjectToAngular(finalObject, GLOBALS);

        setUpDirectoryWatchers(finalObject.inputDirs, []);
    });
}

/**
 * Summon system modal to choose the *.vha2 file
 * open via `openThisDamnFile` method
 */

ipcMain.on('system-open-file-through-modal', (event, somethingElse) => {
    dialog.showOpenDialog({
        title: 'Select Previous Hub',  // Update to your desired title or use i18n
        filters: [{name: 'Video Hub App 2 files', extensions: ['vha2']}],
        properties: ['openFile']
    }).then(result => {
        const chosenFile = result.filePaths[0];
        openThisDamnFile(chosenFile, 2);
    }).catch(err => {
        console.error('File dialog error:', err.message);
    });
});

function createPasswordPrompt() {
    return new Promise((resolve, reject) => {
        const passwordWindow = new BrowserWindow({
            width: 500,
            height: 200,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
          minimizable: false, // Disable the minimize button
          maximizable: false, // Disable the maximize button
          resizable: false,
          skipTaskbar: true,
          center:true
        });

        const htmlPath = path.join(__dirname, 'src', 'app', 'components', 'load-file-password-dialog.html');
        passwordWindow.loadFile(htmlPath);
        console.log(`htmlPath`, htmlPath);

        ipcMain.once('password-submitted', (_event, password) => {
            resolve(password);
        });

        passwordWindow.on('closed', () => {
            reject(new Error('Password prompt was closed without submitting a password.'));
        });
    });
}

/**
 * Open .vha2 file (from given path)
 * save current VHA file to disk, if provided
 */
ipcMain.on('load-this-vha-file',
    (event, pathToVhaFile: string, finalObjectToSave: FinalObject, password: string) => {
        if (finalObjectToSave !== null) {
            writeVhaFileToDisk(finalObjectToSave, GLOBALS.currentlyOpenVhaFile, () => {
                console.log('.vha2 file saved before opening another');
                openRecentFile(pathToVhaFile, password);
            });
        } else if (password) {
            openRecentFile(pathToVhaFile, password);
        } else {
            GLOBALS.angularApp.sender.send('please-open-wizard');
        }
    });

// =================================================================================================

/**
 * Interrupt current import process
 */
ipcMain.on('cancel-current-import', (event): void => {
    GLOBALS.winRef.setProgressBar(-1);
    resetAllQueues();
});

/**
 * Update additonal extensions from settings
 */
ipcMain.on('update-additional-extensions', (event, newAdditionalExtensions: string): void => {
    GLOBALS.additionalExtensions = parseAdditionalExtensions(newAdditionalExtensions);
});

/**
 * Update system messaging based on new language
 */
ipcMain.on('system-messages-updated', (event, newSystemMessages): void => {
    systemMessages = newSystemMessages;               // TODO -- make sure it works with `main-ipc.ts`
});

/**
 * Opens vha file while the app is running. Only works for mac OS.
 */
ipcMain.on('open-file', (event, pathToVhaFile) => {
    event.preventDefault();
    openThisDamnFile(pathToVhaFile, 5);
});

/**
 * Clears recent document history from the jump list
 */
ipcMain.on('clear-recent-documents', (event): void => {
    app.clearRecentDocuments();
});
