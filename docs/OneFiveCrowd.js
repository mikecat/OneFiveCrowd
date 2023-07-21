"use strict";

const doCallback = (function(){
	const taskQueue = [];
	const callbackMessage = "17efaafc-87d5-11ed-a03e-db112ce4573e";

	window.addEventListener("message", function(event) {
		if (event.source === window && event.data === callbackMessage) {
			event.stopPropagation();
			if (taskQueue.length > 0) taskQueue.shift()();
		}
	}, true);

	const rawOrigin = new URL(location.href).origin;
	const origin = rawOrigin === "null" ? "*" : rawOrigin;
	return function(callbackFunction) {
		taskQueue.push(callbackFunction);
		window.postMessage(callbackMessage, origin);
	};
})();

const LOCAL_STORAGE_PREFIX = "OneFiveCrowd-04db9c2c-5eab-47d7-b316-a9496acdd2e2-";

function readLocalStorage(key, defaultValue = null) {
	try {
		const ret = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
		if (ret === null) return defaultValue;
		return ret;
	} catch (e) {
		console.warn(e);
		return defaultValue;
	}
}

function writeLocalStorage(key, value) {
	try {
		localStorage.setItem(LOCAL_STORAGE_PREFIX + key, value);
		return true;
	} catch (e) {
		console.warn(e);
		return false;
	}
}

function setSelectByValue(selectElement, value) {
	const valueStr = value.toString();
	for (let i = 0; i < selectElement.options.length; i++) {
		if (selectElement.options[i].value === valueStr) {
			selectElement.selectedIndex = i;
			break;
		}
	}
}

const RAW_SCREEN_WIDTH = 32;
const RAW_SCREEN_HEIGHT = 24;

const DEFAULT_BPS = 115200;

const ARRAY_SIZE_JAM = 102;
const ARRAY_SIZE_CAKE = 358;
const PRG_MAX_JAM = 0x400;
const PRG_MAX_CAKE = 0x1000;
const KEY_MAX = 126;
const CMD_MAX = 200; // 本体の長さ。終端の0でさらに1バイト使う。
const VIRTUAL_MEM_MAX_JAM = 0x1180;
const VIRTUAL_MEM_MAX_CAKE = 0x1f7f;
let ARRAY_SIZE = ARRAY_SIZE_JAM;
let VIRTUAL_MEM_MAX = VIRTUAL_MEM_MAX_JAM;

// ROM上の物理アドレス
const CROM_ADDR = 0x1000;
// RAM上の物理アドレス
const CRAM_ADDR = 0x0;
const ARRAY_ADDR = CRAM_ADDR + 0x100;
const VRAM_ADDR = ARRAY_ADDR + 0x100;
const PRG_ADDR_JAM = VRAM_ADDR + 0x300;
const BTN_ADDR_JAM = PRG_ADDR_JAM + PRG_MAX_JAM + 2;
const KEY_ADDR_JAM = BTN_ADDR_JAM + 1;
const CMD_ADDR_JAM = KEY_ADDR_JAM + 1 + KEY_MAX;
const ARRAY2_ADDR_CAKE = VRAM_ADDR + 0x300;
const PRG_ADDR_CAKE = ARRAY2_ADDR_CAKE + 0x200;
const BTN_ADDR_CAKE = PRG_ADDR_CAKE + PRG_MAX_CAKE + 2;
const KEY_ADDR_CAKE = BTN_ADDR_CAKE + 1;
const CMD_ADDR_CAKE = KEY_ADDR_CAKE + 1 + KEY_MAX;
let PRG_ADDR = PRG_ADDR_JAM;
let BTN_ADDR = BTN_ADDR_JAM;
let KEY_ADDR = KEY_ADDR_JAM;
let CMD_ADDR = CMD_ADDR_JAM;

// ROMとRAMのバッファ
const romData = new ArrayBuffer(32 * 1024);
const ramData = new ArrayBuffer(32 * 1024);
// ROMとRAMのビュー
const romView = new DataView(romData);
const ramView = new DataView(ramData);
const romBytes = new Uint8Array(romData);
const ramBytes = new Uint8Array(ramData);
// 役割ごとのRAMのビュー
const cramView = new Uint8Array(ramData, CRAM_ADDR, 0x100);
const vramView = new Uint8Array(ramData, VRAM_ADDR, 0x300);
const prgViewJam = new Uint8Array(ramData, PRG_ADDR_JAM, PRG_MAX_JAM);
const keyViewJam = new Uint8Array(ramData, KEY_ADDR_JAM, 1 + KEY_MAX);
const cmdViewJam = new Uint8Array(ramData, CMD_ADDR_JAM, CMD_MAX + 1);
const prgViewCake = new Uint8Array(ramData, PRG_ADDR_CAKE, PRG_MAX_CAKE);
const keyViewCake = new Uint8Array(ramData, KEY_ADDR_CAKE, 1 + KEY_MAX);
const cmdViewCake = new Uint8Array(ramData, CMD_ADDR_CAKE, CMD_MAX + 1);
let prgView = prgViewJam;
let keyView = keyViewJam;
let cmdView = cmdViewJam;

let cakeMode = false;

// キーバッファからあふれる分のキー入力データ
const extraKeyQueue = [];

const readArray = function(id) {
	if (id < 128) {
		return ramView.getInt16(ARRAY_ADDR + 2 * id, true);
	} else if (cakeMode) {
		return ramView.getInt16(ARRAY2_ADDR_CAKE + 2 * (id - 128), true);
	} else {
		throw "Index out of range";
	}
};
const writeArray = function(id, value) {
	if (id < 128) {
		ramView.setInt16(ARRAY_ADDR + 2 * id, value, true);
	} else if (cakeMode) {
		ramView.setInt16(ARRAY2_ADDR_CAKE + 2 * (id - 128), value, true);
	} else {
		throw "Index out of range";
	}
};

// プログラムを文字列で表現するための文字
// 0x00 - 0x1F 独自定義 (IchigoJam web ではそのまま出力)
const lowChars =
	" ⬛▓▒░🏋🧱🧬⌫＿⏎🪜◌■□␏" +
	"␐▯▏▔▁💍©▕＝／＼🏃⭠⭢⭡⭣";
// 0x7F 独自定義 (IchigoJam web ではそのまま出力)
const delChar = "␡";
// 0x80 - 0xFF IchigoJam web 互換
const highChars =
	"　▘▝▀▖▌▞▛▗▚▐▜▄▙▟█" +
	"・━┃╋┫┣┻┳┏┓┗┛◤◥◣◢" +
	"¥｡｢｣､･ｦｧｨｩｪｫｬｭｮｯ" +
	"ｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ" +
	"ﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏ" +
	"ﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ" +
	"←→↑↓♠♥♣♦⚫⚪🔟🍙🐱👾♪🌀" +
	"🚀🛸⌇🚁💥💰🧰📶🚪🕴🕺💃🏌🏃🚶🍓";
const lowCharsTable = [], highCharsTable = [], charsMap = {};
for (let i = 0; i < lowChars.length; i++) {
	const c = lowChars.charCodeAt(i);
	if (0xd800 <= c && c <= 0xdbff) {
		// サロゲートペア (2バイト目のチェックは省略)
		lowCharsTable.push(lowChars.substring(i, i + 2));
		i++;
	} else {
		lowCharsTable.push(lowChars.charAt(i));
	}
}
if (lowCharsTable.length !== 0x20) {
	console.warn("invalid lowCharsTable length: " + lowCharsTable.length);
}
for (let i = 0; i < highChars.length; i++) {
	const c = highChars.charCodeAt(i);
	if (0xd800 <= c && c <= 0xdbff) {
		// サロゲートペア (2バイト目のチェックは省略)
		highCharsTable.push(highChars.substring(i, i + 2));
		i++;
	} else {
		highCharsTable.push(highChars.charAt(i));
	}
}
if (highCharsTable.length !== 0x80) {
	console.warn("invalid highCharsTable length: " + highCharsTable.length);
}
for (let i = 0; i < lowCharsTable.length; i++) {
	charsMap[lowCharsTable[i]] = String.fromCharCode(i);
}
charsMap[delChar] = String.fromCharCode(0x7f);
for (let i = 0; i < highCharsTable.length; i++) {
	charsMap[highCharsTable[i]] = String.fromCharCode(0x80 + i);
}

// インポート/エクスポート用文字列を内部文字列に変換する
function importText(text) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		if (c < 0x80) {
			result += text.charAt(i);
			continue;
		} else if (0xd800 <= c && c <= 0xdbff) {
			// サロゲートペア候補
			if (i + 1 < text.length) {
				const c2 = text.charCodeAt(i + 1);
				if (0xdc00 <= c2 && c2 <= 0xdfff) {
					// サロゲートペア
					const query = text.substring(i, i + 2);
					if (query in charsMap) {
						result += charsMap[query];
					}
					i++;
					continue;
				}
			}
		}
		// その他の上位文字
		const query = text.charAt(i);
		if (query in charsMap) {
			result += charsMap[query];
		}
	}
	return result;
}

// 内部文字列をインポート/エクスポート用文字列に変換する
function exportText(text) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i) & 0xff;
		if (c < 0x20) {
			result += lowCharsTable[c];
		} else if (c === 0x7f) {
			result += delChar;
		} else if (0x80 <= c) {
			result += highCharsTable[c - 0x80];
		} else {
			result += String.fromCharCode(c);
		}
	}
	return result;
}

// プログラムのコンパイル結果をログに出力するか (テスト用)
let logCompiledProgram = false;

// コンパイル済みのプログラム (インタラクティブ(-1)・即実行(0)を含む)
let programs;
// コンパイル済みのプログラムのラベル情報
let programLabels;
// 実行中の行番号
let currentLine;
// 実行中の行中の位置
let currentPositionInLine;
// 前回エラーが発生した行番号 (CONT用)
let lastErrorLine;
// 前回アクセスを要求したファイル番号 & #FF
let lastFileNo = 0;
// 常にカーソルを表示する
let forceShowCursor = false;
// キー入力待ち中か
let keyBlocked = false;
// INPUTコマンドでキー入力待ちをしている場合のコールバック
let inputKeyBlockCallback = null;

// FORコマンド用の戻り位置
const forStack = [];

// GOSUBコマンド用の戻り位置
const gosubStack = [];

// 停止要求
let breakRequest = false;

// TICK用
let tickOrigin;
const TICK_PER_SECOND = 60;
const TICK_HIRES_MULT = 261;

// BTN用
let btnStatus = 0;

// SRND用
let randomSeeded = false;
let seededX = 0, seededY = 0, seededZ = 0, seededW = 0;

// OK用
let okMode = 1;

// キーボードレイアウト
let keyLayout = 1;

// カーソル位置
let cursorX = 0;
let cursorY = 0;

// カーソルアニメーション用
let cursorDispX = -1;
let cursorDispY = -1;
let cursorOn = false;
let cursorTimerId = null;

// 画面拡大率
let videoZoom = 1;
// 画面反転
let videoInvert = false;
// 拡大を考慮した画面サイズ
let SCREEN_WIDTH = RAW_SCREEN_WIDTH, SCREEN_HEIGHT = RAW_SCREEN_HEIGHT;

const screenBuffer = document.createElement("canvas");
screenBuffer.setAttribute("width", "512");
screenBuffer.setAttribute("height", "384");
const screenBufferContext = screenBuffer.getContext("2d");

let mainScreen, mainScreenContext;
const fontImages = new Array(256);

// フォントデータ
const fonts = {
	"1_1": ijfont_1_1,
	"1_2": ijfont_1_2,
	"1_4": ijfont_1_4,
};

// 更新するべきか
let fontDirty = false; // フォントRAMの更新がある
let vramDirty = false; // VRAMの更新がある
let videoConfigUpdated = false; // VIDEO設定の更新がある
let prgDirty = false; // プログラムの更新がある
let prgValidSize = 2; // 更新判定対象のプログラムのデータサイズ

// 有効な行番号の最小値
const LINE_NUMBER_MIN = 1;
// 有効な行番号の最大値
const LINE_NUMBER_MAX = 0x7fff;
// 引数なしでLISTを実行した時に表示する最大の行番号 (含む)
const LIST_DEFAULT_SHOW_MAX = 16384;
// LISTで入れるウェイトの時間 (WAITで用いる単位)
const LIST_WAIT_TIME = TICK_PER_SECOND >> 1;

// 仮想メモリ上のRAMの開始アドレス
const VIRTUAL_RAM_OFFSET = 0x700;

// 物理RAMに1バイト書き込む
function writePhysicalRam(addr, value) {
	ramBytes[addr] = value;
	if (CRAM_ADDR <= addr && addr < CRAM_ADDR + 0x100) {
		fontDirty = true;
	}
	if (VRAM_ADDR <= addr && addr < VRAM_ADDR + 0x300) {
		vramDirty = true;
	}
	if (PRG_ADDR <= addr && addr < PRG_ADDR + prgValidSize) {
		prgDirty = true;
	}
}

// 仮想メモリを1バイト読む
function readVirtualMem(addr) {
	if (addr < 0) return 0;
	if (addr < VIRTUAL_RAM_OFFSET) return romBytes[CROM_ADDR + addr];
	if (addr < VIRTUAL_MEM_MAX) return ramBytes[CRAM_ADDR + addr - VIRTUAL_RAM_OFFSET];
	return 0;
}

// 仮想メモリに1バイト書き込む
function writeVirtualMem(addr, value) {
	if (VIRTUAL_RAM_OFFSET <= addr && addr < VIRTUAL_MEM_MAX) {
		const physicalAddress = addr - VIRTUAL_RAM_OFFSET + CRAM_ADDR;
		writePhysicalRam(physicalAddress, value);
	}
}

// Jamモード / Cakeモード を切り替える
function switchCakeMode(newCakeMode) {
	if (!cakeMode && newCakeMode) {
		// Jam → Cake
		ARRAY_SIZE = ARRAY_SIZE_CAKE;
		VIRTUAL_MEM_MAX = VIRTUAL_MEM_MAX_CAKE;
		PRG_ADDR = PRG_ADDR_CAKE;
		BTN_ADDR = BTN_ADDR_CAKE;
		KEY_ADDR = KEY_ADDR_CAKE;
		CMD_ADDR = CMD_ADDR_CAKE;
		prgView = prgViewCake;
		keyView = keyViewCake;
		cmdView = cmdViewCake;
		ramBytes[BTN_ADDR_CAKE] = ramBytes[BTN_ADDR_JAM];
		for (let i = 0; i < keyView.length; i++) {
			keyViewCake[i] = keyViewJam[i];
		}
		for (let i = 0; i < cmdView.length; i++) {
			cmdViewCake[i] = cmdViewJam[i];
		}
		for (let i = 0; i < prgViewJam.length; i++) {
			prgViewCake[i] = prgViewJam[i];
		}
		for (let i = prgViewJam.length; i < prgViewCake.length; i++) {
			prgViewCake[i] = 0;
		}
		cakeMode = true;
	} else if (cakeMode && !newCakeMode) {
		// Cake → Jam
		ARRAY_SIZE = ARRAY_SIZE_JAM;
		VIRTUAL_MEM_MAX = VIRTUAL_MEM_MAX_JAM;
		PRG_ADDR = PRG_ADDR_JAM;
		BTN_ADDR = BTN_ADDR_JAM;
		KEY_ADDR = KEY_ADDR_JAM;
		CMD_ADDR = CMD_ADDR_JAM;
		prgView = prgViewJam;
		keyView = keyViewJam;
		cmdView = cmdViewJam;
		for (let i = 0; i < prgViewJam.length; i++) {
			prgViewJam[i] = prgViewCake[i];
		}
		ramBytes[BTN_ADDR_JAM] = ramBytes[BTN_ADDR_CAKE];
		for (let i = 0; i < keyView.length; i++) {
			keyViewJam[i] = keyViewCake[i];
		}
		for (let i = 0; i < cmdView.length; i++) {
			cmdViewJam[i] = cmdViewCake[i];
		}
		if (prgValidSize > prgViewJam.length) {
			prgValidSize = prgViewJam.length;
			prgDirty = true;
		}
		cakeMode = false;
	}
};

// 指定したスロットからタイトル (1行目、最大26文字) を取得する
async function getFileTitle(slot) {
	if (slot < 0 || 228 <= slot) {
		// 無効
		return "";
	} else {
		try {
			let dataDecoded = "";
			if (slot < 100) {
				// 本体 (localStorage)
				const data = readLocalStorage("save" + slot, "");
				dataDecoded = atob(data);
			} else {
				// EEPROM
				if (virtualEepromManager.enabled()) {
					const data = await virtualEepromManager.load(slot);
					dataDecoded = "";
					for (let i = 0; i < data.length && i < 32; i++) {
						dataDecoded += String.fromCharCode(data[i]);
					}
					while (dataDecoded.length < 32) dataDecoded += "\xff";
				}
			}
			if (dataDecoded.length < 3) return "";
			const lineNo = dataDecoded.charCodeAt(0) + (dataDecoded.charCodeAt(1) << 8);
			const dataSize = dataDecoded.charCodeAt(2);
			if (lineNo === 0 || lineNo >= 0x8000) return "";
			let resultTitle = dataDecoded.substring(3, 3 + (dataSize < 26 ? dataSize : 26));
			const zeroIdx = resultTitle.indexOf("\0");
			if (zeroIdx >= 0) resultTitle = resultTitle.substring(0, zeroIdx);
			return resultTitle;
		} catch (e) {
			console.warn(e);
			return "";
		}
	}
}

// 指定したスロットの保存データを読み込み、プログラム領域を上書きする
// 成功したらtrue、失敗したらfalseを返す
async function loadFile(slot) {
	if (slot < 0 || 228 <= slot) {
		// 無効
		return false;
	} else if (slot < 100) {
		// 本体 (localStorage)
		try {
			const data = readLocalStorage("save" + slot);
			if (data === null) return false;
			const dataDecoded = atob(data);
			for (let i = 0; i < prgView.length && i < dataDecoded.length; i++) {
				prgView[i] = dataDecoded.charCodeAt(i);
			}
			for (let i = dataDecoded.length; i < prgView.length; i++) {
				prgView[i] = 0;
			}
			prgDirty = true;
			return true;
		} catch (e) {
			console.warn(e);
			return false;
		}
	} else {
		// EEPROM
		if (virtualEepromManager.enabled()) {
			const data = await virtualEepromManager.load(slot);
			if (data === null) return false;
			for (let i = 0; i < prgView.length && i < data.length; i++) {
				prgView[i] = data[i];
			}
			for (let i = data.length; i < prgView.length; i++) {
				prgView[i] = 0;
			}
			prgDirty = true;
			return true;
		}
		return false;
	}
}

// プログラム領域のデータを指定したスロットに保存する
// 成功したらtrue、失敗したらfalseを返す
async function saveFile(slot) {
	if (slot < 0) {
		// 無効
		return false;
	} else if (slot < 100) {
		// 本体 (localStorage)
		let lastNonZero = -1;
		for (let i = prgView.length - 1; i >= 0; i--) {
			if (prgView[i] !== 0) {
				lastNonZero = i;
				break;
			}
		}
		let data = "";
		for (let i = 0; i <= lastNonZero; i++) data += String.fromCharCode(prgView[i]);
		return writeLocalStorage("save" + slot, btoa(data));
	} else if (slot < 228) {
		// EEPROM
		if (virtualEepromManager.enabled()) {
			return await virtualEepromManager.save(slot, prgView);
		}
		return false;
	} else {
		// 無効
		return false;
	}
}

// フォントデータを描画用のImageDataに変換する
function dataToFontImage(image, data, offset) {
	const imageData = image.data;
	for (let y = 0; y < 8; y++) {
		const line = data[offset + y];
		for (let x = 0; x < 8; x++) {
			const imageOffset = y * (4 * 16 * 2) + x * (4 * 2);
			const value = ((line >> (7 - x)) & 1) ? 255 : 0;
			imageData[imageOffset + 0] = imageData[imageOffset + 4] = value;
			imageData[imageOffset + 1] = imageData[imageOffset + 5] = value;
			imageData[imageOffset + 2] = imageData[imageOffset + 6] = value;
			imageData[imageOffset + 3] = imageData[imageOffset + 7] = 255;
			imageData[imageOffset + 64] = imageData[imageOffset + 68] = value;
			imageData[imageOffset + 65] = imageData[imageOffset + 69] = value;
			imageData[imageOffset + 66] = imageData[imageOffset + 70] = value;
			imageData[imageOffset + 67] = imageData[imageOffset + 71] = 255;
		}
	}
}

function updateScreen() {
	if (fontDirty) {
		// RAM上のフォントデータを更新する
		for (let i = 0; i < 0x20; i++) {
			dataToFontImage(fontImages[0xE0 + i], cramView, i * 8);
		}
		fontDirty = false;
		vramDirty = true;
	}
	const drawCursor = cursorOn && (keyBlocked || forceShowCursor);
	let videoUpdated = videoConfigUpdated;
	videoConfigUpdated = false;
	if (vramDirty) {
		// VRAMを画面に反映させる
		for (let y = 0; y < SCREEN_HEIGHT; y++) {
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				screenBufferContext.putImageData(
					fontImages[vramView[y * SCREEN_WIDTH + x]], x * 16, y * 16);
			}
		}
		if (drawCursor) {
			if (0 <= cursorX && cursorX < SCREEN_WIDTH && 0 <= cursorY && cursorY < SCREEN_HEIGHT) {
				const currentOp = screenBufferContext.globalCompositeOperation;
				const currentStyle = screenBufferContext.fillStyle;
				screenBufferContext.globalCompositeOperation = "difference";
				screenBufferContext.fillStyle = "#FFFFFF";
				screenBufferContext.fillRect(cursorX * 16, cursorY * 16, 8, 16);
				screenBufferContext.globalCompositeOperation = currentOp;
				screenBufferContext.fillStyle = currentStyle;
				cursorDispX = cursorX;
				cursorDispY = cursorY;
			} else {
				cursorDispX = cursorDispY = -1;
			}
		} else {
			cursorDispX = cursorDispY = -1;
		}
		vramDirty = false;
		videoUpdated = true;
	} else if (drawCursor && (cursorX != cursorDispX || cursorY != cursorDispY)) {
		// カーソルの位置がずれている
		// 古い位置のカーソルを消す
		if (0 <= cursorDispX && cursorDispX < SCREEN_WIDTH && 0 <= cursorDispY && cursorDispY < SCREEN_HEIGHT) {
			screenBufferContext.putImageData(
				fontImages[vramView[cursorDispY * SCREEN_WIDTH + cursorDispX]],
				cursorDispX * 16, cursorDispY * 16);
		}
		// 新しい位置にカーソルを描く
		if (0 <= cursorX && cursorX < SCREEN_WIDTH && 0 <= cursorY && cursorY < SCREEN_HEIGHT) {
			const currentOp = screenBufferContext.globalCompositeOperation;
			const currentStyle = screenBufferContext.fillStyle;
			screenBufferContext.globalCompositeOperation = "difference";
			screenBufferContext.fillStyle = "#FFFFFF";
			screenBufferContext.fillRect(cursorX * 16, cursorY * 16, 8, 16);
			screenBufferContext.globalCompositeOperation = currentOp;
			screenBufferContext.fillStyle = currentStyle;
			cursorDispX = cursorX;
			cursorDispY = cursorY;
		} else {
			cursorDispX = cursorDispY = -1;
		}
		videoUpdated = true;
	} else if (!drawCursor && 0 <= cursorDispX && cursorDispX < SCREEN_WIDTH && 0 <= cursorDispY && cursorDispY < SCREEN_HEIGHT) {
		// カーソルが消えたので、消す
		screenBufferContext.putImageData(
			fontImages[vramView[cursorDispY * SCREEN_WIDTH + cursorDispX]],
			cursorDispX * 16, cursorDispY * 16);
		cursorDispX = cursorDispY = -1;
		videoUpdated = true;
	}
	if (videoUpdated) {
		if (videoInvert) {
			mainScreenContext.filter = "invert(100%)";
			mainScreen.style.borderColor = "white";
		} else {
			mainScreenContext.filter = "invert(0%)";
			mainScreen.style.borderColor = "black";
		}
		mainScreenContext.drawImage(screenBuffer,
			0, 0, screenBuffer.width / videoZoom, screenBuffer.height / videoZoom,
			0, 0, screenBuffer.width, screenBuffer.height);
	}
}

function toggleCursor() {
	cursorOn = !cursorOn;
	updateScreen();
}

// 通常のBase64文字列をURL用のBase64文字列に変換する
function base64ToURL(data) {
	return data.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// URL用のBase64文字列から通常のBase64文字列に変換する
function base64FromURL(data) {
	let result = data.replace(/-/g, "+").replace(/_/g, "/");
	while (result.length % 4 !== 0) result += "=";
	return result;
}

async function initSystem() {
	// URLから情報を取得する
	const params = new URLSearchParams(location.hash.substring(1));
	const getHashParam = function(name, defaultValue) {
		return params.has(name) ? parmams.get(name) : defaultValue;
	};
	// 以下の優先順位でパラメータを取得する
	// 1. URLによる設定
	// 2. localStorageに保存された設定
	// 3. デフォルト値
	const getInitialParam = function(name, defaultValue) {
		return params.has(name) ? params.get(name) : readLocalStorage(name, defaultValue);
	};

	// canvasの初期化
	mainScreen = document.getElementById("mainScreen");
	mainScreenContext = mainScreen.getContext("2d");
	mainScreenContext.imageSmoothingEnabled = false;

	// テキスト操作UIの初期化
	const textInputArea = document.getElementById("textInputArea");
	const textInputButton = document.getElementById("textInputButton");
	const programExportButton = document.getElementById("programExportButton");
	const screenExportButton = document.getElementById("screenExportButton");
	textInputArea.addEventListener("keydown", function(e) {
		e.stopPropagation();
	});
	textInputArea.addEventListener("keyup", function(e) {
		e.stopPropagation();
	});
	textInputButton.addEventListener("click", function() {
		// 入力欄のテキストを入力する
		keyInput(importText(textInputArea.value));
	});
	programExportButton.addEventListener("click", function() {
		// 現在メモリ上にあるプログラムをテキスト形式で入力欄に書き出す
		let result = "";
		let ptr = 0;
		while (ptr + 3 <= prgView.length) {
			const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
			if (lineNo === 0) break;
			const lineLength = prgView[ptr + 2];
			if (ptr + 3 + lineLength <= prgView.length) {
				let line = "" + lineNo + " ";
				for (let i = 0; i < lineLength && prgView[ptr + 3 + i] !== 0; i++) {
					line += String.fromCharCode(prgView[ptr + 3 + i]);
				}
				result += exportText(line) + "\n";
			}
			ptr += lineLength + 4;
		}
		textInputArea.value = result;
	});
	screenExportButton.addEventListener("click", function() {
		// 現在VRAM上の画面に対応する領域にあるデータを入力欄に書き出す
		let result = [];
		for (let i = 0; i < SCREEN_HEIGHT; i++) {
			let line = "";
			for (let j = 0; j < SCREEN_WIDTH; j++) {
				line += String.fromCharCode(vramView[SCREEN_WIDTH * i + j]);
			}
			result.push(exportText(line.replace(/\0+$/, "")));
		}
		// 末尾の空行は省略する
		while (result.length > 0 && result[result.length - 1] === "") {
			result.pop();
		}
		textInputArea.value = result.length === 0 ? "" : result.join("\n") + "\n";
	});

	// 操作タブの初期化
	document.querySelectorAll(".controlTab").forEach(function(elem) {
		elem.addEventListener("click", function(event) {
			const target = event.target;
			const forElem = document.getElementById(target.getAttribute("for"));
			if (forElem.checked) {
				// 選択済みのところがクリックされたら、選択を解除する
				setTimeout(function() {
					forElem.checked = false;
				}, 0);
			}
		});
	});

	// 音量調節UIの初期化
	const volumeSwitch = document.getElementById("volumeSwitch");
	const volumeSlider = document.getElementById("volumeSlider");
	const volumeSaved = readLocalStorage("volume", "50");
	if (volumeSaved.charAt(0) === "m") {
		volumeSwitch.checked = true;
		volumeSlider.value = parseInt(volumeSaved.substring(1));
	} else {
		volumeSwitch.checked = false;
		volumeSlider.value = parseInt(volumeSaved);
	}
	const saveVolumeSetting = function() {
		writeLocalStorage("volume", (volumeSwitch.checked ? "m" : "") + volumeSlider.value);
	};
	volumeSwitch.addEventListener("input", function() {
		volumeSlider.disabled = volumeSwitch.checked;
		soundManager.setVolume(volumeSwitch.checked ? 0 : volumeSlider.value / 100);
		saveVolumeSetting();
	});
	volumeSlider.addEventListener("input", function() {
		soundManager.setVolume(volumeSwitch.checked ? 0 : volumeSlider.value / 100);
	});
	volumeSlider.addEventListener("change", saveVolumeSetting);
	volumeSlider.disabled = volumeSwitch.checked;
	soundManager.setVolume(volumeSwitch.checked ? 0 : volumeSlider.value / 100);

	// スクリーンキーボードの初期化
	initializeScreenKeys();
	initializePad();
	keyLayout = parseInt(getInitialParam("keyLayout", "1"));
	if (keyLayout !== 0) keyLayout = 1;
	switchScreenKeys(keyLayout);
	const systemKeyboardLayoutSelect = document.getElementById("systemKeyboardLayoutSelect");
	setSelectByValue(systemKeyboardLayoutSelect, keyLayout);
	systemKeyboardLayoutSelect.addEventListener("change", function() {
		keyLayout = parseInt(systemKeyboardLayoutSelect.value);
		if (keyLayout !== 0) keyLayout = 1;
		switchScreenKeys(keyLayout);
		writeLocalStorage("keyLayout", keyLayout);
	});

	// フォントの枠を作る
	for (let i = 0; i < 0x100; i++) {
		fontImages[i] = screenBufferContext.createImageData(16, 16);
	}

	// フォント設定UIの初期化
	const systemFontSelect = document.getElementById("systemFontSelect");
	setSelectByValue(systemFontSelect, getInitialParam("font", "1_4"));
	const switchFont = function() {
		const fontName = systemFontSelect.value;
		const fontData = fonts[fontName];
		if (!fontData) {
			console.error("unknown font name: " + fontName);
			return;
		}
		// RAM部分のフォントデータが変わっているかをチェックする
		let fontChanged = false;
		for (let i = 0; i < 0x20; i++) {
			for (let j = 0; j < 8; j++) {
				if (cramView[i * 8 * j] !== romBytes[CROM_ADDR + (0xE0 + i) * 8 + j]) {
					fontChanged = true;
					break;
				}
			}
		}
		// ROMにフォントデータを書き込む
		for (let i = 0; i < 0x100; i++) {
			for (let j = 0; j < 8; j++) {
				romBytes[CROM_ADDR + i * 8 + j] = fontData[i * 8 + j];
			}
		}
		// ROM部分のフォントの初期化
		for (let i = 0; i < 0xE0; i++) {
			dataToFontImage(fontImages[i], romBytes, CROM_ADDR + i * 8);
		}
		// 変わっていなければ、RAM部分も初期化する
		if (!fontChanged) commandCLP();
		// 画面を更新する
		vramDirty = true;
		updateScreen();
	};
	systemFontSelect.addEventListener("change", function() {
		switchFont();
		writeLocalStorage("font", systemFontSelect.value);
	});
	switchFont();

	// MML解釈モード設定UIの初期化
	const systemMMLInterpretationSelect = document.getElementById("systemMMLInterpretationSelect");
	setSelectByValue(systemMMLInterpretationSelect, getInitialParam("MMLmode", "new"));
	systemMMLInterpretationSelect.addEventListener("change", function() {
		writeLocalStorage("MMLmode", systemMMLInterpretationSelect.value);
	});

	// 線分描画アルゴリズム設定UIの初期化
	const systemDrawAlgorithmSelect = document.getElementById("systemDrawAlgorithmSelect");
	setSelectByValue(systemDrawAlgorithmSelect, getInitialParam("drawAlgorithm", "bresenham"));
	systemDrawAlgorithmSelect.addEventListener("change", function() {
		writeLocalStorage("drawAlgorithm", systemDrawAlgorithmSelect.value);
	});

	// マシン語モード設定UIの初期化
	const systemMachineLanguageSelect = document.getElementById("systemMachineLanguageSelect");
	setSelectByValue(systemMachineLanguageSelect, getInitialParam("machineLanguage", "m0"));
	systemMachineLanguageSelect.addEventListener("change", function() {
		initializeApiTable(systemMachineLanguageSelect.value);
		writeLocalStorage("machineLanguage", systemMachineLanguageSelect.value);
	});
	initializeApiTable(systemMachineLanguageSelect.value);

	// Jamモード / Cakeモード 切り替えUIの初期化
	const systemMemorySelect = document.getElementById("systemMemorySelect");
	setSelectByValue(systemMemorySelect, getInitialParam("memoryMode", "jam"));
	systemMemorySelect.addEventListener("change", function() {
		switchCakeMode(systemMemorySelect.value === "cake");
		writeLocalStorage("memoryMode", systemMemorySelect.value);
	});
	switchCakeMode(systemMemorySelect.value === "cake");

	// カーソルを点滅させる
	if (cursorTimerId !== null) clearInterval(cursorTimerId);
	cursorTimerId = setInterval(toggleCursor, 500);

	// UARTの初期化を行う
	const phisicalUartPortStatus = document.getElementById("phisicalUartPortStatus");
	const phisicalUartPortSwitchButton = document.getElementById("phisicalUartPortSwitchButton");
	if (uartManager.isWebSerialSupported()) {
		phisicalUartPortSwitchButton.addEventListener("click", function() {
			if (uartManager.isConnected()) {
				uartManager.disconnectPort();
			} else {
				uartManager.webSerialRequestPort();
			}
		});
		phisicalUartPortStatus.classList.add("webSerialSupported");
	} else {
		phisicalUartPortSwitchButton.disabled = true;
	}
	await uartManager.initialize();
	const showUartConnected = function(connected) {
		if (connected) {
			phisicalUartPortStatus.classList.add("uartConnected");
		} else {
			phisicalUartPortStatus.classList.remove("uartConnected");
		}
	};
	uartManager.addConnectStatusChangeCallback(showUartConnected);
	showUartConnected(uartManager.isConnected());

	// URLで共有機能の初期化
	const urlExportElements = {};
	document.querySelectorAll("#urlExportArea input[type=\"checkbox\"]").forEach(function(elem) {
		urlExportElements[elem.id] = elem;
	});
	document.getElementById("urlExportButton").addEventListener("click", async function() {
		const data = new URLSearchParams();
		if (urlExportElements.urlExportText.checked) {
			data.set("text", textInputArea.value);
		}
		if (urlExportElements.urlExportProgram.checked) {
			let programData = "";
			for (let i = 0; i < prgView.length; i++) {
				programData += String.fromCharCode(prgView[i]);
			}
			data.set("prg", base64ToURL(btoa(programData.replace(/\0+$/, ""))));
		}
		if (urlExportElements.urlExportVirtualEeprom.checked) {
			const virtualEepromData = await virtualEepromManager.getCurrentEepromData();
			if (virtualEepromData) {
				if ("name" in virtualEepromData) data.set("en", virtualEepromData.name);
				if (virtualEepromData.data) {
					for (let i = 100; i <= 227; i++) {
						if (i in virtualEepromData.data) {
							data.set("e" + (i - 100), base64ToURL(virtualEepromData.data[i]));
						}
					}
				}
			}
		}
		if (urlExportElements.urlExportConfigFont.checked) {
			data.set("font", systemFontSelect.value);
		}
		if (urlExportElements.urlExportConfigMMLMode.checked) {
			data.set("MMLmode", systemMMLInterpretationSelect.value);
		}
		if (urlExportElements.urlExportConfigDrawAlgorithm.checked) {
			data.set("drawAlgorithm", systemDrawAlgorithmSelect.value);
		}
		if (urlExportElements.urlExportConfigMachineLanguage.checked) {
			data.set("machineLanguage", systemMachineLanguageSelect.value);
		}
		if (urlExportElements.urlExportConfigMemory.checked) {
			data.set("memoryMode", systemMemorySelect.value);
		}
		if (urlExportElements.urlExportConfigKeyLayout.checked) {
			data.set("keyLayout", systemKeyboardLayoutSelect.value);
		}
		location.hash = data.toString();
	});

	// 仮想EEPROMの初期化を行う
	await virtualEepromManager.initialize();

	// URLから仮想EEPROMのデータを設定する
	let virtualEepromData = null;
	if (params.has("en")) {
		if (virtualEepromData === null) virtualEepromData = {};
		virtualEepromData.name = params.get("en");
	}
	for (let i = 0; i <= 127; i++) {
		const key = "e" + i;
		if (params.has(key)) {
			try {
				if (virtualEepromData === null) virtualEepromData = {};
				if (!("data" in virtualEepromData)) virtualEepromData.data = {};
				const data = atob(base64FromURL(params.get(key)));
				const dataArray = new Uint8Array(data.length);
				for (let j = 0; j < data.length; j++) {
					dataArray[j] = data.charCodeAt(j);
				}
				virtualEepromData.data[100 + i] = dataArray;
			} catch (e) {
				console.warn(e);
			}
		}
	}
	if (virtualEepromData) {
		if (!("name" in virtualEepromData)) virtualEepromData.name = "URL";
		await virtualEepromManager.addTemporal(virtualEepromData);
	}

	// 各種初期化を行う
	await resetSystem();

	// URLからプログラム領域のデータを設定する
	if (params.has("prg")) {
		try {
			const data = atob(base64FromURL(params.get("prg")));
			for (let i = 0; i < data.length && i < prgView.length; i++) {
				prgView[i] = data.charCodeAt(i);
			}
			prgDirty = true;
		} catch (e) {
			console.warn(e);
		}
	}

	// URLからテキストを入力する
	if (params.has("text")) {
		keyInput(importText(params.get("text")));
	}

	// 実行を開始する
	doCallback(execute);
}

async function resetSystem() {
	// 設定データの初期化
	okMode = 1;
	videoZoom = 1;
	videoInvert = false;
	SCREEN_WIDTH = RAW_SCREEN_WIDTH;
	SCREEN_HEIGHT = RAW_SCREEN_HEIGHT;
	await uartManager.setBps(DEFAULT_BPS);
	// 各種状態の初期化
	clearScreen();
	commandCLP();
	commandCLV();
	commandCLK();
	commandCLT();
	commandNEW();
	// プログラムの初期化
	programs = new Object();
	programs[-1] = {code: [finalizeExecution, printOK, doInteractive], nextLine: -1};
	programs[0] = {code: [async function(){ await putString("OneFiveCrowd\n"); return null; }], nextLine: -1};
	currentLine = 0;
	currentPositionInLine = 0;
	lastErrorLine = -1;
}

function enqueueKey(key) {
	if (keyView[0] < KEY_MAX) {
		keyView[1 + keyView[0]] = key;
		keyView[0]++;
	} else {
		extraKeyQueue.push(key);
	}
}

function dequeueKey() {
	const nKey = keyView[0];
	if (nKey <= 0) return -1;
	const key = keyView[1];
	for (let i = 1; i < nKey; i++) {
		keyView[i] = keyView[i + 1];
	}
	keyView[0]--;
	while (keyView[0] < KEY_MAX && extraKeyQueue.length > 0) {
		enqueueKey(extraKeyQueue.shift());
	}
	return key;
}

function keyInput(key, invokeCallback = true) {
	if (typeof(key) === "number") {
		if (key === 0x1b){
			// Esc
			if (currentLine >= 0) breakRequest = true;
		} else {
			enqueueKey(key);
		}
	} else {
		if (key.length === 0) return;
		for (let i = 0; i < key.length; i++) {
			const c = key.charCodeAt(i);
			if (0 <= c && c < 0x100) keyInput(c, false);
		}
	}
	if (invokeCallback && keyBlocked) {
		doCallback(inputKeyBlockCallback === null ? execute : inputKeyBlockCallback);
		keyBlocked = false;
	}
}

const specialKeyDict = {
	"Tab"        : "  ",
	"Escape"     : 0x1b,
	"ArrowLeft"  : 0x1c,
	"ArrowRight" : 0x1d,
	"ArrowUp"    : 0x1e,
	"ArrowDown"  : 0x1f,
	"Backspace"  : 0x08,
	"Delete"     : 0x7f,
	"Home"       : 0x12,
	"PageUp"     : 0x13,
	"PageDown"   : 0x14,
	"End"        : 0x17,
	"F1"  : "\x13\x0c",
	"F2"  : "\x18LOAD",
	"F3"  : "\x18SAVE",
	"F4"  : "\x18\x0cLIST\x0a",
	"F5"  : "\x18RUN\x0a",
	"F6"  : "\x18?FREE()\x0a",
	"F7"  : "\x18OUT0\x0a",
	"F8"  : "\x18VIDEO1\x0a",
	"F9"  : "\x18\x0cFILES\x0a"
};

function keyDown(key, shiftKey, ctrlKey, altKey) {
	if (ctrlKey) {
		if (key === "a" || key === "A") keyInput(0x12); // 行頭へ
		if (key === "c" || key === "C") keyInput(0x1b); // ESC
		else if (key === "e" || key === "E") keyInput(0x17); // 行末へ
		else if (key === "k" || key === "K") keyInput(0x0c); // カーソル以降を削除
		else if (key === "l" || key === "L") keyInput("\x13\x0c"); // 全て削除
		else if (key === "Shift") keyInput(0x0f); // アルファベット/カナ切り替え
		else if (key === "Alt") keyInput(0x11); // 挿入/上書き切り替え
	} else if (key.length === 1) {
		let keyCode = key.charCodeAt(0);
		// アルファベット大文字と小文字を入れ替える
		if (0x61 <= keyCode && keyCode <= 0x7a) keyCode -= 0x20;
		else if (0x41 <= keyCode && keyCode <= 0x5a) keyCode += 0x20;
		if (altKey) {
			if (0x21 <= keyCode && keyCode <= 0x29) keyCode += 0x81 - 0x21;
			else if (keyCode === 0x2c) keyCode = 0x3c;
			else if (keyCode === 0x2d) keyCode = 0xad;
			else if (keyCode === 0x2e) keyCode = 0xbe;
			else if (keyCode === 0x2f) keyCode = 0xbf;
			else if (0x30 <= keyCode && keyCode <= 0x39) keyCode += 0xe0 - 0x30;
			else if (keyCode === 0x3c) keyCode = 0x5c;
			else if (keyCode === 0x3d) keyCode = 0x4d;
			else if (keyCode === 0x3e) keyCode = 0x5e;
			else if (keyCode === 0x3f) keyCode = 0x3f;
			else if (0x41 <= keyCode && keyCode <= 0x56) keyCode += 0xea - 0x41;
			else if (0x57 <= keyCode && keyCode <= 0x5a) keyCode += 0xe0 - 0x57;
			else if (0x5b <= keyCode && keyCode <= 0x5d) keyCode += 0xdb - 0x5b;
			else if (keyCode === 0x5e) keyCode = 0xa0;
			else if (keyCode === 0x5f) keyCode = 0x7c;
			else if (0x61 <= keyCode && keyCode <= 0x76) keyCode += 0x8a - 0x61;
			else if (0x77 <= keyCode && keyCode <= 0x7a) keyCode += 0x80 - 0x77;
			else if (keyCode === 0x7e) keyCode = 0x40;
		}
		if (shiftKey && keyCode == 0x20) keyCode = 0x0e;
		keyInput(keyCode);
	} else if (!altKey) {
		if (key === "Enter") {
			keyInput(shiftKey ? 0x10 : 0x0a);
		} else if (key in specialKeyDict) {
			keyInput(specialKeyDict[key]);
		}
	}
	if (!ctrlKey && !altKey) {
		if (key === "ArrowLeft") btnStatus |= 1;
		else if (key === "ArrowRight") btnStatus |= 2;
		else if (key === "ArrowUp") btnStatus |= 4;
		else if (key === "ArrowDown") btnStatus |= 8;
		else if (key === " ") btnStatus |= 0x10;
		else if (key === "x") btnStatus |= 0x20;
		ramBytes[BTN_ADDR] = btnStatus;
	}
}

function keyDownEvent() {
	event.preventDefault();
	keyDown(event.key, event.shiftKey, event.ctrlKey, event.altKey);
	return false;
}

function keyUp(key) {
	if (key === "ArrowLeft") btnStatus &= ~1;
	else if (key === "ArrowRight") btnStatus &= ~2;
	else if (key === "ArrowUp") btnStatus &= ~4;
	else if (key === "ArrowDown") btnStatus &= ~8;
	else if (key === " ") btnStatus &= ~0x10;
	else if (key === "x" || key == "X") btnStatus &= ~0x20;
	ramBytes[BTN_ADDR] = btnStatus;
}

function keyUpEvent() {
	keyUp(event.key);
	return false;
}

// データ (文字列、もしくは特殊操作情報) を設定に沿って変換し、UARTで送信する
async function sendToUart(data) {
	if (typeof data === "string") {
		await uartManager.tx(data);
	} else {
		let dataToSend = null;
		switch (data.command) {
			case "LOCATE":
				dataToSend = String.fromCharCode(0x15, 0x20 + data.x, 0x20 + data.y);
				break;
			case "CLS":
				dataToSend = "\x13\x0c";
				break;
			case "SCROLL":
				switch (data.direction) {
					case "left": dataToSend = "\x15\x1c"; break;
					case "right": dataToSend = "\x15\x1d"; break;
					case "up": dataToSend = "\x15\x1e"; break;
					case "down": dataToSend = "\x15\x1f"; break;
				}
				break;
		}
		if (dataToSend) {
			await uartManager.tx(dataToSend);
		}
	}
}

// データ (Uint8Array) をUARTで受信し、設定に沿って処理する
function receiveFromUart(data) {
	data.forEach(function(c) { keyInput(c); });
}

// 画面に文字を書き込む
let moveCursorMode = false, moveCursorX = null;
function putChar(c, isInsert = false) {
	if (moveCursorMode) {
		if (moveCursorX === null) {
			moveCursorX = c - 32;
			if (moveCursorX < 0) moveCursorX = 0;
			if (moveCursorX >= SCREEN_WIDTH) moveCursorX = SCREEN_WIDTH - 1;
		} else {
			cursorX = moveCursorX;
			cursorY = c - 32;
			if (cursorY < -1) cursorY = -1;
			if (cursorY >= SCREEN_HEIGHT) cursorY = SCREEN_HEIGHT - 1;
			moveCurssorMode = false;
			moveCursorX = null;
		}
		return;
	}
	if (cursorX < 0 || SCREEN_WIDTH <= cursorX || cursorY < 0 || SCREEN_HEIGHT <= cursorY) return;
	switch (c) {
	case 0x08: // Backspace
		if (cursorX > 0 || (cursorY > 0 && vramView[cursorY * SCREEN_WIDTH - 1] != 0)) {
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH - 1;
			const start = cursorY * SCREEN_WIDTH + cursorX - 1;
			let stop;
			for (stop = start; stop < limit && vramView[stop] !== 0; stop++);
			for (let i = start; i < stop; i++) {
				vramView[i] = vramView[i + 1];
			}
			vramView[stop] = 0;
			if (cursorX > 0) {
				cursorX--;
			} else {
				cursorX = SCREEN_WIDTH - 1;
				cursorY--;
			}
			vramDirty = true;
		}
		break;
	case 0x09: // Tab
		putChar(0x20, isInsert);
		putChar(0x20, isInsert);
		break;
	case 0x0a: // 改行
		while (vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else {
				if (cursorY + 1 < SCREEN_HEIGHT) {
					cursorX = 0;
					cursorY++;
				} else {
					break;
				}
			}
		}
		cursorX = 0;
		if (cursorY + 1 < SCREEN_HEIGHT) {
			cursorY++;
		} else {
			for (let y = 1; y < SCREEN_HEIGHT; y++) {
				for (let x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(y - 1) * SCREEN_WIDTH + x] =
						vramView[y * SCREEN_WIDTH + x];
				}
			}
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
			}
			vramDirty = true;
		}
		break;
	case 0x0c: // カーソル位置以降を全削除
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			for (let i = cursorY * SCREEN_WIDTH + cursorX; i < limit; i++) {
				vramView[i] = 0;
			}
			vramDirty = true;
		}
		break;
	case 0x0d: // 無視
		break;
	case 0x0e: // 空白挿入
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			let start = cursorY * SCREEN_WIDTH + cursorX;
			let end;
			for (end = start; end < limit && vramView[end] !== 0; end++);
			if (end === limit) {
				// 最後まで詰まっている
				if (cursorY > 0) {
					for (let y = 1; y < SCREEN_HEIGHT; y++) {
						for (let x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y - 1) * SCREEN_WIDTH + x] =
								vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					start -= SCREEN_WIDTH;
					end -= SCREEN_WIDTH;
				}
			} else if (end % SCREEN_WIDTH === SCREEN_WIDTH - 1 &&
			end + 1 < limit && vramView[end + 1] !== 0) {
				// 空行を挿入してからやる
				const endY = ~~(end / SCREEN_WIDTH) + 1;
				for (let y = SCREEN_HEIGHT - 1; y > endY; y--) {
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[y * SCREEN_WIDTH + x] =
							vramView[(y - 1) * SCREEN_WIDTH + x];
					}
				}
				for (let x = 0; x < SCREEN_WIDTH; x++) {
 					vramView[endY * SCREEN_WIDTH + x] = 0;
				}
			}
			if (end === limit) end--;
			for (let i = end; i > start; i--) {
				vramView[i] = vramView[i - 1];
			}
			vramView[start] = 0x20;
			vramDirty = true;
		}
		break;
	case 0x0f: // 無視
		break;
	case 0x10: // 行分割
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			let start = cursorY * SCREEN_WIDTH + cursorX;
			let end;
			for (end = start; end < limit && vramView[end] !== 0; end++);
			const endX = (end === limit ? SCREEN_WIDTH : end % SCREEN_WIDTH);
			const endY = (end === limit ? SCREEN_HEIGHT - 1 : ~~(end / SCREEN_WIDTH));
			if (cursorX <= endX) {
				// 新しい行を要求する
				let shiftUp = false;
				if (cursorY === SCREEN_HEIGHT - 1) {
					shiftUp = true;
				} else if (cursorY > 0) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						if (vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] !== 0) {
							shiftUp = true;
							break;
						}
					}
				}
				if (shiftUp) {
					// 行末がある行までを上に上げる
					for (let y = 0; y < endY; y++) {
						for (let x = 0; x < SCREEN_WIDTH; x++) {
							vramView[y * SCREEN_WIDTH + x] =
								vramView[(y + 1) * SCREEN_WIDTH + x];
						}
					}
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[endY * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					start -= SCREEN_WIDTH;
					end -= SCREEN_WIDTH;
				} else {
					// 行末がある行の次からを下に下げる
					for (let y = SCREEN_HEIGHT - 2; y > endY; y--) {
						for (let x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y + 1) * SCREEN_WIDTH + x] =
								vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(endY + 1) * SCREEN_WIDTH + x] = 0;
					}
				}
			}
			// 行分割の操作を行う
			const dest = ~~((start + SCREEN_WIDTH) / SCREEN_WIDTH) * SCREEN_WIDTH;
			for (let i = end - 1; i >= start; i--) {
				vramView[i - start + dest] = vramView[i];
			}
			for (let i = start; i < dest; i++) {
				vramView[i] = 0;
			}
			cursorX = 0;
			cursorY = ~~(dest / SCREEN_WIDTH);
			vramDirty = true;
		}
		break;
	case 0x11: // 無視
		break;
	case 0x12: // カーソルを行頭に移動
		while ((cursorX > 0 || cursorY > 0) &&
		vramView[cursorY * SCREEN_WIDTH + cursorX - 1] !== 0) {
			if (cursorX > 0) {
				cursorX--;
			} else {
				cursorX = SCREEN_WIDTH - 1;
				cursorY--;
			}
		}
		break;
	case 0x13: // カーソルを左上に移動
		cursorX = 0;
		cursorY = 0;
		break;
	case 0x14: // カーソルを左下に移動
		cursorX = 0;
		cursorY = SCREEN_HEIGHT - 1;
		break;
	case 0x15: // カーソルを指定位置に移動
		moveCursorMode = true;
		moveCursorX = null;
		break;
	case 0x17: // カーソルを行末に移動
		while (vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else {
				if (cursorY + 1 < SCREEN_HEIGHT) {
					cursorX = 0;
					cursorY++;
				} else {
					break;
				}
			}
		}
		break;
	case 0x18: // カーソルがある行を削除
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			let start = cursorY * SCREEN_WIDTH + cursorX;
			if (start > 0 && vramView[start] === 0) start--;
			let stop = start;
			if (vramView[start] !== 0) {
				for (; start > 0 && vramView[start - 1] !== 0; start--);
			}
			for (; stop < limit && vramView[stop] !== 0; stop++);
			if (start == stop) break;
			for (let i = start; i < stop; i++) {
				vramView[i] = 0;
			}
			cursorX = start % SCREEN_WIDTH;
			cursorY = ~~(start / SCREEN_WIDTH);
			vramDirty = true;
		}
		break;
	case 0x1c: // カーソルを左に移動
		if (cursorX > 0) {
			cursorX--;
		} else if (cursorY > 0 && (!isInsert || vramView[cursorY * SCREEN_WIDTH - 1] !== 0)) {
			cursorX = SCREEN_WIDTH - 1;
			cursorY--;
		}
		break;
	case 0x1d: // カーソルを右に移動
		if (!isInsert || vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else if (cursorY + 1 < SCREEN_HEIGHT) {
				cursorX = 0;
				cursorY++;
			}
		}
		break;
	case 0x1e: // カーソルを上に移動
		if (cursorY > 0) {
			cursorY--;
			if (isInsert && vramView[cursorY * SCREEN_WIDTH + cursorX] === 0) {
				while (cursorX > 0 && vramView[cursorY * SCREEN_WIDTH + cursorX - 1] === 0) {
					cursorX--;
				}
			}
		}
		break;
	case 0x1f: // カーソルを下に移動
		if (cursorY + 1 < SCREEN_HEIGHT) {
			cursorY++;
			if (isInsert && vramView[cursorY * SCREEN_WIDTH + cursorX] === 0) {
				while (cursorX > 0 && vramView[cursorY * SCREEN_WIDTH + cursorX - 1] === 0) {
					cursorX--;
				}
			}
		}
		break;
	case 0x7f: // Delete
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH - 1;
			const start = cursorY * SCREEN_WIDTH + cursorX;
			let stop;
			for (stop = start; stop < limit && vramView[stop] !== 0; stop++);
			for (let i = start; i < stop; i++) {
				vramView[i] = vramView[i + 1];
			}
			vramView[stop] = 0;
			vramDirty = true;
		}
		break;
	default:
		if (isInsert) {
			// 挿入のために、以降の文字列をずらす
			let cursorPoint = cursorY * SCREEN_WIDTH + cursorX;
			let zeroPoint = cursorPoint;
			while (zeroPoint < SCREEN_WIDTH * SCREEN_HEIGHT &&
				vramView[zeroPoint] !== 0) zeroPoint++;
			if (zeroPoint >= SCREEN_WIDTH * SCREEN_HEIGHT) {
				// 画面の最後まで埋まっている場合
				if (cursorY > 0) {
					// カーソルが最初の行に無いなら、1行上げる
					for (let y = 1; y < SCREEN_HEIGHT; y++) {
						for (let x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y - 1) * SCREEN_WIDTH + x]
								= vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					cursorPoint -= SCREEN_WIDTH;
					zeroPoint -= SCREEN_WIDTH;
				} else {
					// カーソルが最初の行にあるなら、最後の文字を犠牲にする
					zeroPoint--;
				}
			} else if (zeroPoint % SCREEN_WIDTH === SCREEN_WIDTH - 1 &&
			zeroPoint + 1 < SCREEN_WIDTH * SCREEN_HEIGHT && vramView[zeroPoint + 1] !== 0) {
				// 次の行に行きそうな場合、1行下げる
				const zeroPointY = ~~(zeroPoint / SCREEN_WIDTH);
				for (let y = SCREEN_HEIGHT - 2; y > zeroPointY; y--) {
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(y + 1) * SCREEN_WIDTH + x]
							= vramView[y * SCREEN_WIDTH + x];
					}
				}
				for (let x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(zeroPointY + 1) * SCREEN_WIDTH + x] = 0;
				}
			}
			for (let i = zeroPoint; i > cursorPoint; i--) {
				vramView[i] = vramView[i - 1];
			}
		}
		// 文字を書き込む
		vramView[cursorY * SCREEN_WIDTH + cursorX] = c;
		cursorX++;
		if (cursorX >= SCREEN_WIDTH) {
			// 次の行に行く
			cursorX = 0;
			if (cursorY + 1 < SCREEN_HEIGHT) {
				cursorY++;
			} else {
				// 最終行だったので、1行上げる
				for (let y = 1; y < SCREEN_HEIGHT; y++) {
					for (let x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(y - 1) * SCREEN_WIDTH + x]
							= vramView[y * SCREEN_WIDTH + x];
					}
				}
				for (let x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
				}
			}
		}
		vramDirty = true;
		break;
	}
}

async function putString(str) {
	for (let i = 0; i < str.length; i++) {
		putChar(str.charCodeAt(i), false);
	}
	await sendToUart(str);
}

/*
プログラムの記録方式 (本家の観察結果)
行番号(2バイト)+行のデータサイズ(1バイト)+行のデータ+#00(1バイト)
行のデータの長さが奇数の場合は、最後に#00を加えて偶数にする。
(常に入る#00と合わせて、#00が2個になる)
この加える#00は「行のデータサイズ」に加える。
行番号、行のデータサイズ、常に入る#00は、「行のデータサイズ」に加えない。
終端は行番号0で表す。プログラムが領域いっぱいまである時は、終端の行番号0は省略する。
*/
function editProgram(lineno, str) {
	// 挿入/上書きする長さを設定する (削除の場合は0)
	if (str.length + (str.length % 2) >= 256) {
		throw "Line too long";
	}
	const addSize = str.length > 0 ? 4 + str.length + (str.length % 2) : 0;
	// 挿入/上書き/削除する位置とプログラムの最終位置を求める
	let lastPos = 0;
	let replacePos = -1;
	let replaceSize = 0;
	while (lastPos + 2 < prgView.length) {
		const currentLineNo = prgView[lastPos] + (prgView[lastPos + 1] << 8);
		if (currentLineNo === 0) break; // 終端
		const lineSize = prgView[lastPos + 2];
		// 最初に記録されている行番号が指定された行番号以上になった位置に入れる
		if (currentLineNo >= lineno && replacePos < 0) {
			replacePos = lastPos;
			if (currentLineNo === lineno) replaceSize = lineSize + 4;
		}
		const nextPos = lastPos + 4 + lineSize;
		if (nextPos > prgView.length) break; // 不正なデータを残さない
		lastPos = nextPos;
	}
	if (replacePos < 0) replacePos = lastPos;
	// 挿入/上書き/削除操作を行う
	if (lastPos - replaceSize + addSize > prgView.length) {
		throw "Out of memory";
	}
	// 必要に応じてデータを移動する
	let newLastPos = lastPos;
	if (replaceSize != addSize) {
		const moveSrc = replacePos + replaceSize;
		const moveDest = replacePos + addSize;
		const moveSize = lastPos - moveSrc;
		if (moveDest < moveSrc) {
			for (let i = 0; i < moveSize; i++) {
				prgView[moveDest + i] = prgView[moveSrc + i];
			}
		} else {
			for (let i = moveSize - 1; i >= 0; i--) {
				prgView[moveDest + i] = prgView[moveSrc + i];
			}
		}
		newLastPos = moveDest + moveSize;
	}
	// データを挿入/上書きする
	if (addSize > 0) {
		prgView[replacePos] = lineno & 0xff;
		prgView[replacePos + 1] = (lineno >> 8) & 0xff;
		prgView[replacePos + 2] = str.length + (str.length % 2);
		for (let i = 0; i < str.length; i++) {
			prgView[replacePos + 3 + i] = str.charCodeAt(i);
		}
		if (str.length % 2 !== 0) {
			prgView[replacePos + 3 + str.length] = 0;
		}
		prgView[replacePos + 3 + prgView[replacePos + 2]] = 0;
	}
	// 新しい終端を記録する
	if (newLastPos + 2 <= prgView.length) {
		prgView[newLastPos] = 0;
		prgView[newLastPos + 1] = 0;
	}
	// プログラムに変更があったフラグを立てる
	prgDirty = true;
}

/*
実行の仕組み
プログラムは、行番号をキーとし、
codeプロパティとnextLineプロパティを持つオブジェクトをデータとする連想配列で表す。
codeプロパティは、プログラムとして実行する関数の配列である。
nextLineプロパティは、この行の実行が終わった次に実行する行番号である。

ここでの行番号は、以下のようにする。
-1 : インタラクティブ
0 : 即実行
1～ : 登録したプログラム

行番号-1は、プログラムの終了処理を行う関数、「OK」を出力する関数、インタラクティブの関数とする。
即実行やRUNの終了時には、ここの最初に戻ることで、
「OK」を出力してインタラクティブに戻ることができる。

それぞれの関数は、そのまま次を実行させる時はnullまたはundefinedを返し、
実行を飛ばす時は配列 [次の行番号, 次に実行する行中の位置] を返す。

実行中は、高速化のため、適当なステップ数ごとにのみ画面を更新する。
キー入力待ちをする時は、変数keyBlockedをtrueにしてから戻る。
実行中に例外が発生した時は、例外の内容を出力し、インタラクティブに戻る。
*/
async function execute() {
	try {
		pollBreak();
		const startTime = performance.now();
		while (performance.now() - startTime < 20) {
			if (currentLine > 0 && prgDirty) {
				compileProgram();
				if (!(currentLine in programs)) {
					throw "Line error";
				}
				if (currentPositionInLine >= programs[currentLine].code.length) {
					throw "Invalid execution position";
				}
			}
			const next = await programs[currentLine].code[currentPositionInLine]();
			if (next) {
				currentLine = next[0];
				currentPositionInLine = next[1];
			} else {
				currentPositionInLine++;
			}
			if (currentLine > 0 && prgDirty) compileProgram();
			if (!(currentLine in programs)) throw "Line error";
			if (programs[currentLine].code.length <= currentPositionInLine) {
				currentLine = programs[currentLine].nextLine;
				currentPositionInLine = 0;
			}
			if (keyBlocked) break;
		}
	} catch (e) {
		finalizeExecution();
		if (okMode !== 2) {
			if (currentLine > 0) {
				await putString("" + e + " in " + currentLine + "\n");
				if (currentLine in programs) {
					await putString("" + currentLine + " " + programs[currentLine].source + "\n");
				}
			} else {
				await putString("" + e + "\n");
			}
		}
		lastErrorLine = currentLine;
		currentLine = -1;
		currentPositionInLine = 2;
	}
	updateScreen();
	if (!keyBlocked) doCallback(execute);
}

function pollBreak() {
	if (breakRequest) throw "Break";
}

async function printOK() {
	if (okMode !== 2) {
		await putString("OK\n");
	}
}

function finalizeExecution() {
	if (cursorY < 0) cursorY = 0;
	breakRequest = false;
	randomSeeded = false;
	forceShowCursor = false;
	inputKeyBlockCallback = null;
	forStack.splice(0);
	gosubStack.splice(0);
}

function doInteractive() {
	const key = dequeueKey();
	if (key < 0) {
		// キー入力がないので、処理を保留する
		keyBlocked = true;
		return [currentLine, currentPositionInLine];
	}
	putChar(key, true);
	if (key === 0x0a && cursorY > 0) {
		const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
		let start = (cursorY - 1) * SCREEN_WIDTH + cursorX;
		if (cursorX === 0 && start > 0 && vramView[start] === 0 && vramView[start - 1] !== 0) {
			start--;
		}
		let end = start;
		if (vramView[start] !== 0) {
			while (start > 0 && vramView[start - 1] !== 0) start--;
			while (end < limit && vramView[end] !== 0) end++;
			if (end - start <= CMD_MAX) {
				for (let i = start; i < end; i++) {
					cmdView[i - start] = vramView[i];
				}
				cmdView[end - start] = 0;
				const compilationResult = compileLine(CMD_ADDR, 0, true);
				if (compilationResult !== null) {
					programs[0] = compilationResult;
					return [0, 0];
				}
			} else {
				throw "Line too long";
			}
		}
	}
	return [currentLine, currentPositionInLine];
}

function compileLine(addr, lineno, enableEdit = false) {
	let source = "";
	for (let i = addr; i < ramBytes.length && ramBytes[i] !== 0; i++) {
		source += String.fromCharCode(ramBytes[i]);
	}
	const tokens = lexer(source, VIRTUAL_RAM_OFFSET + addr);
	if (logCompiledProgram) console.log(tokens);
	if (enableEdit && tokens.length > 0 && tokens[0].kind === "number") {
		// プログラムの編集
		const numberToken = tokens[0].token;
		const left = source.substring(numberToken.length);
		const line = /^\s/.test(left) ? left.substring(1) : left;
		const lineNo =
			numberToken.charAt(0) === "#" ? parseInt(numberToken.substring(1), 16) :
			numberToken.charAt(0) === "`" ? parseInt(numberToken.substring(1), 2) :
			parseInt(numberToken, 10);
		if (LINE_NUMBER_MIN <= lineNo && lineNo <= LINE_NUMBER_MAX) {
			editProgram(lineNo, line);
			return null;
		}
	}
	// プログラムのコンパイル
	const ast = parser.parseLine(tokens);
	if (logCompiledProgram) console.log(ast);
	if (ast === null) return {
		code: [function() { throw "Syntax error"; }],
		source: source,
		nextLine: -1,
		label: null
	};
	let definedLabel = null;
	if (ast.kind === "line" && ast.nodes.length > 0 && ast.nodes[0].kind === "command") {
		const command = ast.nodes[0];
		if (command.nodes.length > 0 && command.nodes[0].kind === "label_definition") {
			const labelNode = command.nodes[0];
			if (labelNode.nodes.length > 0 && labelNode.nodes[0].kind === "label") {
				definedLabel = labelNode.nodes[0].token;
			}
		}
	}
	const executable = compiler.compileLine(ast, lineno);
	if (logCompiledProgram) console.log(executable);
	return {
		code: executable,
		source: source,
		nextLine: -1,
		label: definedLabel
	};
}

// プログラム領域に格納されているプログラムをコンパイルする
function compileProgram() {
	const newPrograms = new Object();
	const newLabels = new Object();
	if (programs) {
		newPrograms[-1] = programs[-1];
		newPrograms[0] = programs[0];
	}
	let ptr = 0;
	let lastLine = -1;
	while (ptr <= prgView.length - 4) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		const lineSize = prgView[ptr + 2];
		if (lineNo === 0 || ptr > prgView.length - (lineSize + 4)) break;
		if (!(lineNo in newPrograms)) {
			newPrograms[lineNo] = compileLine(PRG_ADDR + ptr + 3, lineNo);
			if (newPrograms[lineNo].label !== null && !(newPrograms[lineNo].label in newLabels)) {
				newLabels[newPrograms[lineNo].label] = lineNo;
			}
			if (lastLine > 0) newPrograms[lastLine].nextLine = lineNo;
			lastLine = lineNo;
		}
		ptr += lineSize + 4;
	}
	programs = newPrograms;
	programLabels = newLabels;
	prgValidSize = ptr + 2;
	if (prgValidSize > prgView.length) prgValidSize = prgView.length;
	prgDirty = false;
}

function clearScreen() {
	// VRAMを初期化する
	for (let i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
		vramView[i] = 0;
	}
	// カーソルの位置を左上に戻す
	cursorX = 0;
	cursorY = 0;
	moveCursorMode = false;
	moveCursorX = null;
	vramDirty = true;
}

function commandCLK() {
	// キーバッファを初期化する
	keyView[0] = 0;
	extraKeyQueue.splice(0); // 要素を全削除する
}

function commandNEW() {
	// RAMのプログラム領域を初期化する
	for (let i = 0; i < 0x400; i++) {
		prgView[i] = 0;
	}
	prgDirty = true;
	// プログラムの実行を終了する
	return [-1, 0];
}

function commandCLV() {
	// 配列と変数を初期化する
	for (let i = 0; i < ARRAY_SIZE + 26; i++) {
		writeArray(i, 0);
	}
}

function commandCLP() {
	// RAMのフォント領域を初期化する
	for (let i = 0; i < 0x20; i++) {
		for (let j = 0; j < 8; j++) {
			cramView[i * 8 + j] = romBytes[CROM_ADDR + (0xE0 + i) * 8 + j];
		}
	}
	fontDirty = true;
}

function commandCLT() {
	// TICK() の時刻を0にする
	tickOrigin = performance.now();
}
