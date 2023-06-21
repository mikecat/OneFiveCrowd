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

// リトルエンディアン環境かを判定
const isLittleEndian = (function() {
	const buffer = new ArrayBuffer(4);
	const bufferBytes = new Uint8Array(buffer);
	const bufferUint = new Uint32Array(buffer);
	bufferBytes[3] = 0x44;
	bufferBytes[2] = 0x33;
	bufferBytes[1] = 0x22;
	bufferBytes[0] = 0x11;
	return bufferUint[0] === 0x44332211;
})();

const RAW_SCREEN_WIDTH = 32;
const RAW_SCREEN_HEIGHT = 24;

const ARRAY_SIZE = 102;
const PRG_MAX = 0x400;
const KEY_MAX = 126;
const CMD_MAX = 200; // 本体の長さ。終端の0でさらに1バイト使う。

// ROM上の物理アドレス
const CROM_ADDR = 0x1000;
// RAM上の物理アドレス
const CRAM_ADDR = 0x0;
const ARRAY_ADDR = CRAM_ADDR + 0x100;
const VRAM_ADDR = ARRAY_ADDR + 0x100;
const PRG_ADDR = VRAM_ADDR + 0x300;
const KEY_ADDR = PRG_ADDR + PRG_MAX + 3;
const CMD_ADDR = KEY_ADDR + 1 + KEY_MAX;

// ROMとRAMのバッファ
const romData = new ArrayBuffer(32 * 1024);
const ramData = new ArrayBuffer(4 * 1024);
// ROMとRAMのビュー
const romView = new DataView(romData);
const ramView = new DataView(ramData);
const romBytes = new Uint8Array(romData);
const ramBytes = new Uint8Array(ramData);
// 役割ごとのRAMのビュー
const cramView = new Uint8Array(ramData, CRAM_ADDR, 0x100);
const arrayView = new Int16Array(ramData, ARRAY_ADDR, ARRAY_SIZE + 26);
const vramView = new Uint8Array(ramData, VRAM_ADDR, 0x300);
const prgView = new Uint8Array(ramData, PRG_ADDR, PRG_MAX);
const keyView = new Uint8Array(ramData, KEY_ADDR, 1 + KEY_MAX);
const cmdView = new Uint8Array(ramData, CMD_ADDR, CMD_MAX + 1);

// キーバッファからあふれる分のキー入力データ
const extraKeyQueue = [];

// 環境に応じて変数と配列のアクセス方法を決定する
const readArray = isLittleEndian ? function(id) {
	// リトルエンディアン環境用
	return arrayView[id];
} : function(id) {
	// 非リトルエンディアン環境用
	return ramView.getInt16(ARRAY_ADDR + 2 * id, true);
};
const writeArray = isLittleEndian ? function(id, value) {
	// リトルエンディアン環境用
	arrayView[id] = value;
} : function(id) {
	// 非リトルエンディアン環境用
	ramView.setInt16(ARRAY_ADDR + 2 * id, value, true);
};

// プログラムを文字列で表現するための文字
const highChars =
	"　▘▝▀▖▌▞▛▗▚▐▜▄▙▟█" +
	"・━┃╋┫┣┻┳┏┓┗┛◤◥◣◢" +
	"¥｡｢｣､･ｦｧｨｩｪｫｬｭｮｯ" +
	"ｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ" +
	"ﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏ" +
	"ﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ" +
	"←→↑↓♠♥♣♦⚫⚪🔟🍙🐱👾♪🌀" +
	"🚀🛸⌇🚁💥💰🧰📶🚪🕴🕺💃🏌🏃🚶🍓";
const highCharsTable = [], highCharsMap = {};
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
for (let i = 0; i < highCharsTable.length; i++) {
	highCharsMap[highCharsTable[i]] = String.fromCharCode(0x80 + i);
}
if (highCharsTable.length !== 0x80) {
	console.warn("invalid highCharsTable length: " + highCharsTable.length);
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
// LISTで何行出力するごとにウェイトを入れるか
const LIST_WAIT_LINES = 22;
// LISTで入れるウェイトの時間 (WAITで用いる単位)
const LIST_WAIT_TIME = TICK_PER_SECOND >> 1;

// 仮想メモリ上のRAMの開始アドレス
const VIRTUAL_RAM_OFFSET = 0x700;
// 仮想メモリのサイズ
const VIRTUAL_MEM_MAX = VIRTUAL_RAM_OFFSET + CMD_ADDR + CMD_MAX + 1;

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
		ramBytes[physicalAddress] = value;
		if(CRAM_ADDR <= physicalAddress && physicalAddress < CRAM_ADDR + 0x100) {
			fontDirty = true;
		}
		if (VRAM_ADDR <= physicalAddress && physicalAddress < VRAM_ADDR + 0x300) {
			vramDirty = true;
		}
		if (PRG_ADDR <= physicalAddress && physicalAddress < PRG_ADDR + prgValidSize) {
			prgDirty = true;
		}
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
	const drawCursor = cursorOn && keyBlocked;
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
				const imageData = screenBufferContext.getImageData(cursorX * 16, cursorY * 16, 8, 16);
				for (let i = 0; i < imageData.data.length; i += 4) {
					imageData.data[i + 0] = 255 - imageData.data[i + 0];
					imageData.data[i + 1] = 255 - imageData.data[i + 1];
					imageData.data[i + 2] = 255 - imageData.data[i + 2];
				}
				screenBufferContext.putImageData(imageData, cursorX * 16, cursorY * 16);
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
			const imageData = screenBufferContext.getImageData(cursorX * 16, cursorY * 16, 8, 16);
			for (let i = 0; i < imageData.data.length; i += 4) {
				imageData.data[i + 0] = 255 - imageData.data[i + 0];
				imageData.data[i + 1] = 255 - imageData.data[i + 1];
				imageData.data[i + 2] = 255 - imageData.data[i + 2];
			}
			screenBufferContext.putImageData(imageData, cursorX * 16, cursorY * 16);
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

function initSystem() {
	// canvasの初期化
	mainScreen = document.getElementById("mainScreen");
	mainScreenContext = mainScreen.getContext("2d");
	mainScreenContext.imageSmoothingEnabled = false;

	// テキスト流し込みUIの初期化
	const textInputArea = document.getElementById("textInputArea");
	const textInputButton = document.getElementById("textInputButton");
	textInputArea.addEventListener("keydown", function(e) {
		e.stopPropagation();
	});
	textInputArea.addEventListener("keyup", function(e) {
		e.stopPropagation();
	});
	textInputButton.addEventListener("click", function() {
		const input = textInputArea.value;
		let toSend = "";
		for (let i = 0; i < input.length; i++) {
			const c = input.charCodeAt(i);
			if (c < 0x80) {
				toSend += input.charAt(i);
				continue;
			} else if (0xd800 <= c && c <= 0xdbff) {
				// サロゲートペア候補
				if (i + 1 < input.length) {
					const c2 = input.charCodeAt(i + 1);
					if (0xdc00 <= c2 && c2 <= 0xdfff) {
						// サロゲートペア
						const query = input.substring(i, i + 2);
						if (query in highCharsMap) {
							toSend += highCharsMap[query];
						}
						i++;
						continue;
					}
				}
			}
			// その他の上位文字
			const query = input.charAt(i);
			if (query in highCharsMap) {
				toSend += highCharsMap[query];
			}
		}
		keyInput(toSend);
	});

	// ROMの内容の初期化
	for (let i = 0; i < 0xE0; i++) {
		for (let j = 0; j < 8; j++) {
			romBytes[CROM_ADDR + i * 8 + j] = ijfont_1_1[i * 8 + j];
		}
	}
	// ROM部分のフォントの初期化
	for (let i = 0; i < 0xE0; i++) {
		fontImages[i] = screenBufferContext.createImageData(16, 16);
		dataToFontImage(fontImages[i], romBytes, CROM_ADDR + i * 8);
	}
	// RAM用のフォントの枠を作る
	for (let i = 0; i < 0x20; i++) {
		fontImages[0xE0 + i] = screenBufferContext.createImageData(16, 16);
	}

	// カーソルを点滅させる
	if (cursorTimerId !== null) clearInterval(cursorTimerId);
	cursorTimerId = setInterval(toggleCursor, 500);

	// 各種初期化を行う
	resetSystem();

	// 実行を開始する
	doCallback(execute);
}

function resetSystem() {
	// 設定データの初期化
	okMode = 1;
	videoZoom = 1;
	videoInvert = false;
	SCREEN_WIDTH = RAW_SCREEN_WIDTH;
	SCREEN_HEIGHT = RAW_SCREEN_HEIGHT;
	// 各種状態の初期化
	commandCLP();
	commandCLV();
	commandCLK();
	commandCLS();
	commandCLT();
	commandNEW();
	// プログラムの初期化
	programs = new Object();
	programs[-1] = {code: [finalizeExecution, printOK, doInteractive], nextLine: -1};
	programs[0] = {code: [function(){ putString("OneFiveCrowd\n"); return null; }], nextLine: -1};
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

function keyDown() {
	event.preventDefault();
	const key = event.key;
	if (event.ctrlKey) {
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
		if (event.altKey) {
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
			else if (keyCOde === 0x5f) keyCode = 0x7c;
			else if (0x61 <= keyCode && keyCode <= 0x76) keyCode += 0x8a - 0x61;
			else if (0x77 <= keyCode && keyCode <= 0x7a) keyCode += 0x80 - 0x77;
			else if (keyCode === 0x7e) keyCode = 0x40;
		}
		if (event.shiftKey && keyCode == 0x20) keyCode = 0x0e;
		keyInput(keyCode);
	} else if (!event.altKey) {
		if (key === "Enter") {
			keyInput(event.shiftKey ? 0x10 : 0x0a);
		} else if (key in specialKeyDict) {
			keyInput(specialKeyDict[key]);
		}
	}
	if (!event.ctrlKey && !event.altKey) {
		if (key === "ArrowLeft") btnStatus |= 1;
		else if (key === "ArrowRight") btnStatus |= 2;
		else if (key === "ArrowUp") btnStatus |= 4;
		else if (key === "ArrowDown") btnStatus |= 8;
		else if (key === " ") btnStatus |= 0x10;
		else if (key === "x") btnStatus |= 0x20;
	}
	return false;
}

function keyUp() {
	const key = event.key;
	if (key === "ArrowLeft") btnStatus &= ~1;
	else if (key === "ArrowRight") btnStatus &= ~2;
	else if (key === "ArrowUp") btnStatus &= ~4;
	else if (key === "ArrowDown") btnStatus &= ~8;
	else if (key === " ") btnStatus &= ~0x10;
	else if (key === "x" || key == "X") btnStatus &= ~0x20;
	return false;
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

function putString(str) {
	for (let i = 0; i < str.length; i++) {
		putChar(str.charCodeAt(i), false);
	}
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
	while (lastPos + 2 < PRG_MAX) {
		const currentLineNo = prgView[lastPos] + (prgView[lastPos + 1] << 8);
		if (currentLineNo === 0) break; // 終端
		const lineSize = prgView[lastPos + 2];
		// 最初に記録されている行番号が指定された行番号以上になった位置に入れる
		if (currentLineNo >= lineno && replacePos < 0) {
			replacePos = lastPos;
			if (currentLineNo === lineno) replaceSize = lineSize + 4;
		}
		const nextPos = lastPos + 4 + lineSize;
		if (nextPos > PRG_MAX) break; // 不正なデータを残さない
		lastPos = nextPos;
	}
	if (replacePos < 0) replacePos = lastPos;
	// 挿入/上書き/削除操作を行う
	if (lastPos - replaceSize + addSize > PRG_MAX) {
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
	if (newLastPos + 2 <= PRG_MAX) {
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
				putString("" + e + " in " + currentLine + "\n");
				if (currentLine in programs) {
					putString("" + currentLine + " " + programs[currentLine].source + "\n");
				}
			} else {
				putString("" + e + "\n");
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

function printOK() {
	if (okMode !== 2) putString("OK\n");
}

function finalizeExecution() {
	if (cursorY < 0) cursorY = 0;
	breakRequest = false;
	randomSeeded = false;
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
}

function commandCLS() {
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

function commandCLV() {
	// 配列と変数を初期化する
	for (let i = 0; i < ARRAY_SIZE + 26; i++) {
		arrayView[i] = 0;
	}
}

function commandCLP() {
	// RAMのフォント領域を初期化する
	for (let i = 0; i < 0x20; i++) {
		for (let j = 0; j < 8; j++) {
			cramView[i * 8 + j] = ijfont_1_1[(0xE0 + i) * 8 + j];
		}
	}
	fontDirty = true;
}

function commandCLT() {
	// TICK() の時刻を0にする
	tickOrigin = performance.now();
}
